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

MINIMUM_SEASON = 2
SEASON_SCOPE = "Midnight Season 2+"

# Season 2 sources. Matching is done against Blizzard's complete
# Adventure Journal instance index, not by item level.
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
    if isinstance(value, dict):
        return value.get("id")
    return value if isinstance(value, int) else None


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
    # Blizzard's Journal Instance Index returns the collection as
    # "journal_instances" in some documentation examples and "instances"
    # in the current API model. Accept both so the importer is resilient.
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
    print(f"Matched Season 2 sources: {sorted(matched_instances)}")
    if missing_sources:
        print(f"Season 2 sources not present in Journal yet: {sorted(missing_sources)}")

    return item_sources, sorted(matched_instances), sorted(missing_sources)


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

    item_sources, matched_instances, missing_sources = collect_season_content_item_ids(token)
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
    dataset["apiCheck"] = {
        "itemClassCount": len(item_classes.get("item_classes", [])),
        "namespace": NAMESPACE,
        "gearItemCount": len(items),
        "candidateItemCount": len(item_sources),
        "matchedInstances": matched_instances,
        "missingSources": missing_sources,
        "importPhase": "season-content-sources",
        "seasonPolicy": SEASON_SCOPE,
    }

    dataset["notes"] = [
        "Generated from the secure Blizzard Game Data API importer.",
        "Blizzard API credentials are never placed in browser JavaScript.",
        "The importer does not scan the historical weapon/armor catalog.",
        "Season membership is source-based, not guessed from item level.",
        "The candidate pool is built from explicitly matched Season 2+ Adventure Journal sources.",
        "Detailed item stats and effects are imported from the Blizzard item endpoint.",
        "PvP vendors, crafted gear, outdoor rewards, and certain BoEs require later source-specific import phases.",
    ]

    with open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2)
        handle.write("\n")

    print(
        f"Season 2+ Retail gear import completed: {len(items)} enriched items "
        f"from {len(item_sources)} source candidates."
    )


if __name__ == "__main__":
    main()
