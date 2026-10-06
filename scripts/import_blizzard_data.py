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


def collect_pvp_season_item_ids(token):
    """Collect Season 2 PvP metadata and actual current-season PvP gear."""
    response = get_api_json(
        "/data/wow/pvp-season/index",
        token,
        {"namespace": PVP_NAMESPACE, "locale": LOCALE},
    )

    seasons = response.get("pvp_seasons") or response.get("seasons") or []
    season_ref = None

    for candidate in seasons:
        name = localized_name(candidate.get("name")) if isinstance(candidate, dict) else None
        if normalize_name(name) == "midnight season 2" or (
            name and "midnight" in normalize_name(name) and "season 2" in normalize_name(name)
        ):
            season_ref = candidate
            break

    if not season_ref and seasons:
        candidates = [c for c in seasons if extract_id(c)]
        if candidates:
            season_ref = max(candidates, key=lambda c: extract_id(c))

    if not season_ref:
        print("Blizzard PvP season index returned no usable season references; continuing without PvP rewards.")
        return {}, {
            "id": None,
            "name": "Midnight Season 2",
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
                    "pvpSeason": localized_name(detail.get("name")) or "Midnight Season 2",
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
        spec_tree_id = reference_id(spec_tree)

        hero_refs = spec.get("hero_talent_trees") or spec.get("hero_talent_tree") or []
        if isinstance(hero_refs, dict):
            hero_refs = [hero_refs]

        hero_records = []
        for hero_ref in hero_refs:
            hero_id = reference_id(hero_ref)
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
    tree_refs = (
        tree_index.get("spec_talent_trees")
        or tree_index.get("hero_talent_trees")
        or tree_index.get("class_talent_trees")
        or tree_index.get("talent_trees")
        or tree_index.get("trees")
        or []
    )

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
            if tree_type == "specialization" and spec_id:
                tree = get_api_json(
                    f"/data/wow/talent-tree/{tree_id}/playable-specialization/{spec_id}",
                    token,
                    {"namespace": NAMESPACE, "locale": LOCALE},
                )
            else:
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
            add_tree(hero["id"], "hero")

    for tree_ref in tree_refs:
        tree_id = reference_id(tree_ref)
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
        data = tree.get("data") or {}
        nodes = data.get("nodes") or []
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

    response = get_api_json(
        "/data/wow/search/item",
        token,
        {
            "namespace": NAMESPACE,
            "locale": LOCALE,
            "name.en_US": recipe_name,
            "_pageSize": 100,
            "orderby": "id",
        },
    )

    recipe_normalized = normalize_name(recipe_name)
    recipe_tokens = {
        token for token in recipe_normalized.split()
        if len(token) > 1
    }

    if profession_name == "Jewelcrafting" and normalize_name(recipe_name) == "quick peridot":
        print("QUICK PERIDOT ITEM SEARCH CANDIDATES:")
        for result in response.get("results", []) or []:
            data = result.get("data") or {}
            debug_id = extract_id(result) or extract_id(data)
            debug_name = localized_name(data.get("name")) or localized_name(result.get("name"))
            debug_class = extract_id(data.get("item_class"))
            print(json.dumps({
                "id": debug_id,
                "name": debug_name,
                "itemClassId": debug_class,
                "isEquippable": data.get("is_equippable"),
            }, ensure_ascii=False))

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

                    recipes.append({
                        "id": recipe_id,
                        "name": localized_name(recipe.get("name")) or localized_name(recipe_ref.get("name")),
                        "profession": profession_name,
                        "professionId": profession_id,
                        "skillTier": tier_name,
                        "category": category_name,
                        "craftedItemId": crafted_item_id,
                        "craftedItemQuantity": crafted_item.get("quantity") if isinstance(crafted_item, dict) else None,
                        "reagents": recipe.get("reagents", []),
                        "description": recipe.get("description"),
                        "media": recipe.get("media"),
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
    print(f"Resolved {fallback_output_count} recipe outputs through item search fallback.")
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

        item = normalize_item(
            data,
            source="Blizzard Game Data API — Season 2+ content source",
        )
        item["seasonScope"] = SEASON_SCOPE
        item["sourceLocations"] = item_sources.get(item_id, [])
        items.append(item)

        if index % 50 == 0:
            print(f"Enriched {index}/{len(item_ids)} candidate items.")

        time.sleep(REQUEST_DELAY_SECONDS)

    return items


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

    pve_sources, matched_instances, missing_sources = collect_season_content_item_ids(token)
    pvp_sources, pvp_metadata = collect_pvp_season_item_ids(token)
    item_sources = merge_item_sources(pve_sources, pvp_sources)

    talent_data = collect_talent_data(token)

    profession_recipes, profession_output_ids = collect_profession_supporting_data(token)
    supporting_items = fetch_supporting_item_details(token, profession_output_ids)
    gems, enchants, crafted_gear, other_crafted_items = classify_profession_outputs(
        profession_recipes,
        supporting_items,
    )

    items = fetch_item_details(token, item_sources.keys(), item_sources)

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
        "importPhase": "season-2-plus-pve-pvp-talents-professions",
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
