import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_BASE = "https://us.api.blizzard.com"
TOKEN_URL = "https://oauth.battle.net/token"
OUTPUT = "data/current-retail.json"
NAMESPACE = "static-us"
PVP_NAMESPACE = "dynamic-us"
LOCALE = "en_US"
REQUEST_DELAY_SECONDS = 0.15
MAX_RETRIES = 4

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
    "Kings' Rest",
    "Temple of Sethraliss",
    "Ruby Life Pools",
    "The Tidebound Grotto",
}


def request_json(url, headers=None, data=None):
    request = urllib.request.Request(
        url,
        headers=headers or {},
        data=data,
        method="POST" if data is not None else "GET",
    )
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code >= 500 and attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                print(f"Blizzard API returned HTTP {error.code}; retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                print(f"Blizzard API request failed ({error}); retrying in {wait}s...")
                time.sleep(wait)
                continue
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


def normalize_inventory_slot(data):
    """Map Blizzard inventory types to optimizer slots without guessing unknown types."""
    inventory_type = data.get("inventory_type") or {}
    inventory_name = normalize_name(localized_name(inventory_type.get("name")) if isinstance(inventory_type, dict) else inventory_type)
    slot_map = {
        "head": ("Head", ["Head"]),
        "neck": ("Neck", ["Neck"]),
        "shoulder": ("Shoulders", ["Shoulders"]),
        "shoulders": ("Shoulders", ["Shoulders"]),
        "cloak": ("Back", ["Back"]),
        "back": ("Back", ["Back"]),
        "chest": ("Chest", ["Chest"]),
        "robe": ("Chest", ["Chest"]),
        "wrist": ("Wrists", ["Wrists"]),
        "wrists": ("Wrists", ["Wrists"]),
        "hands": ("Hands", ["Hands"]),
        "hand": ("Hands", ["Hands"]),
        "waist": ("Waist", ["Waist"]),
        "legs": ("Legs", ["Legs"]),
        "feet": ("Feet", ["Feet"]),
        "finger": ("Ring 1", ["Ring 1", "Ring 2"]),
        "ring": ("Ring 1", ["Ring 1", "Ring 2"]),
        "trinket": ("Trinket 1", ["Trinket 1", "Trinket 2"]),
        "weapon": ("Main Hand", ["Main Hand"]),
        "main hand": ("Main Hand", ["Main Hand"]),
        "two-hand": ("Main Hand", ["Main Hand"]),
        "two handed": ("Main Hand", ["Main Hand"]),
        "2h weapon": ("Main Hand", ["Main Hand"]),
        "off hand": ("Off Hand", ["Off Hand"]),
        "held in off-hand": ("Off Hand", ["Off Hand"]),
        "shield": ("Off Hand", ["Off Hand"]),
        "holdable": ("Off Hand", ["Off Hand"]),
    }
    return slot_map.get(inventory_name, (None, []))


OPTIMIZER_EQUIPMENT_SLOTS = {
    "Head", "Neck", "Shoulders", "Back", "Chest", "Wrists", "Hands",
    "Waist", "Legs", "Feet", "Ring 1", "Ring 2", "Trinket 1",
    "Trinket 2", "Main Hand", "Off Hand",
}


def filter_optimizer_items(items):
    """Keep only uniquely identified, named items mapped to supported gear slots.

    Blizzard candidate pools can contain bags, tabards, and other non-slot items.
    They are not optimizer gear and must not invalidate the entire published dataset.
    Unknown inventory types are excluded rather than assigned a guessed slot.
    """
    filtered = []
    seen_ids = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        item_id = item.get("id")
        slot = item.get("slot")
        compatible_slots = item.get("compatibleSlots")
        if item_id is None or not str(item.get("name") or "").strip():
            continue
        if slot not in OPTIMIZER_EQUIPMENT_SLOTS:
            continue
        if not isinstance(compatible_slots, list) or slot not in compatible_slots:
            continue
        if any(candidate not in OPTIMIZER_EQUIPMENT_SLOTS for candidate in compatible_slots):
            continue
        normalized_id = str(item_id)
        if normalized_id in seen_ids:
            continue
        seen_ids.add(normalized_id)
        filtered.append(item)
    return filtered


def normalize_item(data, source=None):
    quality = data.get("quality") or {}
    item_class = data.get("item_class") or {}
    item_subclass = data.get("item_subclass") or {}
    inventory_type = data.get("inventory_type") or {}
    slot, compatible_slots = normalize_inventory_slot(data)

    return {
        "id": data.get("id"),
        "slot": slot,
        "compatibleSlots": compatible_slots,
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
        "stats": data.get("stats", []),
        "spells": data.get("spells", []),
        "set": data.get("set"),
        "description": data.get("description"),
        "media": data.get("media"),
        "source": source or "Blizzard Game Data API",
    }


def get_season_instances(token):
    response = get_api_json(
        "/data/wow/journal-instance/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    return response.get("journal_instances") or response.get("instances") or []


def collect_season_content_item_ids(token):
    item_sources = {}
    matched_instances = []
    missing_sources = []
    encounter_count = 0

    wanted = {normalize_name(name): name for name in SEASON_CONTENT_NAMES}
    instances = get_season_instances(token)

    print(f"Blizzard Journal instance index returned {len(instances)} instances.")

    for instance_ref in instances:
        instance_id = extract_id(instance_ref)
        instance_name = localized_name(instance_ref.get("name")) if isinstance(instance_ref, dict) else None
        canonical = normalize_name(instance_name)

        if canonical not in wanted or not instance_id:
            continue

        matched_instances.append(instance_name)

        instance = get_api_json(
            f"/data/wow/journal-instance/{instance_id}",
            token,
            {"namespace": NAMESPACE, "locale": LOCALE},
        )

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

            time.sleep(REQUEST_DELAY_SECONDS)

        time.sleep(REQUEST_DELAY_SECONDS)

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
    """Extract an ID from Blizzard references, including key.href-only references."""
    if isinstance(value, int):
        return value
    if isinstance(value, dict):
        value_id = value.get("id")
        if isinstance(value_id, int):
            return value_id

        for candidate in (value.get("href"), (value.get("key") or {}).get("href")):
            if candidate:
                # Talent-tree references commonly expose the ID only inside key.href.
                parts = str(candidate).rstrip("/").split("/")
                for part in reversed(parts):
                    try:
                        return int(part.split("?")[0])
                    except ValueError:
                        continue
    return None


def talent_tree_reference_parts(value):
    """Extract tree and optional specialization IDs from Blizzard talent-tree references."""
    if isinstance(value, int):
        return value, None
    if isinstance(value, dict):
        candidates = (value.get("href"), (value.get("key") or {}).get("href"))
        for candidate in candidates:
            if not candidate:
                continue
            parts = str(candidate).split("?")[0].rstrip("/").split("/")
            for index, part in enumerate(parts[:-1]):
                if part != "talent-tree":
                    continue
                try:
                    tree_id = int(parts[index + 1])
                except (ValueError, IndexError):
                    continue
                spec_id = None
                for spec_index, segment in enumerate(parts[:-1]):
                    if segment == "playable-specialization":
                        try:
                            spec_id = int(parts[spec_index + 1])
                        except (ValueError, IndexError):
                            spec_id = None
                        break
                return tree_id, spec_id
        value_id = value.get("id")
        if isinstance(value_id, int):
            return value_id, None
    return None, None


def talent_tree_reference_id(value):
    """Extract the tree ID from a Blizzard talent-tree reference."""
    return talent_tree_reference_parts(value)[0]


def extract_talent_nodes(tree_data):
    """Read talent nodes across Blizzard response field variants without inventing data."""
    if not isinstance(tree_data, dict):
        return []
    for field in ("nodes", "talent_nodes", "class_talent_nodes", "spec_talent_nodes", "hero_talent_nodes"):
        value = tree_data.get(field)
        if isinstance(value, list) and value:
            return value
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
            hero_id = talent_tree_reference_id(hero_ref)
            if hero_id:
                hero_records.append({
                    "id": hero_id,
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
        time.sleep(REQUEST_DELAY_SECONDS)

    tree_index = get_api_json(
        "/data/wow/talent-tree/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    tree_ref_groups = [
        ("specialization", tree_index.get("spec_talent_trees") or []),
        ("hero", tree_index.get("hero_talent_trees") or []),
        ("class", tree_index.get("class_talent_trees") or []),
        ("specialization", tree_index.get("talent_trees") or tree_index.get("trees") or []),
    ]

    tree_records = []
    seen_tree_keys = set()

    def add_tree(tree_id, tree_type, spec_id=None):
        if not tree_id:
            return
        key = (tree_type, tree_id, spec_id)
        if key in seen_tree_keys:
            return
        seen_tree_keys.add(key)

        try:
            # Fetch the canonical tree resource. The specialization-scoped route
            # can return 404 even for valid references; the canonical tree route
            # exposes nodes and specialization links for the tree ID.
            tree = get_api_json(
                f"/data/wow/talent-tree/{tree_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
        except urllib.error.HTTPError as error:
            print(
                f"Talent tree {tree_id} ({tree_type}, spec {spec_id}) "
                f"returned HTTP {error.code}; skipping."
            )
            return

        tree_records.append({
            "id": tree_id,
            "type": tree_type,
            "specId": spec_id,
            "data": tree,
            "seasonScope": SEASON_SCOPE,
        })
        time.sleep(REQUEST_DELAY_SECONDS)

    for record in talent_records:
        add_tree(record["specTalentTreeId"], "specialization", record["id"])
        for hero in record["heroTalentTrees"]:
            add_tree(hero["id"], "hero", record["id"])

    for tree_type, tree_refs in tree_ref_groups:
        for tree_ref in tree_refs:
            tree_id, linked_spec_id = talent_tree_reference_parts(tree_ref)
            if not tree_id:
                continue
            if tree_type == "class":
                add_tree(tree_id, "class")
                continue
            if linked_spec_id in spec_ids:
                add_tree(tree_id, tree_type, linked_spec_id)
                continue
            linked_specs = (
                tree_ref.get("playable_specializations")
                or tree_ref.get("specializations")
                or []
            ) if isinstance(tree_ref, dict) else []
            for spec_ref in linked_specs:
                fallback_spec_id = reference_id(spec_ref)
                if fallback_spec_id in spec_ids:
                    add_tree(tree_id, tree_type, fallback_spec_id)

    node_count = 0
    apex_count = 0
    for tree in tree_records:
        data = tree.get("data") or {}
        nodes = extract_talent_nodes(data)
        node_count += len(nodes)
        for node in nodes:
            if "apex" in json.dumps(node, ensure_ascii=False).lower():
                apex_count += 1

    print(
        f"Talent import: {len(talent_records)} specializations, "
        f"{len(tree_records)} talent trees, {node_count} nodes, "
        f"{apex_count} nodes referencing Apex data."
    )

    if not talent_records:
        raise RuntimeError(
            "Blizzard returned no usable Retail specializations; refusing to publish incomplete talent data."
        )
    if not tree_records or node_count == 0:
        raise RuntimeError(
            "Blizzard returned no usable Retail talent trees or nodes; refusing to publish incomplete talent data."
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

            time.sleep(REQUEST_DELAY_SECONDS)

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

                time.sleep(REQUEST_DELAY_SECONDS)

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

    for profession_ref in profession_refs:
        profession_id = extract_id(profession_ref)
        profession_name = localized_name(profession_ref.get("name")) if isinstance(profession_ref, dict) else None
        if not profession_id or profession_name not in profession_names:
            continue

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

        for tier_id, tier_name in current_tiers:
            skill_tier = get_api_json(
                f"/data/wow/profession/{profession_id}/skill-tier/{tier_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )

            for category in skill_tier.get("categories", []) or []:
                category_name = localized_name(category.get("name")) or ""
                for recipe_ref in category.get("recipes", []) or []:
                    recipe_id = extract_id(recipe_ref)
                    if not recipe_id:
                        continue

                    recipe = get_api_json(
                        f"/data/wow/recipe/{recipe_id}",
                        token,
                        {"namespace": NAMESPACE, "locale": LOCALE},
                    )

                    crafted_item = recipe.get("crafted_item") or {}
                    crafted_item_id = extract_id(crafted_item)
                    if recipe_id == 52572:
                        print("QUICK PERIDOT RECIPE DEBUG:")
                        print(json.dumps(recipe, indent=2))

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
                    time.sleep(REQUEST_DELAY_SECONDS)

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

        time.sleep(REQUEST_DELAY_SECONDS)

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

def merge_item_sources(*source_maps):
    merged = {}

    for source_map in source_maps:
        for item_id, sources in source_map.items():
            merged.setdefault(item_id, []).extend(sources)

    return merged


def fetch_item_details(token, item_ids, item_sources):
    items = []

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

        slot, compatible_slots = normalize_inventory_slot(data)
        if not slot:
            inventory_type = localized_name((data.get("inventory_type") or {}).get("name"))
            print(
                f"Skipping equippable item {item_id} with unsupported inventory type "
                f"{inventory_type!r}; it cannot be safely assigned to an optimizer slot."
            )
            continue

        item = normalize_item(
            data,
            source="Blizzard Game Data API — Season 2+ content source",
        )
        item["slot"] = slot
        item["compatibleSlots"] = compatible_slots
        item["seasonScope"] = SEASON_SCOPE
        item["sourceLocations"] = item_sources.get(item_id, [])
        items.append(item)

        if index % 50 == 0:
            print(f"Enriched {index}/{len(item_ids)} candidate items.")

        time.sleep(REQUEST_DELAY_SECONDS)

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
            "ranks": [266, 269, 272, 276, 279, 282],
            "maxRank": 6,
        },
        {
            "id": "veteran",
            "name": "Veteran",
            "crest": "Veteran Mistcrest",
            "ranks": [279, 282, 285, 289, 292, 295],
            "maxRank": 6,
        },
        {
            "id": "champion",
            "name": "Champion",
            "crest": "Champion Mistcrest",
            "ranks": [292, 295, 298, 302, 305, 308],
            "maxRank": 6,
        },
        {
            "id": "hero",
            "name": "Hero",
            "crest": "Hero Mistcrest",
            "ranks": [305, 308, 311, 315, 318, 321],
            "maxRank": 6,
        },
        {
            "id": "myth",
            "name": "Myth",
            "crest": "Myth Mistcrest",
            "ranks": [318, 321, 324, 328, 331, 334],
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

    pve_sources, matched_instances, missing_sources = collect_season_content_item_ids(token)
    pvp_sources, pvp_metadata = collect_pvp_season_item_ids(
        token, current_pvp_season_id, current_pvp_season_name
    )
    item_sources = merge_item_sources(pve_sources, pvp_sources)

    talent_data = collect_talent_data(token)
    upgrade_data = collect_upgrade_and_crest_data()

    profession_recipes, profession_output_ids = collect_profession_supporting_data(token)
    supporting_items = fetch_supporting_item_details(token, profession_output_ids)
    gems, enchants, crafted_gear, other_crafted_items = classify_profession_outputs(
        profession_recipes,
        supporting_items,
    )

    items = fetch_item_details(token, item_sources.keys(), item_sources)
    candidate_count_before_slot_filter = len(items)
    items = filter_optimizer_items(items)
    print(f"Filtered optimizer gear candidates: {len(items)} of {candidate_count_before_slot_filter} have valid unique equipment slots.")

    items.sort(
        key=lambda item: (item.get("level") or 0, item.get("id") or 0),
        reverse=True,
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
        "craftedGearRecipeCount": len(crafted_gear),
        "recraftRecipeCount": sum(1 for r in profession_recipes if r.get("isRecraft")),
        "embellishmentRecipeCount": sum(1 for r in profession_recipes if r.get("isEmbellishment")),
        "optionalReagentRecipeCount": sum(1 for r in profession_recipes if r.get("optionalReagents")),
        "modifiedCraftingSlotRecipeCount": sum(1 for r in profession_recipes if r.get("modifiedCraftingSlots")),
        "upgradeTrackCount": len(upgrade_data["tracks"]),
        "crestTypeCount": len(upgrade_data["crests"]),
        "crestExchangeRuleCount": len(upgrade_data["exchangeRules"]),
        "ascendantVenomstoneStatus": upgrade_data["ascendantVenomstone"]["status"],
        "importPhase": "season-2-plus-pve-pvp-talents-professions-upgrades",
        "seasonPolicy": SEASON_SCOPE,
    }

    dataset["notes"] = [
        "Generated from the secure Blizzard Game Data API importer.",
        "Blizzard API credentials are never placed in browser JavaScript.",
        "The importer does not scan the historical weapon/armor catalog.",
        "Season membership is source-based, not guessed from item level.",
        "Season 2 PvE candidates come from matched Adventure Journal sources.",
        "Season 2 PvP candidates come from Blizzard's PvP Season 2 reward API.",
        "Current Midnight profession recipes are imported for gems, enchants, crafted gear, and other crafted outputs.",
        "Midnight Season 2 upgrade tracks, Mistcrests, exchange rules, and Ascendant Venomstone eligibility are stored explicitly; upgrade tracks are not inferred from item level.",
        "Unified item records retain their source category so the optimizer can distinguish PvE and PvP gear.",
        "Season 2+ additions such as Kith'ix and Labyrinth of Kindo'jan are added when Blizzard exposes their reward data.",
        "Crafted, vendor, outdoor, Delves, Prey, and other non-Journal sources require their own source-specific importers; they are not silently approximated as Season 2 gear.",
    ]

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2)
        handle.write("\n")

    print(
        f"Season 2+ Retail gear import completed: {len(items)} enriched items "
        f"from {len(item_sources)} unified PvE/PvP source candidates."
    )


if __name__ == "__main__":
    main()
