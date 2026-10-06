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
LOCALE = "en_US"
REQUEST_DELAY_SECONDS = 0.15
MAX_RETRIES = 4

# The optimizer intentionally keeps the current expansion only.  Season 1
# and older historical gear must not be imported just because its item level
# happens to overlap the current range.
CURRENT_EXPANSION_NAME = "Midnight"
MINIMUM_SEASON = 2


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
    if isinstance(value, dict):
        return value.get("id")
    return value if isinstance(value, int) else None


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


def get_current_expansion(token):
    response = get_api_json(
        "/data/wow/journal-expansion/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )

    expansions = response.get("journal_expansions", [])
    for expansion in expansions:
        name = localized_name(expansion.get("name"))
        if str(name).strip().lower() == CURRENT_EXPANSION_NAME.lower():
            return expansion

    available = [
        localized_name(item.get("name"))
        for item in expansions
        if localized_name(item.get("name"))
    ]
    raise RuntimeError(
        f"Could not find current expansion '{CURRENT_EXPANSION_NAME}'. "
        f"Available journal expansions: {available}"
    )


def get_current_expansion_instances(token, expansion):
    expansion_id = extract_id(expansion)
    if not expansion_id:
        raise RuntimeError("Current expansion journal entry has no ID.")

    detail = get_api_json(
        f"/data/wow/journal-expansion/{expansion_id}",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )

    instances = detail.get("journal_instances", [])
    if not instances:
        raise RuntimeError(
            f"Journal expansion '{CURRENT_EXPANSION_NAME}' returned no journal instances."
        )

    return instances


def get_current_expansion_item_ids(token):
    """
    Build the candidate gear pool from the current expansion's Adventure
    Journal. Each current-expansion instance exposes its encounters, and
    each encounter exposes its loot item IDs. This avoids importing tens of
    thousands of historical items.

    Note: the Game Data Journal API does not expose every source of gear
    (for example, some vendor/crafted/BoE variations). Those sources will be
    added in later importer phases. This phase deliberately establishes a
    trustworthy current-expansion PvE candidate pool.
    """
    expansion = get_current_expansion(token)
    expansion_name = localized_name(expansion.get("name"))
    instances = get_current_expansion_instances(token, expansion)

    item_sources = {}
    encounter_count = 0
    instance_count = 0

    for instance_ref in instances:
        instance_id = extract_id(instance_ref)
        if not instance_id:
            continue

        instance = get_api_json(
            f"/data/wow/journal-instance/{instance_id}",
            token,
            {"namespace": NAMESPACE, "locale": LOCALE},
        )
        instance_count += 1

        instance_name = localized_name(instance.get("name"))
        encounters = instance.get("journal_encounters", [])

        for encounter_ref in encounters:
            encounter_id = extract_id(encounter_ref)
            if not encounter_id:
                continue

            encounter = get_api_json(
                f"/data/wow/journal-encounter/{encounter_id}",
                token,
                {"namespace": NAMESPACE, "locale": LOCALE},
            )
            encounter_count += 1

            for loot in encounter.get("items", []):
                item_id = extract_id(loot.get("item"))
                if not item_id:
                    item_id = extract_id(loot)
                if not item_id:
                    continue

                item_sources.setdefault(item_id, []).append({
                    "expansion": expansion_name,
                    "instanceId": instance_id,
                    "instance": instance_name,
                    "encounterId": encounter_id,
                    "encounter": localized_name(encounter.get("name")),
                })

            time.sleep(REQUEST_DELAY_SECONDS)

        time.sleep(REQUEST_DELAY_SECONDS)

    print(
        f"Current expansion source scan: {instance_count} instances, "
        f"{encounter_count} encounters, {len(item_sources)} unique loot items."
    )

    return item_sources


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
            source="Blizzard Game Data API — current Midnight journal loot",
        )
        item["seasonScope"] = f"Season {MINIMUM_SEASON}+"
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

    item_sources = get_current_expansion_item_ids(token)
    items = fetch_item_details(token, item_sources.keys(), item_sources)

    items.sort(
        key=lambda item: (item.get("level") or 0, item.get("id") or 0),
        reverse=True,
    )

    with open(OUTPUT, "r", encoding="utf-8") as handle:
        dataset = json.load(handle)

    dataset["status"] = "current-expansion-source-imported"
    dataset["source"] = "Blizzard Game Data API"
    dataset["updatedAt"] = datetime.now(timezone.utc).isoformat()
    dataset["items"] = items
    dataset["expansion"] = CURRENT_EXPANSION_NAME
    dataset["season"] = MINIMUM_SEASON
    dataset["apiCheck"] = {
        "itemClassCount": len(item_classes.get("item_classes", [])),
        "namespace": NAMESPACE,
        "gearItemCount": len(items),
        "candidateItemCount": len(item_sources),
        "importPhase": "current-expansion-journal-sources",
        "seasonPolicy": f"Season {MINIMUM_SEASON}+",
    }

    dataset["notes"] = [
        "Generated from the secure Blizzard Game Data API importer.",
        "Blizzard API credentials are never placed in browser JavaScript.",
        "The importer no longer scans the historical weapon/armor item catalog.",
        "The gear candidate pool starts from current Midnight Adventure Journal loot.",
        "The optimizer scope is Season 2 and newer, not Season 1 or older historical gear.",
        "Detailed item stats and effects are imported from the Blizzard item endpoint.",
        "Some non-Journal sources such as vendors, crafted gear, and certain BoEs require a later source-specific import phase.",
    ]

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2)
        handle.write("\n")

    print(
        f"Current Retail gear import completed: {len(items)} enriched items "
        f"from {len(item_sources)} current-expansion loot candidates."
    )


if __name__ == "__main__":
    main()
