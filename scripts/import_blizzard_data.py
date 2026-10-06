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
PAGE_SIZE = 1000
REQUEST_DELAY_SECONDS = 0.15
MIN_CURRENT_ITEM_LEVEL = 250
MAX_CURRENT_ITEM_LEVEL = 344
MAX_RETRIES = 4


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


def normalize_item(result):
    data = result.get("data", {})
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
        "media": data.get("media"),
        "source": "Blizzard Game Data API",
    }


def import_gear_items(token, item_class_id):
    items = []
    seen_ids = set()
    starting_id = 1
    page_count = 0

    while True:
        page_count += 1
        response = get_api_json(
            "/data/wow/search/item",
            token,
            {
                "namespace": NAMESPACE,
                "locale": LOCALE,
                "orderby": "id",
                "_pageSize": PAGE_SIZE,
                "_page": 1,
                "id": f"[{starting_id},]",
                "level": f"[{MIN_CURRENT_ITEM_LEVEL},{MAX_CURRENT_ITEM_LEVEL}]",
                "item_class.id": item_class_id,
            },
        )

        results = response.get("results", [])
        if not results:
            break

        batch = []
        max_id = starting_id

        for result in results:
            item = normalize_item(result)
            item_id = item.get("id")
            if not item_id or item_id in seen_ids:
                continue

            seen_ids.add(item_id)
            batch.append(item)
            max_id = max(max_id, item_id)

        items.extend(batch)

        print(
            f"Imported item class {item_class_id}: "
            f"batch {page_count}, {len(batch)} items, total {len(items)}"
        )

        if max_id < starting_id or len(results) < PAGE_SIZE:
            break

        starting_id = max_id + 1
        time.sleep(REQUEST_DELAY_SECONDS)

    return items


def main():
    client_id = os.environ.get("BLIZZARD_CLIENT_ID")
    client_secret = os.environ.get("BLIZZARD_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET GitHub secrets.")
        sys.exit(1)

    token = get_access_token(client_id, client_secret)

    # Verify the API and retrieve the current item-class catalog.
    item_classes = get_api_json(
        "/data/wow/item-class/index",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )

    # Retail equipment lives primarily in item classes 2 (Weapon) and
    # 4 (Armor). Restrict the catalog to the current Season 2 item-level
    # band so we do not spend the workflow's time pulling the entire
    # historical WoW item database. Detailed item stats/effects come next.
    items = []
    for item_class_id in (2, 4):
        items.extend(import_gear_items(token, item_class_id))

    items.sort(key=lambda item: (item.get("level") or 0, item.get("id") or 0), reverse=True)

    with open(OUTPUT, "r", encoding="utf-8") as handle:
        dataset = json.load(handle)

    dataset["status"] = "gear-catalog-imported"
    dataset["source"] = "Blizzard Game Data API"
    dataset["updatedAt"] = datetime.now(timezone.utc).isoformat()
    dataset["items"] = items
    dataset["apiCheck"] = {
        "itemClassCount": len(item_classes.get("item_classes", [])),
        "namespace": NAMESPACE,
        "gearItemCount": len(items),
        "gearItemClasses": [2, 4],
        "itemLevelRange": [MIN_CURRENT_ITEM_LEVEL, MAX_CURRENT_ITEM_LEVEL],
        "importPhase": "catalog",
    }

    notes = [
        "This file is generated from the secure Blizzard Game Data API importer.",
        "Blizzard API credentials must never be placed in browser JavaScript.",
        "Phase 1 imports the searchable current-season weapon and armor catalog.",
        "Phase 2 will enrich candidate gear with detailed stats and effects.",
    ]
    dataset["notes"] = notes

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2)
        handle.write("\n")

    print(f"Blizzard gear catalog imported successfully: {len(items)} items.")


if __name__ == "__main__":
    main()
