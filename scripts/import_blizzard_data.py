import html
import json
import re
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import sqlite3
import tempfile
import threading
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

try:
    from .equipment_catalog_sections import (
        collect_equipment_section_ids,
        validate_required_sections,
        write_section_catalogs,
    )
except ImportError:  # Support direct execution and importlib-based tests.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from equipment_catalog_sections import (
        collect_equipment_section_ids,
        validate_required_sections,
        write_section_catalogs,
    )

API_BASE = "https://us.api.blizzard.com"
TOKEN_URL = "https://oauth.battle.net/token"
OUTPUT = "data/current-retail.json"
NAMESPACE = "static-us"
PVP_NAMESPACE = "dynamic-us"
LOCALE = "en_US"
REQUEST_TIMEOUT_SECONDS = 20
MAX_RETRIES = 3
# Blizzard confirmed a hard 36,000-request/hour quota for each API key.
# 8 requests/second caps this importer at 28,800/hour, leaving 20% headroom
# for bursts/retries and keeping all Blizzard/Wowhead calls under one limiter.
REQUESTS_PER_SECOND = 8
REQUEST_INTERVAL_SECONDS = 1.0 / REQUESTS_PER_SECOND
ITEM_CACHE_PATH = os.environ.get("BLIZZARD_ITEM_CACHE_PATH", "data/blizzard-item-cache.sqlite3")
ITEM_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
# Short-lived in-memory HTTP cache for Blizzard GET responses that explicitly
# advertise Cache-Control: max-age. This honors Blizzard's freshness window
# (e.g. Mythic Keystone Index max-age=1800) without extending it to our
# separate seven-day item-detail cache.
_http_response_cache = {}
_http_response_cache_lock = threading.Lock()
_request_lock = threading.Lock()
_last_request_started = 0.0

def throttled_urlopen(request, timeout):
    """Apply one process-wide start-time limit to every outbound HTTP request."""
    global _last_request_started
    with _request_lock:
        now = time.monotonic()
        wait = REQUEST_INTERVAL_SECONDS - (now - _last_request_started)
        if wait > 0:
            time.sleep(wait)
        _last_request_started = time.monotonic()
    return urllib.request.urlopen(request, timeout=timeout)

def _item_cache_connection():
    os.makedirs(os.path.dirname(ITEM_CACHE_PATH) or ".", exist_ok=True)
    connection = sqlite3.connect(ITEM_CACHE_PATH, timeout=30)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS item_response_cache ("
        "cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, cached_at REAL NOT NULL)"
    )
    connection.commit()
    return connection

def _cacheable_item_url(url, method):
    if method != "GET":
        return False
    parsed = urllib.parse.urlsplit(url)
    if parsed.netloc != "us.api.blizzard.com":
        return False
    # Recipe-output fallback searches can repeat for many recipes and are
    # expensive when Blizzard is slow. Cache each exact, parameterized search
    # URL alongside item/recipe details; the existing seven-day TTL applies.
    return bool(
        re.fullmatch(r"/data/wow/(?:item|recipe)/\d+", parsed.path)
        or parsed.path == "/data/wow/search/item"
    )

def _read_cached_item(url):
    if not _cacheable_item_url(url, "GET"):
        return None
    try:
        with _item_cache_connection() as connection:
            row = connection.execute(
                "SELECT payload, cached_at FROM item_response_cache WHERE cache_key = ?",
                (url,),
            ).fetchone()
        if not row:
            return None
        payload, cached_at = row
        if time.time() - cached_at > ITEM_CACHE_TTL_SECONDS:
            return None
        print(f"Blizzard response cache hit: {urllib.parse.urlsplit(url).path}")
        return json.loads(payload)
    except (sqlite3.Error, json.JSONDecodeError) as error:
        print(f"Item cache read skipped ({type(error).__name__}); fetching from source.")
        return None

def _write_cached_item(url, payload):
    if not _cacheable_item_url(url, "GET"):
        return
    try:
        serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        with _item_cache_connection() as connection:
            connection.execute(
                "INSERT INTO item_response_cache(cache_key, payload, cached_at) VALUES (?, ?, ?) "
                "ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload, cached_at=excluded.cached_at",
                (url, serialized, time.time()),
            )
    except (sqlite3.Error, TypeError, ValueError) as error:
        print(f"Item cache write skipped ({type(error).__name__}); continuing with live data.")

def _retry_after_seconds(error):
    value = error.headers.get("Retry-After") if error.headers else None
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return None

MINIMUM_SEASON = 2
SEASON_SCOPE = "Midnight Season 2+"
SUPPORTED_SEASON_NAME = "Midnight Season 2"
SUPPORTED_SEASON_ID = 42
# Blizzard announced that the Midnight Season 2 crest cap is lifted during the week of October 20, 2026.
# Keep this effective date explicit and sourced rather than silently assuming the cap remains forever.
CREST_CAP_LIFT_DATE = datetime(2026, 10, 20, tzinfo=timezone.utc)
CREST_WEEKLY_CAP_BEFORE_LIFT = 100


def discover_current_pvp_season(token):
    """Return Blizzard's newest exposed PvP season without trusting hard-coded names."""
    response = get_api_json(
        "/data/wow/pvp-season/index",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )
    seasons = response.get("pvp_seasons") or response.get("seasons") or []
    candidates = [s for s in seasons if extract_id(s)]
    if not candidates:
        raise RuntimeError("Blizzard did not expose a usable PvP season index.")
    current = max(candidates, key=lambda s: extract_id(s))
    current_id = extract_id(current)
    current_name = localized_name(current.get("name")) if isinstance(current, dict) else None
    if not current_name and current_id:
        detail = get_api_json(
            f"/data/wow/pvp-season/{current_id}",
            token,
            {"namespace": PVP_NAMESPACE, "locale": LOCALE},
        )
        current_name = localized_name(detail.get("name"))
    if not current_name and current_id == SUPPORTED_SEASON_ID:
        current_name = SUPPORTED_SEASON_NAME
    if not current_name:
        current_name = f"Blizzard PvP Season {current_id}"
    return current_id, current_name


def enforce_supported_season(current_season_id, current_season_name):
    """Never publish Season 2-only rules under a newer Blizzard season."""
    if current_season_id != SUPPORTED_SEASON_ID:
        raise RuntimeError(
            f"Unsupported Blizzard season detected: id {current_season_id}, name {current_season_name!r}. "
            f"This importer contains verified {SUPPORTED_SEASON_NAME} (id {SUPPORTED_SEASON_ID}) rules "
            "and must not publish stale rules."
        )

SEASON_CONTENT_NAMES = {
    "The Venomous Abyss",
    "Venomous Abyss",
    "Altar of Fangs",
    "Murder Row",
    "Den of Nalorakk",
    "The Blinding Vale",
    "Voidscar Arena",
    "The Tidebound Grotto",
}

# These current-season PvE Journal sources are not Mythic+ dungeons.
# Do not gate their loot tables against the Mythic+ dungeon map pool.
SEASON_NON_MYTHIC_PLUS_CONTENT_NAMES = {
    "the venomous abyss",
    "venomous abyss",
    "the tidebound grotto",
}


def request_json(url, headers=None, data=None):
    method = "POST" if data is not None else "GET"
    request = urllib.request.Request(url, headers=headers or {}, data=data, method=method)
    # Log only the host and path: query strings can contain credentials or tokens.
    parsed_url = urllib.parse.urlsplit(url)
    endpoint = f"{parsed_url.netloc}{parsed_url.path}"
    cached = _read_cached_item(url) if _cacheable_item_url(url, method) else None
    if cached is not None:
        return cached
    if method == "GET" and parsed_url.netloc == "us.api.blizzard.com":
        now = time.monotonic()
        with _http_response_cache_lock:
            entry = _http_response_cache.get(url)
            if entry and entry["expires_at"] > now:
                print(f"Blizzard HTTP cache hit: {endpoint}")
                return entry["payload"]
            if entry:
                _http_response_cache.pop(url, None)

    for attempt in range(MAX_RETRIES):
        started = time.monotonic()
        try:
            with throttled_urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                payload = json.load(response)
                response_headers = getattr(response, "headers", None)
                cache_control = response_headers.get("Cache-Control", "") if response_headers else ""
                if not isinstance(cache_control, str):
                    cache_control = ""
            if method == "GET" and parsed_url.netloc == "us.api.blizzard.com":
                match = re.search(r"(?:^|,)\s*max-age\s*=\s*(\d+)", cache_control, re.IGNORECASE)
                if match:
                    max_age = int(match.group(1))
                    if max_age > 0:
                        with _http_response_cache_lock:
                            _http_response_cache[url] = {
                                "payload": payload,
                                "expires_at": time.monotonic() + max_age,
                            }
            _write_cached_item(url, payload)
            return payload
        except urllib.error.HTTPError as error:
            elapsed = time.monotonic() - started
            retryable = error.code == 429 or error.code >= 500
            if retryable and attempt < MAX_RETRIES - 1:
                exponential_wait = min(2 ** attempt, 30)
                retry_after = _retry_after_seconds(error) if error.code == 429 else None
                wait = retry_after if retry_after is not None else exponential_wait
                print(
                    f"Blizzard request {endpoint} returned HTTP {error.code} "
                    f"on attempt {attempt + 1}/{MAX_RETRIES} after {elapsed:.1f}s; "
                    f"retrying in {wait:.1f}s"
                    + (" (Retry-After)" if retry_after is not None else " (exponential backoff)")
                    + "..."
                )
                time.sleep(wait)
                continue
            print(
                f"Blizzard request {endpoint} stopped after HTTP {error.code} "
                f"on attempt {attempt + 1}/{MAX_RETRIES} ({elapsed:.1f}s)."
            )
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            elapsed = time.monotonic() - started
            if attempt < MAX_RETRIES - 1:
                wait = min(2 ** attempt + random.uniform(0.0, 0.5), 30)
                print(
                    f"Blizzard request {endpoint} failed on attempt "
                    f"{attempt + 1}/{MAX_RETRIES} after {elapsed:.1f}s "
                    f"({type(error).__name__}); retrying in {wait}s..."
                )
                time.sleep(wait)
                continue
            print(
                f"Blizzard request {endpoint} failed after {MAX_RETRIES} attempts "
                f"({elapsed:.1f}s on final attempt): {type(error).__name__}"
            )
            raise


def get_access_token(client_id, client_secret):
    body = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    auth = (f"{client_id}:{client_secret}").encode()

    import base64
    encoded = base64.b64encode(auth).decode()

    return request_json(
        TOKEN_URL,
        headers={
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data=body,
    )["access_token"]


def get_api_json(path, token, params=None):
    query = urllib.parse.urlencode(params or {})
    url = f"{API_BASE}{path}"
    if query:
        url += f"?{query}"

    return request_json(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )


def localized_name(value):
    if isinstance(value, dict):
        return value.get(LOCALE) or value.get("en_US") or next(iter(value.values()), None)
    return value


def nested_id(value):
    if isinstance(value, dict):
        return value.get("id")
    return None


def extract_id(value):
    """Extract an ID from Blizzard resource references, including key.href."""
    if isinstance(value, int):
        return value
    if isinstance(value, dict):
        value_id = value.get("id")
        if isinstance(value_id, int):
            return value_id

        key = value.get("key")
        if isinstance(key, dict):
            key_id = key.get("id")
            if isinstance(key_id, int):
                return key_id
            href = key.get("href")
            if href:
                for part in reversed(str(href).rstrip("/").split("/")):
                    try:
                        return int(part.split("?")[0])
                    except ValueError:
                        continue

        href = value.get("href")
        if href:
            for part in reversed(str(href).rstrip("/").split("/")):
                try:
                    return int(part.split("?")[0])
                except ValueError:
                    continue
    return None


def normalize_name(value):
    if not value:
        return ""
    return " ".join(str(value).replace("’", "'").split()).strip().lower()


def parse_wowhead_tooltip_stats(tooltip):
    """Extract explicit numeric item stats from Wowhead tooltip HTML."""
    if not isinstance(tooltip, str) or not tooltip.strip():
        return []
    text = html.unescape(re.sub(r"<[^>]+>", " ", tooltip))
    text = re.sub(r"\s+", " ", text)
    stat_names = {
        "strength": "strength", "agility": "agility", "intellect": "intellect",
        "stamina": "stamina", "critical strike": "criticalStrike",
        "critical strike rating": "criticalStrike", "haste": "haste",
        "haste rating": "haste", "mastery": "mastery", "mastery rating": "mastery",
        "versatility": "versatility", "armor": "armor", "leech": "leech",
        "avoidance": "avoidance", "speed": "speed",
    }
    found = []
    # Match the longest known label first. A lazy generic label pattern stops
    # at the first space and misses multi-word stats such as Critical Strike.
    labels = "|".join(
        re.escape(label) for label in sorted(stat_names, key=len, reverse=True)
    )
    pattern = re.compile(
        r"([+−-]?\d[\d,]*(?:\.\d+)?)\s+(" + labels + r")(?![A-Za-z])",
        re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        label = " ".join(match.group(2).lower().split())
        key = stat_names.get(label)
        if not key:
            continue
        try:
            value = float(match.group(1).replace(",", "").replace("−", "-"))
        except ValueError:
            continue
        if value == 0:
            continue
        if value.is_integer():
            value = int(value)
        found.append({"type": {"name": key}, "value": value, "source": "Wowhead tooltip"})
    unique, seen = [], set()
    for stat in found:
        key = (stat["type"]["name"], stat["value"])
        if key not in seen:
            seen.add(key)
            unique.append(stat)
    return unique


def tooltip_explicitly_labels_cosmetic(tooltip):
    """Return true only when the tooltip explicitly contains the Cosmetic label."""
    if not isinstance(tooltip, str) or not tooltip.strip():
        return False
    plain_text = html.unescape(re.sub(r"<[^>]+>", " ", tooltip))
    plain_text = re.sub(r"\s+", " ", plain_text).strip()
    return bool(re.search(r"\bCosmetic\b", plain_text, re.IGNORECASE))


def fetch_wowhead_tooltip_stats(item_id, diagnostics=None, bonus_ids=None, item_level=None):
    """Fetch explicit displayed stats for a base item or an explicitly identified Wowhead variant.

    An item-level override is only safe alongside a verified variant bonus list.
    This helper never guesses upgrade bonuses or treats level alone as verification.
    """
    item_id = int(item_id)
    params = {"dataEnv": 1, "locale": 0}
    if bonus_ids is not None:
        if not isinstance(bonus_ids, (list, tuple)) or not bonus_ids:
            raise ValueError("bonus_ids must be a non-empty sequence of verified bonus IDs")
        normalized_bonus_ids = []
        for bonus_id in bonus_ids:
            if isinstance(bonus_id, bool) or not str(bonus_id).isdigit() or int(bonus_id) <= 0:
                raise ValueError("bonus_ids must contain positive integer IDs")
            normalized_bonus_ids.append(str(int(bonus_id)))
        params["bonus"] = ":".join(normalized_bonus_ids)
    if item_level is not None:
        if isinstance(item_level, bool) or not str(item_level).isdigit() or int(item_level) <= 0:
            raise ValueError("item_level must be a positive integer")
        if bonus_ids is None:
            raise ValueError("item_level override requires verified bonus_ids; level alone is not variant verification")
        params["ilvl"] = int(item_level)
    url = "https://nether.wowhead.com/tooltip/item/{}?{}".format(
        item_id, urllib.parse.urlencode(params)
    )
    request = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "WoW-Gear-Optimizer/1.0",
    })
    payload = None
    last_error = None
    for attempt in range(4):
        try:
            with throttled_urlopen(request, timeout=30) as response:
                payload = json.load(response)
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == 3:
                if diagnostics is not None:
                    diagnostics["requestErrors"] += 1
                raise
            wait = 2 ** attempt
            if diagnostics is not None:
                diagnostics["retries"] += 1
            print(f"Wowhead tooltip request for item {item_id} failed ({type(error).__name__}); retrying in {wait}s...")
            time.sleep(wait)

    if diagnostics is not None:
        diagnostics["requestsSucceeded"] += 1
        if isinstance(payload, dict):
            diagnostics["responseShapes"][",".join(sorted(str(key) for key in payload.keys())) or "<empty-object>"] = (
                diagnostics["responseShapes"].get(",".join(sorted(str(key) for key in payload.keys())) or "<empty-object>", 0) + 1
            )
        else:
            diagnostics["responseShapes"][type(payload).__name__] = diagnostics["responseShapes"].get(type(payload).__name__, 0) + 1

    tooltip = payload.get("tooltip") if isinstance(payload, dict) else None
    if isinstance(tooltip, dict):
        # Be tolerant of documented/observed wrapper variants without parsing prose.
        tooltip = tooltip.get("html") or tooltip.get("content") or tooltip.get("text")
    if not isinstance(tooltip, str) or not tooltip.strip():
        if diagnostics is not None:
            diagnostics["emptyTooltip"] += 1
        return []

    stats = parse_wowhead_tooltip_stats(tooltip)
    plain_text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", tooltip))).strip()
    # Classification is independent of stat parsing and is recorded whenever
    # the source tooltip explicitly labels the item Cosmetic.
    if tooltip_explicitly_labels_cosmetic(tooltip):
        if diagnostics is not None:
            diagnostics.setdefault("explicitCosmeticItems", set()).add(int(item_id))
        print(f"Wowhead explicitly labels item {item_id} as Cosmetic.")
    if diagnostics is not None:
        if stats:
            diagnostics["usableStats"] += 1
        else:
            diagnostics["tooltipWithoutParsedStats"] += 1
            # Bounded cleaned text is diagnostic only; never used to infer stats.
            print(
                f"Wowhead tooltip parse miss for item {item_id}: "
                f"length={len(tooltip)}, sample={plain_text[:1800]!r}"
            )
    return stats

def normalize_preview_stats(stats):
    """Convert Blizzard preview_item.stats display strings into numeric stats."""
    if not isinstance(stats, list):
        return []
    aliases = {
        "strength": "strength", "agility": "agility", "intellect": "intellect",
        "stamina": "stamina", "critical strike": "criticalStrike",
        "haste": "haste", "mastery": "mastery", "versatility": "versatility",
        "armor": "armor", "leech": "leech", "avoidance": "avoidance", "speed": "speed",
    }
    result = []
    for entry in stats:
        if not isinstance(entry, dict):
            continue
        display = entry.get("display") if isinstance(entry.get("display"), dict) else {}
        label_text = display.get("display_string") or display.get("displayString") or ""
        match = re.search(r"([+−-]?\d[\d,]*(?:\.\d+)?)\s+([A-Za-z ]+?)\s*$", str(label_text).strip())
        if not match:
            continue
        label = " ".join(match.group(2).lower().split())
        key = aliases.get(label)
        if not key:
            continue
        try:
            value = float(match.group(1).replace(",", "").replace("−", "-"))
        except ValueError:
            continue
        if not value:
            continue
        if value.is_integer():
            value = int(value)
        result.append({"type": {"name": key}, "value": value, "source": "Blizzard preview_item.stats"})
    return result
def normalize_item(data, source=None):
    quality = data.get("quality") or {}
    item_class = data.get("item_class") or {}
    item_subclass = data.get("item_subclass") or {}
    inventory_type = data.get("inventory_type") or {}

    return {
        "id": data.get("id"),
        "name": localized_name(data.get("name")),
        "level": data.get("level"),
        "requiredLevel": data.get("required_level"),
        "quality": {
            "id": nested_id(quality),
            "name": localized_name(quality.get("name")) if isinstance(quality, dict) else None,
        },
        "itemClass": {
            "id": nested_id(item_class),
            "name": localized_name(item_class.get("name")) if isinstance(item_class, dict) else None,
        },
        "itemSubclass": {
            "id": nested_id(item_subclass),
            "name": localized_name(item_subclass.get("name")) if isinstance(item_subclass, dict) else None,
        },
        "inventoryType": {
            "id": nested_id(inventory_type),
            "name": localized_name(inventory_type.get("name")) if isinstance(inventory_type, dict) else None,
        },
        "isEquippable": data.get("is_equippable"),
        "stats": data.get("stats") or normalize_preview_stats((data.get("preview_item") or {}).get("stats", [])),
        "spells": data.get("spells", []),
        "set": data.get("set"),
        "description": data.get("description"),
        "media": data.get("media"),
        "source": source or "Blizzard Game Data API",
    }


def get_mythic_keystone_season(token, season_id=None):
    """Resolve the current Mythic+ season independently of the PvP season ID."""
    season_index = get_api_json(
        "/data/wow/mythic-keystone/season/index",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )
    season_refs = season_index.get("seasons") or season_index.get("mythic_keystone_seasons") or []
    if not isinstance(season_refs, list) or not season_refs:
        raise RuntimeError(
            "Blizzard Mythic+ season index returned no usable seasons; "
            "refusing to treat the season source as verified."
        )

    available_refs = [
        entry for entry in season_refs
        if isinstance(entry, dict) and extract_id(entry) is not None
    ]
    available_ids = sorted(extract_id(entry) for entry in available_refs)
    if season_id is None:
        # Prefer Blizzard's explicit current_season pointer over assuming the
        # highest numeric ID is current. Fall back to the highest listed ID
        # only for older/alternate response shapes that omit current_season.
        current_ref = season_index.get("current_season")
        current_id = extract_id(current_ref) if isinstance(current_ref, dict) else None
        season_ref = next(
            (entry for entry in available_refs if extract_id(entry) == current_id),
            None,
        )
        if season_ref is None:
            season_ref = max(available_refs, key=lambda entry: extract_id(entry), default=None)
        season_id = extract_id(season_ref) if season_ref else None
    else:
        season_ref = next(
            (entry for entry in available_refs if extract_id(entry) == season_id),
            None,
        )
    if not season_ref or season_id is None:
        raise RuntimeError(
            f"Could not resolve a Mythic+ season from Blizzard's season index "
            f"(available ids: {available_ids}); no catalog will be published."
        )

    response = get_api_json(
        f"/data/wow/mythic-keystone/season/{season_id}",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )
    returned_id = extract_id(response)
    season_name = localized_name(response.get("season_name") or response.get("name"))
    if returned_id != season_id:
        raise RuntimeError(
            f"Blizzard Mythic+ season lookup returned id {returned_id!r}; "
            f"expected supported season id {season_id}."
        )
    if not isinstance(response.get("periods"), list) or not response.get("periods"):
        raise RuntimeError(
            f"Blizzard Mythic+ season {season_id} returned no periods; "
            "refusing to treat the season source as verified."
        )
    print(
        f"Blizzard Mythic+ season verified: id={returned_id}, "
        f"name={season_name or localized_name(season_ref.get('name')) or 'unknown'}, "
        f"periods={len(response['periods'])}."
    )
    return response


def get_season_instances(token):
    response = get_api_json(
        "/data/wow/journal-instance/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    return response.get("journal_instances") or response.get("instances") or []


def collect_season_content_item_ids(token):
    # Verify the requested season against Blizzard's official season endpoint.
    # The season response contains season metadata/periods, not a complete loot
    # catalog; Journal encounters remain the source of item-level loot evidence.
    mythic_season = get_mythic_keystone_season(token)
    item_sources = {}
    matched_instances = []
    missing_sources = []
    encounter_count = 0

    wanted = {normalize_name(name): name for name in SEASON_CONTENT_NAMES}
    instances = get_season_instances(token)

    print(f"Blizzard Journal instance index returned {len(instances)} instances.")

    # Blizzard's Mythic+ season response exposes period references, not map
    # membership. Use the Mythic Keystone dungeon index/details instead; its
    # tracked flag and map.id identify the currently tracked dungeon pool.
    dungeon_index = get_api_json(
        "/data/wow/mythic-keystone/dungeon/index",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )
    dungeon_refs = dungeon_index.get("dungeons", []) or []
    if not dungeon_refs:
        raise RuntimeError(
            "Blizzard Mythic+ dungeon index returned no dungeons; "
            "refusing to treat name-matched Journal instances as verified sources."
        )

    season_map_ids = set()
    valid_dungeon_refs = [
        (index, dungeon_ref, extract_id(dungeon_ref))
        for index, dungeon_ref in enumerate(dungeon_refs, start=1)
        if extract_id(dungeon_ref)
    ]
    total_dungeons = len(valid_dungeon_refs)
    print(
        f"Checking tracked status for {total_dungeons} Mythic+ dungeon entries.",
        flush=True,
    )
    for position, (index, dungeon_ref, dungeon_id) in enumerate(valid_dungeon_refs, start=1):
        # Emit progress while making per-dungeon detail requests. Without this,
        # a slow API response/retry leaves Actions logs appearing frozen for
        # several minutes even though the importer is still working.
        if position == 1 or position % 5 == 0 or position == total_dungeons:
            print(
                f"Mythic+ dungeon detail progress: {position}/{total_dungeons} "
                f"(current dungeon id={dungeon_id}).",
                flush=True,
            )
        dungeon = get_api_json(
            f"/data/wow/mythic-keystone/dungeon/{dungeon_id}",
            token,
            {"namespace": PVP_NAMESPACE, "locale": LOCALE},
        )
        map_id = extract_id(dungeon.get("map"))
        if dungeon.get("is_tracked") is True and map_id:
            season_map_ids.add(map_id)
    if not season_map_ids:
        raise RuntimeError(
            "Blizzard Mythic+ dungeon details exposed no tracked map IDs; "
            "refusing to treat name-matched Journal instances as verified sources."
        )
    print(f"Verified tracked Mythic+ dungeon map IDs: {sorted(season_map_ids)}")

    for instance_ref in instances:
        instance_id = extract_id(instance_ref)
        instance_name = localized_name(instance_ref.get("name")) if isinstance(instance_ref, dict) else None
        canonical = normalize_name(instance_name)

        if canonical not in wanted or not instance_id:
            continue

        instance = get_api_json(
            f"/data/wow/journal-instance/{instance_id}",
            token,
            {"namespace": NAMESPACE, "locale": LOCALE},
        )

        # Mythic+ dungeons require a stable map ID match. The raid and lair
        # are separately named current-season PvE sources, not members of the
        # Mythic+ rotation, so don't compare their Journal maps to that pool.
        map_ref = instance.get("map") or instance.get("map_id") or {}
        map_id = extract_id(map_ref)
        is_non_mythic_plus_source = canonical in SEASON_NON_MYTHIC_PLUS_CONTENT_NAMES
        if not is_non_mythic_plus_source and season_map_ids and map_id not in season_map_ids:
            print(
                f"Skipping Journal instance outside verified Mythic+ Season 2 maps: "
                f"name={instance_name!r}; instance_id={instance_id}; map_id={map_id}."
            )
            continue
        if not season_map_ids:
            raise RuntimeError(
                "Blizzard Mythic+ Season 2 response exposed no map IDs; "
                "refusing to treat name-matched current-season sources as verified."
            )

        matched_instances.append(instance_name)

        for encounter_ref in instance.get("journal_encounters", []) or instance.get("encounters", []):
            encounter_id = extract_id(encounter_ref)
            if not encounter_id:
                continue

            encounter = get_api_json(
                f"/data/wow/journal-encounter/{encounter_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
            encounter_count += 1

            actual_instance = encounter.get("instance") or encounter.get("journal_instance") or {}
            actual_instance_name = localized_name(actual_instance.get("name")) or instance_name

            for loot in encounter.get("items", []):
                item_id = extract_id(loot.get("item"))
                if not item_id:
                    item_id = extract_id(loot)
                if not item_id:
                    continue

                item_sources.setdefault(item_id, []).append({
                    "seasonScope": SEASON_SCOPE,
                    "category": "PvE",
                    "instance": actual_instance_name,
                    "instanceId": instance_id,
                    "encounterId": encounter_id,
                    "encounter": localized_name(encounter.get("name")),
                })



    matched_normalized = {normalize_name(name) for name in matched_instances}
    for canonical, display_name in wanted.items():
        if canonical not in matched_normalized:
            missing_sources.append(display_name)

    print(
        f"Season source scan: {len(matched_instances)} matched instances, "
        f"{encounter_count} encounters, {len(item_sources)} unique loot items."
    )
    print(f"Matched Season 2 PvE sources: {sorted(matched_instances)}")
    if missing_sources:
        print(f"Season 2 PvE sources not present in Journal yet: {sorted(missing_sources)}")

    return item_sources, sorted(matched_instances), sorted(missing_sources)


def extract_pvp_item_ids(value, item_sources, path=""):
    if isinstance(value, dict):
        for key, child in value.items():
            key_lower = str(key).lower()
            if key_lower in {"item", "item_id", "itemid"}:
                item_id = extract_id(child)
                if item_id:
                    item_sources.setdefault(item_id, []).append(path or "PvP Season 2 reward")
            extract_pvp_item_ids(child, item_sources, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            extract_pvp_item_ids(child, item_sources, f"{path}[{index}]")


def collect_pvp_season_item_ids(token, current_pvp_season_id, current_pvp_season_name):
    """Collect the verified supported PvP season metadata and actual season gear."""
    season_id = current_pvp_season_id
    season_name = current_pvp_season_name
    enforce_supported_season(season_id, season_name)

    season_ref = {"id": season_id, "name": {LOCALE: season_name}}

    if not season_ref:
        print("Blizzard PvP season index returned no usable season references; continuing without PvP rewards.")
        return {}, {
            "id": None,
            "name": SUPPORTED_SEASON_NAME,
            "rewardCount": 0,
            "gearItemCount": 0,
            "status": "not-exposed",
        }

    season_id = extract_id(season_ref)
    if not season_id:
        print("Blizzard PvP Season 2 reference has no ID; continuing without PvP rewards.")
        return {}, {
            "id": None,
            "name": "Midnight Season 2",
            "rewardCount": 0,
            "gearItemCount": 0,
            "status": "not-exposed",
        }

    detail = get_api_json(
        f"/data/wow/pvp-season/{season_id}",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )

    item_sources = {}

    # Blizzard's PvP reward endpoint is region-scoped. It contains seasonal
    # reward metadata, but not the complete vendor gear catalog.
    reward_count = 0
    try:
        region_index = get_api_json(
            "/data/wow/pvp-region/index",
            token,
            {"namespace": PVP_NAMESPACE, "locale": LOCALE},
        )
        region_refs = region_index.get("pvp_regions", []) or []

        for region_ref in region_refs:
            href = region_ref.get("href", "") if isinstance(region_ref, dict) else ""
            parts = href.rstrip("/").split("/")
            region_id = None
            if "pvp-region" in parts:
                pos = parts.index("pvp-region")
                if pos + 1 < len(parts):
                    try:
                        region_id = int(parts[pos + 1])
                    except ValueError:
                        region_id = None
            if not region_id:
                region_id = extract_id(region_ref)

            if not region_id:
                continue

            try:
                rewards = get_api_json(
                    f"/data/wow/pvp-region/{region_id}/pvp-season/{season_id}/pvp-reward/index",
                    token,
                    {"namespace": PVP_NAMESPACE, "locale": LOCALE},
                )
            except urllib.error.HTTPError:
                continue

            reward_sources = {}
            extract_pvp_item_ids(
                rewards,
                reward_sources,
                f"pvpRegion{region_id}.pvpRewards",
            )
            reward_count += len(reward_sources)

            for item_id, paths in reward_sources.items():
                item_sources.setdefault(item_id, []).append({
                    "seasonScope": SEASON_SCOPE,
                    "category": "PvP",
                    "pvpSeasonId": season_id,
                    "pvpRegionId": region_id,
                    "pvpSeason": localized_name(detail.get("name")) or SUPPORTED_SEASON_NAME,
                    "rewardPaths": paths,
                })

    except urllib.error.HTTPError:
        print("Blizzard PvP region index was not available; continuing with PvP gear search.")

    # The PvP season/reward API does not expose the vendor gear catalog.
    # Search Blizzard's item index by the unique Season 2 gear families instead.
    pvp_gear_prefixes = [
        "Venomous Aspirant",
        "Venomous Gladiator",
        "Venomous Warmonger",
        "Thalassian Competitor",
    ]

    gear_item_ids = set()

    for prefix in pvp_gear_prefixes:
        search = get_api_json(
            "/data/wow/search/item",
            token,
            {
                "namespace": NAMESPACE,
                "locale": LOCALE,
                "name.en_US": prefix,
                "_pageSize": 1000,
                "orderby": "id",
            },
        )

        for result in search.get("results", []) or []:
            data = result.get("data") or {}
            item_id = extract_id(result) or extract_id(data)
            item_name = localized_name(data.get("name")) or localized_name(result.get("name"))
            if not item_id or not item_name:
                continue

            normalized = normalize_name(item_name)
            if normalized.startswith(normalize_name(prefix)):
                gear_item_ids.add(item_id)

    for item_id in sorted(gear_item_ids):
        item_sources.setdefault(item_id, []).append({
            "seasonScope": SEASON_SCOPE,
            "category": "PvP",
            "pvpSeasonId": season_id,
            "pvpSeason": localized_name(detail.get("name")) or "Midnight Season 2",
            "sourceType": "current-season PvP gear family search",
        })

    print(
        f"PvP Season 2 found: id {season_id}; "
        f"{reward_count} reward references and {len(gear_item_ids)} current-season gear candidates."
    )

    return item_sources, {
        "id": season_id,
        "name": localized_name(detail.get("name")) or "Midnight Season 2",
        "rewardCount": reward_count,
        "gearItemCount": len(gear_item_ids),
        "status": "gear-search-imported",
    }

def reference_id(value):
    """Extract the entity ID from Blizzard references, including key.href-only references."""
    if isinstance(value, int):
        return value
    if isinstance(value, dict):
        value_id = value.get("id")
        if isinstance(value_id, int):
            return value_id

        for candidate in (value.get("href"), (value.get("key") or {}).get("href")):
            if candidate:
                parts = urllib.parse.urlparse(str(candidate)).path.rstrip("/").split("/")
                for marker in ("playable-specialization", "talent-tree", "playable-class", "pvp-season"):
                    if marker in parts:
                        index = parts.index(marker) + 1
                        if index < len(parts):
                            try:
                                return int(parts[index])
                            except ValueError:
                                pass
                # Generic fallback for references whose URL has no known entity segment.
                for part in reversed(parts):
                    try:
                        return int(part)
                    except ValueError:
                        continue
    return None


def talent_tree_reference_id(value):
    """Extract the talent-tree ID specifically, never the trailing specialization ID."""
    if isinstance(value, dict):
        for candidate in (value.get("href"), (value.get("key") or {}).get("href")):
            if candidate:
                parts = urllib.parse.urlparse(str(candidate)).path.rstrip("/").split("/")
                if "talent-tree" in parts:
                    index = parts.index("talent-tree") + 1
                    if index < len(parts):
                        try:
                            return int(parts[index])
                        except ValueError:
                            pass
        value_id = value.get("id")
        if isinstance(value_id, int):
            return value_id
    elif isinstance(value, int):
        return value
    return None


def talent_tree_hero_reference_ids(value):
    """Return (tree_id, hero_talent_id) from a Hero Talent tree reference."""
    if not isinstance(value, dict):
        return talent_tree_reference_id(value), None
    for candidate in (value.get("href"), (value.get("key") or {}).get("href")):
        if not candidate:
            continue
        parts = urllib.parse.urlparse(str(candidate)).path.rstrip("/").split("/")
        if "talent-tree" not in parts:
            continue
        tree_index = parts.index("talent-tree") + 1
        tree_id = None
        hero_id = None
        if tree_index < len(parts):
            try:
                tree_id = int(parts[tree_index])
            except ValueError:
                pass
        if "hero-talent" in parts:
            hero_index = parts.index("hero-talent") + 1
            if hero_index < len(parts):
                try:
                    hero_id = int(parts[hero_index])
                except ValueError:
                    pass
        return tree_id, hero_id
    return talent_tree_reference_id(value), None


def extract_talent_nodes(value):
    """Read node arrays from Blizzard's documented talent-tree response shapes."""
    if isinstance(value, dict):
        # Blizzard's Talent Tree API uses a shared "talent_nodes" field for
        # class trees, but specialization and Hero Talent endpoints can expose
        # tree-specific arrays. Accept all documented tree-family variants.
        for key in (
            "talent_nodes",
            "class_talent_nodes",
            "spec_talent_nodes",
            "hero_talent_nodes",
            "nodes",
        ):
            direct = value.get(key)
            if isinstance(direct, list):
                return direct
        for key in ("spec_talent_tree", "class_talent_tree", "hero_talent_tree", "talent_tree", "data"):
            nested = value.get(key)
            found = extract_talent_nodes(nested)
            if found:
                return found
    return []


def collect_talent_data(token):
    """Collect current Retail specialization, Hero Talent, and Apex talent data."""
    spec_index = get_api_json(
        "/data/wow/playable-specialization/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    specs = (
        spec_index.get("character_specializations")
        or spec_index.get("playable_specializations")
        or spec_index.get("specializations")
        or []
    )

    talent_records = []
    spec_ids = set()

    for spec_ref in specs:
        spec_id = reference_id(spec_ref)
        if not spec_id:
            continue
        try:
            spec = get_api_json(
                f"/data/wow/playable-specialization/{spec_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
        except urllib.error.HTTPError as error:
            print(f"Skipping specialization {spec_id}: Blizzard returned HTTP {error.code}.")
            continue

        spec_tree = spec.get("spec_talent_tree") or spec.get("talent_tree") or {}
        spec_tree_id = talent_tree_reference_id(spec_tree)

        hero_refs = spec.get("hero_talent_trees") or spec.get("hero_talent_tree") or []
        if isinstance(hero_refs, dict):
            hero_refs = [hero_refs]

        hero_records = []
        for hero_ref in hero_refs:
            hero_tree_id, hero_talent_id = talent_tree_hero_reference_ids(hero_ref)
            if hero_tree_id:
                hero_records.append({
                    "id": hero_tree_id,
                    "heroTalentId": hero_talent_id,
                    "name": localized_name(hero_ref.get("name")) if isinstance(hero_ref, dict) else None,
                })

        talent_records.append({
            "id": spec_id,
            "name": localized_name(spec.get("name")) or localized_name(spec_ref.get("name")),
            "playableClass": spec.get("playable_class"),
            "role": spec.get("role"),
            "powerType": spec.get("power_type"),
            "primaryStatType": spec.get("primary_stat_type"),
            "specTalentTreeId": spec_tree_id,
            "heroTalentTrees": hero_records,
            "pvpTalents": spec.get("pvp_talents", []),
            "seasonScope": SEASON_SCOPE,
        })
        spec_ids.add(spec_id)

    tree_index = get_api_json(
        "/data/wow/talent-tree/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    # Collect all exposed tree collections. An "or" chain silently drops
    # spec/hero collections whenever class_talent_trees is present.
    tree_refs = []
    seen_index_refs = set()
    for collection_key in (
        "class_talent_trees",
        "spec_talent_trees",
        "hero_talent_trees",
        "talent_trees",
        "trees",
    ):
        collection = tree_index.get(collection_key) or []
        if isinstance(collection, dict):
            collection = [collection]
        if not isinstance(collection, list):
            continue
        for ref in collection:
            tree_id = talent_tree_reference_id(ref)
            ref_key = (collection_key, tree_id)
            if tree_id and ref_key not in seen_index_refs:
                seen_index_refs.add(ref_key)
                tree_refs.append({**ref, "_indexCollection": collection_key} if isinstance(ref, dict) else ref)

    print(
        "Talent-tree index diagnostics: "
        f"response_type={type(tree_index).__name__}; "
        f"response_keys={sorted(tree_index.keys()) if isinstance(tree_index, dict) else 'n/a'}; "
        f"selected_refs={len(tree_refs) if isinstance(tree_refs, list) else 'not-a-list'}; "
        f"spec_tree_ids={sum(bool(record.get('specTalentTreeId')) for record in talent_records)}; "
        f"hero_tree_ids={sum(len(record.get('heroTalentTrees') or []) for record in talent_records)}"
    )

    tree_records = []
    seen_tree_keys = set()

    def add_tree(tree_id, tree_type, spec_id=None, hero_talent_id=None):
        if not tree_id:
            return
        if tree_type == "hero" and not hero_talent_id:
            print(f"Skipping Hero Talent tree {tree_id}: missing hero-talent ID in Blizzard reference.")
            return
        key = (tree_type, tree_id, spec_id, hero_talent_id)
        if key in seen_tree_keys:
            return
        seen_tree_keys.add(key)

        try:
            if tree_type == "specialization" and spec_id:
                endpoint = f"/data/wow/talent-tree/{tree_id}/playable-specialization/{spec_id}"
            elif tree_type == "hero" and hero_talent_id:
                endpoint = f"/data/wow/talent-tree/{tree_id}/hero-talent/{hero_talent_id}"
            else:
                endpoint = f"/data/wow/talent-tree/{tree_id}"
            tree = get_api_json(
                endpoint,
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
        except urllib.error.HTTPError as error:
            print(
                f"Talent tree request failed: endpoint="
                f"{endpoint}; "
                f"type={tree_type}, tree_id={tree_id}, spec_id={spec_id}, hero_talent_id={hero_talent_id}, "
                f"HTTP={error.code}; skipping."
            )
            return

        tree_records.append({
            "id": tree_id,
            "type": tree_type,
            "specId": spec_id,
            "heroTalentId": hero_talent_id,
            "data": tree,
            "seasonScope": SEASON_SCOPE,
        })

    for record in talent_records:
        add_tree(record["specTalentTreeId"], "specialization", record["id"])
        for hero in record["heroTalentTrees"]:
            add_tree(hero["id"], "hero", hero_talent_id=hero.get("heroTalentId"))

    for tree_ref in tree_refs:
        tree_id = talent_tree_reference_id(tree_ref)
        if not tree_id:
            continue
        linked_specs = (
            tree_ref.get("playable_specializations")
            or tree_ref.get("specializations")
            or []
        ) if isinstance(tree_ref, dict) else []
        for spec_ref in linked_specs:
            linked_spec_id = reference_id(spec_ref)
            if linked_spec_id in spec_ids:
                add_tree(tree_id, "specialization", linked_spec_id)


    node_count = 0
    apex_count = 0
    for tree in tree_records:
        nodes = extract_talent_nodes(tree.get("data") or {})
        tree["nodeCount"] = len(nodes)
        node_count += len(nodes)
        for node in nodes:
            if "apex" in json.dumps(node, ensure_ascii=False).lower():
                apex_count += 1

    print(
        f"Talent import: {len(talent_records)} specializations, "
        f"{len(tree_records)} talent trees, {node_count} nodes, "
        f"{apex_count} nodes referencing Apex data."
    )

    return {
        "specializations": talent_records,
        "trees": tree_records,
        "seasonScope": SEASON_SCOPE,
        "source": "Blizzard Game Data API",
        "specializationCount": len(talent_records),
        "treeCount": len(tree_records),
        "nodeCount": node_count,
        "apexReferenceCount": apex_count,
    }

def find_recipe_output_item_id(token, recipe_name, profession_name, cache):
    """Resolve a Blizzard recipe output when the recipe omits crafted_item.

    The lookup uses the recipe name returned by Blizzard internally. It never
    uses a name supplied by the end user. For Jewelcrafting, the candidate must
    also be a Blizzard Gem item (item class 3), which prevents unrelated search
    results such as legacy Peridot rings from being selected.
    """
    cache_key = f"{profession_name}:{normalize_name(recipe_name)}"
    if cache_key in cache:
        return cache[cache_key]

    if not recipe_name:
        cache[cache_key] = None
        return None

    search_params = {
        "namespace": NAMESPACE,
        "locale": LOCALE,
        "name.en_US": recipe_name,
        "_pageSize": 100,
        "orderby": "id",
    }
    response = get_api_json("/data/wow/search/item", token, search_params)

    # Blizzard item-name search is paginated. Midnight gem IDs are much newer
    # than many historical matches, so the first page can contain only old
    # gems/recipes. For Jewelcrafting, inspect every returned page before
    # deciding that Blizzard has no matching Gem.
    if profession_name == "Jewelcrafting":
        page_count = int(response.get("pageCount") or 1)
        all_results = list(response.get("results", []) or [])
        for page in range(2, page_count + 1):
            page_params = dict(search_params)
            page_params["_page"] = page
            page_response = get_api_json(
                "/data/wow/search/item",
                token,
                page_params,
            )
            all_results.extend(page_response.get("results", []) or [])
        response["results"] = all_results

    recipe_normalized = normalize_name(recipe_name)
    recipe_tokens = {
        token for token in recipe_normalized.split()
        if len(token) > 1
    }

    candidates = []

    for result in response.get("results", []) or []:
        data = result.get("data") or {}
        item_id = extract_id(result) or extract_id(data)
        item_name = localized_name(data.get("name")) or localized_name(result.get("name"))

        if not item_id or not item_name:
            continue

        item_normalized = normalize_name(item_name)
        item_tokens = {
            token for token in item_normalized.split()
            if len(token) > 1
        }
        item_class_id = extract_id(data.get("item_class"))
        is_equippable = data.get("is_equippable") is True

        # Jewelcrafting is special: Blizzard's item search can return
        # unrelated legacy items with overlapping words. Only accept an
        # actual Gem whose meaningful name tokens contain the recipe tokens.
        if profession_name == "Jewelcrafting":
            if item_class_id != 3:
                continue
            if not recipe_tokens.issubset(item_tokens):
                continue

        # For other professions, keep the existing exact-name behavior.
        elif item_normalized != recipe_normalized:
            continue

        candidates.append((item_id, data, item_normalized == recipe_normalized))

    def candidate_score(candidate):
        item_id, data, is_exact_name = candidate
        item_class_id = extract_id(data.get("item_class"))
        is_equippable = data.get("is_equippable") is True
        score = 0

        if is_exact_name:
            score += 1000
        if profession_name == "Jewelcrafting" and item_class_id == 3:
            score += 500
        if profession_name in {"Blacksmithing", "Leatherworking", "Tailoring"} and is_equippable:
            score += 50
        if profession_name == "Alchemy" and item_class_id == 0:
            score += 20
        if profession_name == "Inscription" and item_class_id in {0, 4}:
            score += 20
        if profession_name == "Cooking" and item_class_id == 0:
            score += 20

        score += item_id / 1_000_000_000
        return score

    chosen = max(candidates, key=candidate_score)[0] if candidates else None
    cache[cache_key] = chosen
    return chosen


def fetch_modified_crafting_slot_metadata(token, slots, cache):
    """Resolve Blizzard modified-crafting slot types/categories.

    Recipe responses expose optional/modified crafting inputs through
    modified_crafting_slots rather than a reliable optional_reagents field.
    The slot-type endpoint also exposes compatible categories, which lets the
    dataset retain the actual Blizzard structure instead of guessing from
    recipe names.
    """
    enriched = []

    for slot in slots or []:
        if not isinstance(slot, dict):
            continue

        slot_type = slot.get("slot_type") or slot.get("slotType") or {}
        slot_id = extract_id(slot_type)
        if not slot_id:
            continue

        cache_key = ("slot", slot_id)
        if cache_key not in cache:
            try:
                cache[cache_key] = get_api_json(
                    f"/data/wow/modified-crafting/reagent-slot-type/{slot_id}",
                    token,
                    {"namespace": NAMESPACE, "locale": LOCALE},
                )
            except urllib.error.HTTPError as error:
                print(
                    f"Skipping modified crafting slot type {slot_id}: "
                    f"Blizzard returned HTTP {error.code}."
                )
                cache[cache_key] = {}


        resolved = cache[cache_key]
        categories = []

        for category_ref in resolved.get("compatible_categories", []) or []:
            category_id = extract_id(category_ref)
            if not category_id:
                continue

            category_key = ("category", category_id)
            if category_key not in cache:
                try:
                    cache[category_key] = get_api_json(
                        f"/data/wow/modified-crafting/category/{category_id}",
                        token,
                        {"namespace": NAMESPACE, "locale": LOCALE},
                    )
                except urllib.error.HTTPError as error:
                    print(
                        f"Skipping modified crafting category {category_id}: "
                        f"Blizzard returned HTTP {error.code}."
                    )
                    cache[category_key] = {}


            category_data = cache[category_key]
            categories.append({
                "id": category_id,
                "name": localized_name(category_data.get("name"))
                    or localized_name(category_ref.get("name")),
            })

        enriched.append({
            "slotTypeId": slot_id,
            "name": localized_name(slot_type.get("name"))
                or localized_name(resolved.get("name")),
            "description": localized_name(resolved.get("description")),
            "displayOrder": slot.get("display_order", slot.get("displayOrder")),
            "compatibleCategories": categories,
        })

    return enriched


def modified_crafting_text(slots):
    parts = []
    for slot in slots or []:
        parts.extend([
            slot.get("name") or "",
            slot.get("description") or "",
        ])
        for category in slot.get("compatibleCategories", []) or []:
            parts.append(category.get("name") or "")
    return normalize_name(" ".join(parts))


def collect_profession_supporting_data(token):
    """Collect current Midnight profession recipes and resolve their outputs."""
    profession_index = get_api_json(
        "/data/wow/profession/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )

    profession_refs = profession_index.get("professions", []) or []
    profession_names = {
        "Alchemy", "Blacksmithing", "Enchanting", "Inscription",
        "Jewelcrafting", "Leatherworking", "Tailoring", "Cooking",
    }

    recipes = []
    output_item_ids = set()
    profession_counts = {}
    recipe_output_cache = {}
    fallback_output_count = 0
    modified_crafting_cache = {}

    print(f"Profession scan: {len(profession_refs)} professions exposed by Blizzard.", flush=True)
    for profession_index, profession_ref in enumerate(profession_refs, start=1):
        profession_id = extract_id(profession_ref)
        profession_name = localized_name(profession_ref.get("name")) if isinstance(profession_ref, dict) else None
        if not profession_id or profession_name not in profession_names:
            continue

        print(f"Profession scan [{profession_index}/{len(profession_refs)}]: loading {profession_name} (id {profession_id}).", flush=True)
        profession = get_api_json(
            f"/data/wow/profession/{profession_id}",
            token,
            {"namespace": NAMESPACE, "locale": LOCALE},
        )

        current_tiers = []
        for tier_ref in profession.get("skill_tiers", []) or []:
            tier_id = extract_id(tier_ref)
            tier_name = localized_name(tier_ref.get("name")) if isinstance(tier_ref, dict) else None
            if tier_id and tier_name and "midnight" in normalize_name(tier_name):
                current_tiers.append((tier_id, tier_name))

        if not current_tiers:
            print(f"Profession {profession_name}: no Midnight skill tier exposed.")
            continue

        for tier_index, (tier_id, tier_name) in enumerate(current_tiers, start=1):
            print(f"Profession {profession_name}: loading Midnight tier {tier_name} ({tier_index}/{len(current_tiers)}).", flush=True)
            skill_tier = get_api_json(
                f"/data/wow/profession/{profession_id}/skill-tier/{tier_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )

            categories = skill_tier.get("categories", []) or []
            tier_recipe_count = sum(len(category.get("recipes", []) or []) for category in categories)
            print(f"Profession {profession_name}/{tier_name}: {len(categories)} categories, {tier_recipe_count} recipe references.", flush=True)
            processed_recipe_count = 0
            for category in categories:
                category_name = localized_name(category.get("name")) or ""
                for recipe_ref in category.get("recipes", []) or []:
                    processed_recipe_count += 1
                    if processed_recipe_count == 1 or processed_recipe_count % 25 == 0 or processed_recipe_count == tier_recipe_count:
                        print(f"Profession {profession_name}/{tier_name}: processing recipe {processed_recipe_count}/{tier_recipe_count}.", flush=True)
                    recipe_id = extract_id(recipe_ref)
                    if not recipe_id:
                        continue

                    recipe = get_api_json(
                        f"/data/wow/recipe/{recipe_id}",
                        token,
                        {"namespace": NAMESPACE, "locale": LOCALE},
                    )

                    crafted_item = (
                        recipe.get("crafted_item")
                        or recipe.get("alliance_crafted_item")
                        or recipe.get("horde_crafted_item")
                        or {}
                    )
                    crafted_item_id = extract_id(crafted_item)
                    if not crafted_item_id and profession_name != "Enchanting":
                        crafted_item_id = find_recipe_output_item_id(
                            token,
                            localized_name(recipe.get("name")) or localized_name(recipe_ref.get("name")),
                            profession_name,
                            recipe_output_cache,
                        )
                        if crafted_item_id:
                            fallback_output_count += 1

                    if crafted_item_id:
                        output_item_ids.add(crafted_item_id)

                    # Preserve Blizzard's structured crafting metadata instead of
                    # reducing a recipe to only its output item. These fields are needed
                    # later for recrafting, optional reagents, stat selection, quality,
                    # and embellishment-aware optimization.
                    raw_modified_crafting_slots = (
                        recipe.get("modified_crafting_slots")
                        or recipe.get("modifiedCraftingSlots")
                        or []
                    )
                    modified_crafting_slots = fetch_modified_crafting_slot_metadata(
                        token,
                        raw_modified_crafting_slots,
                        modified_crafting_cache,
                    )
                    optional_reagents = (
                        recipe.get("optional_reagents")
                        or recipe.get("optionalReagents")
                        or []
                    )
                    # Blizzard commonly represents optional/modified inputs via
                    # modified_crafting_slots. Preserve both API shapes.
                    if not optional_reagents and modified_crafting_slots:
                        optional_reagents = modified_crafting_slots
                    crafting_quality = (
                        recipe.get("crafting_quality")
                        or recipe.get("craftingQuality")
                        or recipe.get("quality")
                    )
                    recipe_name = localized_name(recipe.get("name")) or localized_name(recipe_ref.get("name"))
                    recipe_description = recipe.get("description")

                    recipes.append({
                        "id": recipe_id,
                        "name": recipe_name,
                        "profession": profession_name,
                        "professionId": profession_id,
                        "skillTier": tier_name,
                        "category": category_name,
                        "craftedItemId": crafted_item_id,
                        "craftedItemQuantity": crafted_item.get("quantity") if isinstance(crafted_item, dict) else None,
                        "reagents": recipe.get("reagents", []),
                        "optionalReagents": optional_reagents,
                        "modifiedCraftingSlots": modified_crafting_slots,
                        "craftingQuality": crafting_quality,
                        "description": recipe_description,
                        "media": recipe.get("media"),
                        "isRecraft": (
                            "recraft" in normalize_name(recipe_name)
                            or "recraft" in normalize_name(recipe_description)
                        ),
                        "isEmbellishment": (
                            "embellishment" in normalize_name(recipe_name)
                            or "embellishment" in normalize_name(recipe_description)
                            or "embellishment" in modified_crafting_text(modified_crafting_slots)
                        ),
                        "modifiedCraftingText": modified_crafting_text(modified_crafting_slots),
                        "seasonScope": SEASON_SCOPE,
                        "source": "Blizzard Game Data API — current Midnight profession recipe",
                    })

        profession_counts[profession_name] = len(
            [r for r in recipes if r["profession"] == profession_name]
        )

    print(
        f"Current Midnight profession import: {len(recipes)} recipes, "
        f"{len(output_item_ids)} crafted item outputs."
    )
    recraft_count = sum(1 for r in recipes if r.get("isRecraft"))
    embellishment_count = sum(1 for r in recipes if r.get("isEmbellishment"))
    optional_reagent_count = sum(1 for r in recipes if r.get("optionalReagents"))
    modified_slot_count = sum(1 for r in recipes if r.get("modifiedCraftingSlots"))

    print(f"Resolved {fallback_output_count} recipe outputs through item search fallback.")
    print(
        "Crafting metadata: "
        f"{recraft_count} recraft recipes, "
        f"{embellishment_count} embellishment recipes, "
        f"{optional_reagent_count} recipes with optional reagents, "
        f"{modified_slot_count} recipes with modified crafting slots."
    )
    print(f"Profession recipe counts: {profession_counts}")

    return recipes, sorted(output_item_ids)


def fetch_supporting_item_details(token, item_ids):
    """Fetch non-equippable outputs too, such as gems and crafted consumables."""
    records = []

    for index, item_id in enumerate(sorted(set(item_ids)), start=1):
        try:
            data = get_api_json(
                f"/data/wow/item/{item_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
        except urllib.error.HTTPError as error:
            print(f"Skipping supporting item {item_id}: Blizzard returned HTTP {error.code}.")
            continue

        records.append(normalize_item(
            data,
            source="Blizzard Game Data API — current Midnight profession output",
        ))

        if index % 100 == 0:
            print(f"Enriched {index}/{len(item_ids)} supporting recipe outputs.")


    return records


def classify_profession_outputs(recipes, output_items):
    item_by_id = {item.get("id"): item for item in output_items if item.get("id")}
    gems = []
    crafted_gear = []
    other_crafted_items = []

    for recipe in recipes:
        item = item_by_id.get(recipe.get("craftedItemId"))
        if item:
            item_class_id = (item.get("itemClass") or {}).get("id")
            if item_class_id == 3:
                gems.append({**recipe, "item": item})
            elif item.get("isEquippable") and item_class_id in {2, 4}:
                crafted_gear.append({**recipe, "item": item})
            else:
                other_crafted_items.append({**recipe, "item": item})
        elif recipe.get("profession") == "Enchanting":
            other_crafted_items.append(recipe)

    jc_recipes = [r for r in recipes if r.get("profession") == "Jewelcrafting"]
    jc_missing_outputs = [r for r in jc_recipes if not r.get("craftedItemId")]
    jc_class_counts = {}
    jc_subclass_counts = {}
    for recipe in jc_recipes:
        item = item_by_id.get(recipe.get("craftedItemId"))
        if not item:
            continue
        class_key = f"{(item.get("itemClass") or {}).get("id")}:{(item.get("itemClass") or {}).get("name")}"
        subclass_key = f"{(item.get("itemSubclass") or {}).get("id")}:{(item.get("itemSubclass") or {}).get("name")}"
        jc_class_counts[class_key] = jc_class_counts.get(class_key, 0) + 1
        jc_subclass_counts[subclass_key] = jc_subclass_counts.get(subclass_key, 0) + 1

    print(f"Jewelcrafting diagnostic: {len(jc_recipes)} recipes, {len(jc_missing_outputs)} missing craftedItemId.")
    print(f"Jewelcrafting item classes: {jc_class_counts}")
    print(f"Jewelcrafting item subclasses: {jc_subclass_counts}")
    if jc_missing_outputs:
        print("Jewelcrafting recipes without resolved output: " + ", ".join(
            f"{r.get('id')}:{r.get('name')}" for r in jc_missing_outputs[:30]
        ))

    enchants = [r for r in recipes if r.get("profession") == "Enchanting"]

    print(
        f"Supporting data classified: {len(gems)} gems, "
        f"{len(enchants)} enchants, {len(crafted_gear)} crafted gear recipes."
    )

    return gems, enchants, crafted_gear, other_crafted_items


def validate_supporting_catalogs(gems, enchants, consumables):
    """Fail closed on malformed enhancement/consumable records before publishing data.

    This validates catalog structure and source attribution, not whether an item's
    effect is fully modeled by the optimizer. Effect completeness is tracked
    separately and must not be inferred from a recipe name or description.
    """
    catalogs = {
        "gems": gems,
        "enchants": enchants,
        **{
            f"consumables.{bucket}": records
            for bucket, records in (consumables or {}).items()
        },
    }
    errors = []
    for catalog_name, records in catalogs.items():
        if not isinstance(records, list):
            errors.append(f"{catalog_name} must be a list")
            continue
        seen = set()
        for index, record in enumerate(records):
            label = f"{catalog_name}[{index}]"
            if not isinstance(record, dict):
                errors.append(f"{label} must be an object")
                continue
            recipe_id = record.get("id")
            recipe_name = record.get("name")
            if not isinstance(recipe_id, int) or isinstance(recipe_id, bool) or recipe_id <= 0:
                errors.append(f"{label} is missing a valid recipe ID")
            if not isinstance(recipe_name, str) or not recipe_name.strip():
                errors.append(f"{label} is missing a recipe name")
            if record.get("seasonScope") != SEASON_SCOPE:
                errors.append(f"{label} is missing the expected season scope")
            if not isinstance(record.get("source"), str) or not record["source"].strip():
                errors.append(f"{label} is missing source attribution")
            key = (recipe_id, record.get("craftedItemId"))
            if key in seen:
                errors.append(f"{label} duplicates recipe/output pair {key!r}")
            seen.add(key)
            item = record.get("item")
            if item is not None and (
                not isinstance(item, dict)
                or not isinstance(item.get("id"), int)
                or not isinstance(item.get("name"), str)
                or not item["name"].strip()
            ):
                errors.append(f"{label} has malformed linked item metadata")
    if errors:
        raise RuntimeError(
            "Supporting catalog validation failed: " + "; ".join(errors[:20])
        )
    return {
        catalog_name: len(records)
        for catalog_name, records in catalogs.items()
        if isinstance(records, list)
    }


def classify_consumables(recipes, output_items):
    """Build explicit consumable buckets from current-profession recipe outputs.

    Recipe profession is the primary source for food; Blizzard item/recipe names
    are used only to distinguish alchemy consumable families. This is catalog
    classification, not a claim that every item is optimal for every spec.
    """
    item_by_id = {
        item.get("id"): item for item in output_items
        if isinstance(item, dict) and item.get("id")
    }
    buckets = {"food": [], "flaskOrPhial": [], "potions": [], "other": []}

    for recipe in recipes:
        if not isinstance(recipe, dict):
            continue
        item = item_by_id.get(recipe.get("craftedItemId"))
        profession = str(recipe.get("profession") or "").strip().lower()
        item_name = str((item or {}).get("name") or "")
        recipe_name = str(recipe.get("name") or "")
        label = normalize_name(f"{item_name} {recipe_name}")
        item_subclass = str(
            ((item or {}).get("itemSubclass") or {}).get("name")
            or (item or {}).get("itemSubclass")
            or ""
        ).strip().lower()

        bucket = None
        if profession == "cooking":
            bucket = "food"
        elif profession == "alchemy":
            if any(term in label.split() for term in ("flask", "phial")) or "cauldron of" in label:
                bucket = "flaskOrPhial"
            elif "potion" in label or "draught" in label or item_subclass in {"potion", "potions"}:
                bucket = "potions"
            elif any(term in label for term in ("oil", "augment rune", "weapon stone")):
                bucket = "other"
        elif profession == "inscription" and "augment rune" in label:
            bucket = "other"

        if bucket:
            record = {**recipe, "consumableType": bucket}
            if item:
                record["item"] = item
            record["classificationSource"] = (
                "Blizzard profession recipe output; bucketed by profession and localized item/recipe name"
            )
            buckets[bucket].append(record)

    for name, records in buckets.items():
        # A recipe can only appear once in the output model.
        unique = {}
        for record in records:
            key = (record.get("id"), record.get("craftedItemId"), record.get("name"))
            unique[key] = record
        buckets[name] = list(unique.values())

    print(
        "Consumable recipe buckets: "
        + ", ".join(f"{name}={len(records)}" for name, records in buckets.items())
    )
    return buckets

def merge_item_sources(*source_maps):
    merged = {}

    for source_map in source_maps:
        for item_id, sources in source_map.items():
            merged.setdefault(item_id, []).extend(sources)

    return merged


def fetch_item_details(token, item_ids, item_sources):
    items = []
    wowhead_diagnostics = {
        "requestsSucceeded": 0, "usableStats": 0, "emptyTooltip": 0,
        "tooltipWithoutParsedStats": 0, "requestErrors": 0, "retries": 0,
        "responseShapes": {}, "explicitCosmeticItems": set(),
    }

    for index, item_id in enumerate(sorted(item_ids), start=1):
        try:
            data = get_api_json(
                f"/data/wow/item/{item_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
        except urllib.error.HTTPError as error:
            print(f"Skipping item {item_id}: Blizzard returned HTTP {error.code}.")
            continue

        if not data.get("is_equippable"):
            continue

        item = normalize_item(
            data,
            source="Blizzard Game Data API — Season 2+ content source",
        )
        item["seasonScope"] = SEASON_SCOPE
        item["sourceLocations"] = item_sources.get(item_id, [])

        # The in-game tooltip screenshot verifies the Ascendant Venomforged:
        # Myth variant at item level 340 with +147 Haste. Preserve that exact variant.
        if item_id == 270167:
            try:
                variant_stats = fetch_wowhead_tooltip_stats(
                    item_id, wowhead_diagnostics,
                    bonus_ids=[6652, 13335, 12854], item_level=340,
                )
                if variant_stats:
                    item["variants"] = [{
                        "variantKey": "wowhead:6652:13335:12854:ilvl340",
                        "name": item.get("name"),
                        "level": 340,
                        "itemLevel": 340,
                        "description": "Equip: Your spells have a high chance to call to the sea, granting Tidal Insight to increase your Intellect by 65 up to 6 times. After reaching its peak, your spells instead diminish Tidal Insight before beginning the cycle anew.",
                        "stats": variant_stats,
                        "statsSource": "In-game tooltip verified item-level 340 variant; bonus IDs 6652:13335:12854",
                        "variantSource": "Ascendant Venomforged: Myth in-game tooltip, item level 340; bonus IDs 6652:13335:12854",
                        "bonusIds": [6652, 13335, 12854],
                    }]
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as error:
                print(f"Item {item_id}: upgraded Wowhead variant unavailable ({type(error).__name__}).")

        if not item_has_verified_stats(item):
            try:
                fallback_stats = fetch_wowhead_tooltip_stats(item_id, wowhead_diagnostics)
                if fallback_stats:
                    item["stats"] = fallback_stats
                    item["statsSource"] = "Wowhead tooltip (explicit displayed stats)"
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as error:
                print(f"Item {item_id}: no Wowhead stat fallback ({type(error).__name__}).")
        if item_id in wowhead_diagnostics["explicitCosmeticItems"]:
            item["catalogClassification"] = "cosmetic"
            item["classificationSource"] = "Wowhead tooltip explicitly labels item Cosmetic"
        # Verified Wowhead tooltip for Permafrost Essence (250244) contains
        # only its equip proc (temporary Critical Strike and absorb values), not
        # permanent base stats. Keep the record for transparency, but fail closed
        # for numerical optimization until this effect is modeled.
        if item_id == 250244 and not item_has_verified_stats(item):
            item["catalogClassification"] = "effect-only-unmodeled"
            item["classificationSource"] = (
                "Wowhead tooltip for item 250244: equip effect only; no explicit base stats"
            )
            item["optimizerEligible"] = False
        # Mindpiercer's Sigil (250224) has no permanent base stats. Its
        # Wowhead tooltip's 561 Intellect is a temporary 10-second proc, not
        # an equipped stat. If Blizzard did not provide permanent stats and
        # the fallback supplied this value, fail closed for optimization.
        if (
            item_id == 250224
            and item.get("statsSource") == "Wowhead tooltip (explicit displayed stats)"
        ):
            item["stats"] = []
            item["statsSource"] = "Wowhead tooltip (effect-only; excluded from permanent stats)"
            item["catalogClassification"] = "effect-only-unmodeled"
            item["classificationSource"] = (
                "Mindpiercer's Sigil tooltip: temporary Intellect proc only; "
                "no permanent base stats"
            )
            item["optimizerEligible"] = False
        if item_has_verified_stats(item) and "statsSource" not in item:
            item["statsSource"] = "Blizzard Game Data API"
        items.append(item)

        if index % 50 == 0:
            print(f"Enriched {index}/{len(item_ids)} candidate items.")


    print(
        "Wowhead stat fallback diagnostics: "
        f"{wowhead_diagnostics['requestsSucceeded']} responses, "
        f"{wowhead_diagnostics['usableStats']} with parsed stats, "
        f"{wowhead_diagnostics['emptyTooltip']} empty tooltips, "
        f"{wowhead_diagnostics['tooltipWithoutParsedStats']} tooltips with no recognized stats, "
        f"{wowhead_diagnostics['requestErrors']} request errors, "
        f"{wowhead_diagnostics['retries']} retries; "
        f"{len(wowhead_diagnostics['explicitCosmeticItems'])} explicitly cosmetic items; "
        f"response shapes={json.dumps(wowhead_diagnostics['responseShapes'], sort_keys=True)}."
    )
    return items



def collect_upgrade_and_crest_data(as_of=None):
    """Build explicit Midnight Season 2 upgrade-track and crest rules.

    Blizzard's public Game Data API does not expose a complete seasonal
    upgrade-track catalog as a single resource, so keep the seasonal ladder
    explicit and versioned rather than inferring it from item level alone.
    """
    effective_at = as_of or datetime.now(timezone.utc)
    crest_cap_lifted = effective_at >= CREST_CAP_LIFT_DATE
    weekly_crest_cap = None if crest_cap_lifted else CREST_WEEKLY_CAP_BEFORE_LIFT
    crest_cap_status = "lifted" if crest_cap_lifted else "active"

    tracks = [
        {
            "id": "adventurer",
            "name": "Adventurer",
            "crest": "Adventurer Mistcrest",
            "ranks": [266, 270, 273, 276, 279, 282],
            "maxRank": 6,
        },
        {
            "id": "veteran",
            "name": "Veteran",
            "crest": "Veteran Mistcrest",
            "ranks": [279, 283, 286, 289, 292, 295],
            "maxRank": 6,
        },
        {
            "id": "champion",
            "name": "Champion",
            "crest": "Champion Mistcrest",
            "ranks": [292, 296, 299, 302, 305, 308],
            "maxRank": 6,
        },
        {
            "id": "hero",
            "name": "Hero",
            "crest": "Hero Mistcrest",
            "ranks": [305, 309, 312, 315, 318, 321],
            "maxRank": 6,
        },
        {
            "id": "myth",
            "name": "Myth",
            "crest": "Myth Mistcrest",
            "ranks": [318, 322, 325, 328, 331, 334],
            "maxRank": 6,
        },
    ]

    for track in tracks:
        track["seasonScope"] = SEASON_SCOPE
        track["crestCostPerUpgrade"] = 20
        track["weeklyCrestCap"] = weekly_crest_cap
        track["itemLevelMin"] = track["ranks"][0]
        track["itemLevelMax"] = track["ranks"][-1]
        track["rankCount"] = len(track["ranks"])
        track["rankItemLevels"] = [
            {"rank": index + 1, "itemLevel": item_level}
            for index, item_level in enumerate(track["ranks"])
        ]

    crests = [
        {
            "id": "adventurer-mistcrest",
            "name": "Adventurer Mistcrest",
            "track": "Adventurer",
            "itemLevelRange": [269, 282],
            "source": "Midnight Season 2 upgrade currency",
        },
        {
            "id": "veteran-mistcrest",
            "name": "Veteran Mistcrest",
            "track": "Veteran",
            "itemLevelRange": [282, 295],
            "source": "Midnight Season 2 upgrade currency",
        },
        {
            "id": "champion-mistcrest",
            "name": "Champion Mistcrest",
            "track": "Champion",
            "itemLevelRange": [295, 308],
            "source": "Midnight Season 2 upgrade currency",
        },
        {
            "id": "hero-mistcrest",
            "name": "Hero Mistcrest",
            "track": "Hero",
            "itemLevelRange": [308, 321],
            "source": "Midnight Season 2 upgrade currency",
        },
        {
            "id": "myth-mistcrest",
            "name": "Myth Mistcrest",
            "track": "Myth",
            "itemLevelRange": [321, 334],
            "source": "Midnight Season 2 upgrade currency",
        },
    ]

    exchange_rules = [
        {
            "from": "Adventurer Mistcrest",
            "to": "Veteran Mistcrest",
            "ratio": "3:1",
            "requirement": "Adventurer of the Mist",
        },
        {
            "from": "Veteran Mistcrest",
            "to": "Champion Mistcrest",
            "ratio": "3:1",
            "requirement": "Veteran of the Mist",
        },
        {
            "from": "Champion Mistcrest",
            "to": "Hero Mistcrest",
            "ratio": "3:1",
            "requirement": "Champion of the Mist",
        },
        {
            "from": "Hero Mistcrest",
            "to": "Myth Mistcrest",
            "ratio": "3:1",
            "requirement": "Hero of the Mist",
        },
    ]

    ascendant_venomstone = {
        "name": "Ascendant Venomstone",
        "status": "planned-season-2-feature",
        "cost": 10,
        "eligibleSlots": ["Neck", "Trinket 1", "Trinket 2", "Main Hand", "Off Hand"],
        "eligibleTracks": ["Hero", "Myth"],
        "requiresFullyUpgradedTrack": True,
        "requiresMaximumQualityTidalCrafted": True,
        "seasonScope": SEASON_SCOPE,
        "notes": [
            "Uses 10 Ascendant Venomstones per eligible upgrade.",
            "Only fully upgraded Season 2 Hero/Myth gear or maximum-quality Tidal Crafted gear is eligible.",
            "The resulting item-level increase is intentionally not hardcoded until the live data is stable.",
        ],
    }

    print(
        f"Upgrade data: {len(tracks)} tracks, "
        f"{len(crests)} crests, {len(exchange_rules)} crest exchange rules."
    )
    print(
        "Upgrade ladder item levels: "
        + "; ".join(
            f"{track['name']} {track['ranks'][0]}-{track['ranks'][-1]}"
            for track in tracks
        )
    )

    return {
        "tracks": tracks,
        "crests": crests,
        "exchangeRules": exchange_rules,
        "ascendantVenomstone": ascendant_venomstone,
        "weeklyCrestCap": weekly_crest_cap,
        "crestCapStatus": crest_cap_status,
        "crestCapLiftDate": CREST_CAP_LIFT_DATE.date().isoformat(),
        "crestCapSource": "Blizzard Entertainment — Midnight 12.1.5 Content Update",
        "seasonScope": SEASON_SCOPE,
        "source": "Midnight Season 2 upgrade rules",
    }


def item_has_verified_stats(item):
    """Return true only when an item record contains at least one non-zero numeric stat."""
    stats = item.get("stats")
    if isinstance(stats, dict):
        values = stats.values()
    elif isinstance(stats, list):
        values = (
            entry.get("value")
            for entry in stats
            if isinstance(entry, dict) and entry.get("value") is not None
        )
    else:
        return False

    for value in values:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if numeric != 0:
            return True
    return False


def build_item_stat_coverage(items):
    """Report actual stat-data coverage; item level/name are never treated as stat data."""
    # Cosmetics are valid catalog records but are not combat-stat candidates.
    # Only explicit source classification excludes them; unknown records stay in the strict gate.
    candidates = [
        item for item in items
        if not (
            isinstance(item, dict)
            and item.get("catalogClassification") in {"cosmetic", "effect-only-unmodeled"}
        )
    ]
    total = len(candidates)
    verified = sum(1 for item in candidates if item_has_verified_stats(item))
    missing = total - verified
    coverage_percent = round((verified / total) * 100, 2) if total else 0.0
    coverage_policy = (
        "Record-presence metric only: at least one non-zero numeric stat exists in the source item record. "
        "This does not prove that every expected stat, weapon property, socket, set bonus, or item effect is present. "
        "Item level alone does not qualify."
    )
    return {
        "candidateItemCount": total,
        # Keep the original keys for compatibility with existing consumers.
        "itemsWithVerifiedStats": verified,
        "itemsMissingVerifiedStats": missing,
        "itemStatCoveragePercent": coverage_percent,
        # Explicit names prevent this presence metric from being mistaken for full stat completeness.
        "itemsWithAnyNumericStats": verified,
        "itemsMissingAnyNumericStats": missing,
        "itemRecordsWithAnyNumericStatsPercent": coverage_percent,
        "coveragePolicy": coverage_policy,
        "coverageMetricType": "source-record-stat-presence-not-completeness",
    }



def _has_explicit_effect_metadata(record):
    """Return true only when a source record contains structured effect fields.

    This is a metadata-presence check, not proof that an effect is complete or
    numerically simulatable. Text descriptions alone are not treated as data.
    """
    if not isinstance(record, dict):
        return False

    item = record.get("item") if isinstance(record.get("item"), dict) else record
    stats = item.get("stats")
    has_stats = (
        any(
            isinstance(entry, dict)
            and isinstance(entry.get("value"), (int, float))
            and not isinstance(entry.get("value"), bool)
            and entry.get("value") != 0
            for entry in stats
        )
        if isinstance(stats, list)
        else (
            any(
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and value != 0
                for value in stats.values()
            )
            if isinstance(stats, dict)
            else False
        )
    )
    spells = item.get("spells")
    has_spells = isinstance(spells, list) and len(spells) > 0
    has_explicit_effect = any(
        key in record or key in item
        for key in ("effect", "effectValue", "statModifiers", "bonusStats")
    )
    return has_stats or has_spells or has_explicit_effect


def build_enhancement_effect_coverage(gems, enchants, crafted_gear, other_outputs, consumables=None):
    """Measure structured effect-metadata presence, not effect completeness."""
    consumables = consumables if isinstance(consumables, dict) else {}
    categories = {
        "gems": gems or [],
        "enchants": enchants or [],
        "craftedGear": crafted_gear or [],
        "consumables.food": consumables.get("food", []),
        "consumables.flaskOrPhial": consumables.get("flaskOrPhial", []),
        "consumables.potions": consumables.get("potions", []),
        "consumables.other": consumables.get("other", []),
        "otherCraftedOutputs": other_outputs or [],
    }
    result = {}
    total = 0
    with_metadata = 0
    for name, records in categories.items():
        count = len(records)
        covered = sum(1 for record in records if _has_explicit_effect_metadata(record))
        total += count
        with_metadata += covered
        result[name] = {
            "candidateCount": count,
            "recordsWithStructuredEffectMetadata": covered,
            "recordsMissingStructuredEffectMetadata": count - covered,
            "structuredEffectMetadataPresencePercent": round(covered / count * 100, 2) if count else 0.0,
        }

    result["total"] = {
        "candidateCount": total,
        "recordsWithStructuredEffectMetadata": with_metadata,
        "recordsMissingStructuredEffectMetadata": total - with_metadata,
        "structuredEffectMetadataPresencePercent": round(with_metadata / total * 100, 2) if total else 0.0,
    }
    result["metricType"] = "structured-effect-metadata-presence-not-completeness"
    result["policy"] = (
        "Presence of source stats, spell records, or explicit structured effect fields only. "
        "This does not prove the effect is complete, correctly quantified, active in the current patch, "
        "or supported by the projection engine. Descriptions and recipe reagents alone do not qualify."
    )
    return result


def main():
    client_id = os.environ.get("BLIZZARD_CLIENT_ID")
    client_secret = os.environ.get("BLIZZARD_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET GitHub secrets.")
        sys.exit(1)

    token = get_access_token(client_id, client_secret)

    item_classes = get_api_json(
        "/data/wow/item-class/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )

    current_pvp_season_id, current_pvp_season_name = discover_current_pvp_season(token)
    print(f"Blizzard current PvP season: {current_pvp_season_name} (id {current_pvp_season_id})")
    enforce_supported_season(current_pvp_season_id, current_pvp_season_name)

    print("Import phase 1/7: collecting Midnight profession recipes.", flush=True)
    profession_recipes, profession_output_ids = collect_profession_supporting_data(token)
    print(f"Import phase 2/7: enriching {len(profession_output_ids)} profession output items.", flush=True)
    supporting_items = fetch_supporting_item_details(token, profession_output_ids)
    gems, enchants, crafted_gear, other_crafted_items = classify_profession_outputs(
        profession_recipes,
        supporting_items,
    )
    consumables = classify_consumables(profession_recipes, supporting_items)
    supporting_catalog_counts = validate_supporting_catalogs(gems, enchants, consumables)
    print("Supporting catalog structural validation passed: " + ", ".join(f"{name}={count}" for name, count in supporting_catalog_counts.items()))

    print("Import phase 3/7: scanning Season 2 PvE Journal sources.", flush=True)
    pve_sources, matched_instances, missing_sources = collect_season_content_item_ids(token)
    print("Import phase 4/7: collecting Season 2 PvP rewards and gear.", flush=True)
    pvp_sources, pvp_metadata = collect_pvp_season_item_ids(
        token, current_pvp_season_id, current_pvp_season_name
    )
    # Slot searches are NOT season-aware. Only IDs independently verified from
    # current-season PvE/PvP sources or Midnight profession recipes may enter.
    crafted_gear_ids = {
        recipe.get("item", {}).get("id")
        for recipe in crafted_gear
        if isinstance(recipe.get("item"), dict)
        and isinstance(recipe.get("item", {}).get("id"), int)
    }
    crafted_source_map = {
        item_id: [{
            "seasonScope": SEASON_SCOPE,
            "category": "Crafted Gear",
            "professionRecipeSource": "Midnight profession skill-tier recipe output",
        }]
        for item_id in crafted_gear_ids
    }
    verified_season_item_ids = set(pve_sources) | set(pvp_sources) | crafted_gear_ids
    print(
        "Verified equipment source counts: "
        f"pve_ids={len(pve_sources)}; "
        f"pvp_ids={len(pvp_sources)}; "
        f"crafted_gear_ids={len(crafted_gear_ids)}; "
        f"union_ids={len(verified_season_item_ids)}; "
        f"sample_union_ids={sorted(verified_season_item_ids)[:12]}"
    )
    verified_source_evidence = merge_item_sources(
        pve_sources, pvp_sources, crafted_source_map
    )
    print("Import phase 5/7: discovering eligible equipment sections.", flush=True)
    section_ids, section_item_sources = collect_equipment_section_ids(
        token, get_api_json, verified_season_item_ids,
        source_evidence=verified_source_evidence,
    )
    # Validate the entire expected slot set before writing any section files.
    # A missing Neck/Shoulders result must stop the import rather than leave a
    # stale catalog in place or publish a partially refreshed set of sections.
    validate_required_sections(section_ids)
    print(
        "Sectioned equipment catalog discovered: "
        + ", ".join(f"{section}={len(ids)}" for section, ids in section_ids.items())
    )
    item_sources = merge_item_sources(pve_sources, pvp_sources, crafted_source_map, section_item_sources)

    # Process one slot section at a time: enrich only that section's verified
    # candidates, validate it, and atomically persist it before starting the next.
    # A failure stops the import without marking later sections as complete.
    section_summary = {}
    items_by_id = {}
    for section, ids in section_ids.items():
        section_ids_with_sources = {
            item_id: item_sources.get(item_id, [])
            for item_id in ids
        }
        print(f"Starting section {section}: {len(ids)} verified candidates.")
        section_items = fetch_item_details(
            token, ids, section_ids_with_sources
        )
        section_result = write_section_catalogs(
            {section: ids}, section_items, remove_stale=False
        )
        section_summary.update(section_result)
        items_by_id.update({item.get("id"): item for item in section_items if item.get("id")})
        print(f"Completed section {section}: {section_result.get(section, 0)} items saved.")

    # Signal that every section completed enrichment, validation, and atomic write.
    # GitHub Actions can safely publish these independently even if a later phase
    # (such as talent ingestion) fails; the unified dataset remains fail-closed.
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            handle.write("gear_sections_validated=true\n")

    # Keep the unified dataset limited to the same verified slot-section IDs.
    items = list(items_by_id.values())

    print("Import phase 6/7: collecting talent data.", flush=True)
    talent_data = collect_talent_data(token)
    # Talent data is a required part of the optimizer input. Never publish a
    # successful-looking dataset if the Blizzard payload shape/namespace has
    # yielded no usable nodes; preserve the last known-good file instead.
    if not talent_data.get("specializationCount") or not talent_data.get("treeCount") or not talent_data.get("nodeCount"):
        raise RuntimeError(
            "Talent import validation failed: expected nonzero specialization, "
            "tree, and node counts; refusing to publish an incomplete dataset."
        )
    print("Import phase 7/7: assembling and validating the dataset.", flush=True)
    upgrade_data = collect_upgrade_and_crest_data()

    items.sort(
        key=lambda item: (item.get("level") or 0, item.get("id") or 0),
        reverse=True,
    )

    stat_coverage = build_item_stat_coverage(items)
    enhancement_effect_coverage = build_enhancement_effect_coverage(
        gems, enchants, crafted_gear, other_crafted_items, consumables
    )
    print(
        "Enhancement effect metadata presence: "
        f"{enhancement_effect_coverage['total']['recordsWithStructuredEffectMetadata']}/"
        f"{enhancement_effect_coverage['total']['candidateCount']} "
        f"({enhancement_effect_coverage['total']['structuredEffectMetadataPresencePercent']}%) "
        "have structured effect metadata; this is not completeness coverage."
    )
    print(
        "Item stat coverage: "
        f"{stat_coverage['itemsWithVerifiedStats']}/{stat_coverage['candidateItemCount']} "
        f"({stat_coverage['itemStatCoveragePercent']}%) have verified numeric stats; "
        f"{stat_coverage['itemsMissingVerifiedStats']} remain incomplete."
    )

    with open(OUTPUT, "r", encoding="utf-8") as handle:
        dataset = json.load(handle)

    dataset["status"] = "season-2-plus-source-imported"
    dataset["source"] = "Blizzard Game Data API"
    dataset["updatedAt"] = datetime.now(timezone.utc).isoformat()
    dataset["items"] = items
    dataset["season"] = MINIMUM_SEASON
    dataset["gems"] = gems
    dataset["enchants"] = enchants
    dataset["consumables"] = consumables
    dataset["crafting"] = {
        "recipes": profession_recipes,
        "craftedGear": crafted_gear,
        "otherOutputs": other_crafted_items,
        "source": "Blizzard Game Data API",
        "seasonScope": SEASON_SCOPE,
    }

    dataset["talents"] = talent_data
    # Stat weights are intentionally not inferred from Blizzard metadata.
    # Verified optimization profiles can be added separately and are keyed
    # to these exact class/spec records.
    dataset["optimizationProfiles"] = dataset.get("optimizationProfiles") or {}
    dataset["upgrades"] = upgrade_data["tracks"]
    dataset["upgradeSystem"] = upgrade_data

    dataset["pvp"] = [{
        "season": pvp_metadata["name"],
        "seasonId": pvp_metadata["id"],
        "rewardItemCount": pvp_metadata["rewardCount"],
        "source": "Blizzard Game Data API",
    }]

    dataset["apiCheck"] = {
        "itemClassCount": len(item_classes.get("item_classes", [])),
        "namespace": NAMESPACE,
        "gearItemCount": len(items),
        "candidateItemCount": len(item_sources),
        "itemStatCoverage": stat_coverage,
        "enhancementEffectCoverage": enhancement_effect_coverage,
        "pveCandidateItemCount": len(pve_sources),
        "pvpCandidateItemCount": len(pvp_sources),
        "matchedPvEInstances": matched_instances,
        "missingPvESources": missing_sources,
        "pvpSeason": pvp_metadata,
        "talentSpecializationCount": talent_data["specializationCount"],
        "talentTreeCount": talent_data["treeCount"],
        "talentNodeCount": talent_data["nodeCount"],
        "apexReferenceCount": talent_data["apexReferenceCount"],
        "professionRecipeCount": len(profession_recipes),
        "craftedOutputItemCount": len(profession_output_ids),
        "gemRecipeCount": len(gems),
        "enchantRecipeCount": len(enchants),
        "foodRecipeCount": len(consumables["food"]),
        "flaskOrPhialRecipeCount": len(consumables["flaskOrPhial"]),
        "potionRecipeCount": len(consumables["potions"]),
        "otherConsumableRecipeCount": len(consumables["other"]),
        "craftedGearRecipeCount": len(crafted_gear),
        "recraftRecipeCount": sum(1 for r in profession_recipes if r.get("isRecraft")),
        "embellishmentRecipeCount": sum(1 for r in profession_recipes if r.get("isEmbellishment")),
        "optionalReagentRecipeCount": sum(1 for r in profession_recipes if r.get("optionalReagents")),
        "modifiedCraftingSlotRecipeCount": sum(1 for r in profession_recipes if r.get("modifiedCraftingSlots")),
        "upgradeTrackCount": len(upgrade_data["tracks"]),
        "crestTypeCount": len(upgrade_data["crests"]),
        "crestExchangeRuleCount": len(upgrade_data["exchangeRules"]),
        "ascendantVenomstoneStatus": upgrade_data["ascendantVenomstone"]["status"],
        "importPhase": "sectioned-equipment-catalog-plus-season-pve-pvp-talents-professions-upgrades",
        "equipmentSectionCounts": section_summary,
        "seasonPolicy": SEASON_SCOPE,
    }

    dataset["notes"] = [
        "Generated from the secure Blizzard Game Data API importer.",
        "Blizzard API credentials are never placed in browser JavaScript.",
        "Equipment catalog items are fetched from Blizzard item search in independently paginated slot sections and stored under data/equipment-sections/.",
        "Each equipment section is atomically replaced only after every discovered item has an enriched, equippable record; incomplete sections preserve the prior section file and fail the import.",
        "Season membership is source-based, not guessed from item level.",
        "Item stat coverage is a source-record presence metric, not proof of complete item stat/effect coverage; missing stats are reported and never inferred from item level.",
        "Season 2 PvE candidates come from matched Adventure Journal sources.",
        "Season 2 PvP candidates come from Blizzard's PvP Season 2 reward API.",
        "Current Midnight profession recipes are imported for gems, enchants, crafted gear, and other crafted outputs.",
        "Midnight Season 2 upgrade tracks, Mistcrests, exchange rules, and Ascendant Venomstone eligibility are stored explicitly; upgrade tracks are not inferred from item level.",
        "Unified item records retain their source category so the optimizer can distinguish PvE and PvP gear.",
        "Season 2+ additions such as Kith'ix and Labyrinth of Kindo'jan are added when Blizzard exposes their reward data.",
        "Crafted, vendor, outdoor, Delves, Prey, and other non-Journal sources require their own source-specific importers; they are not silently approximated as Season 2 gear.",
    ]

    # Replace the unified dataset only after the full import has been assembled.
    # A write/serialization failure must leave the last completed file intact.
    output_dir = os.path.dirname(OUTPUT) or "."
    fd, temporary_name = tempfile.mkstemp(
        prefix=".current-retail.", suffix=".tmp", dir=output_dir
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(dataset, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        # Validate the staged JSON before making it the current dataset.
        with open(temporary_name, "r", encoding="utf-8") as handle:
            staged_dataset = json.load(handle)
        if not isinstance(staged_dataset, dict) or not isinstance(staged_dataset.get("items"), list):
            raise RuntimeError("Staged current Retail dataset failed structural validation.")
        os.replace(temporary_name, OUTPUT)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)

    print(
        f"Season 2+ Retail gear import completed: {len(items)} enriched items "
        f"from {len(item_sources)} unified PvE/PvP source candidates."
    )


if __name__ == "__main__":
    main()
