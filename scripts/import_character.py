import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://us.api.blizzard.com"
PROFILE_NAMESPACE = "profile-us"
LOCALE = "en_US"
TIMEOUT_SECONDS = 60


def request_json(url, token):
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.load(response)


def slugify(value):
    value = str(value or "").strip().lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def normalize_name(value):
    if isinstance(value, dict):
        return value.get(LOCALE) or value.get("en_US") or next(iter(value.values()), "")
    return value or ""


def resource_id(value):
    if isinstance(value, dict):
        return value.get("id")
    return value if isinstance(value, int) else None


def normalize_equipped_item(item):
    item_ref = item.get("item") or {}
    quality = item.get("quality") or {}
    slot = item.get("slot") or {}
    return {
        "id": resource_id(item_ref),
        "name": normalize_name(item.get("name")),
        "slot": normalize_name(slot.get("name") if isinstance(slot, dict) else slot),
        "itemLevel": item.get("level"),
        "quality": {
            "id": resource_id(quality),
            "name": normalize_name(quality.get("name")) if isinstance(quality, dict) else "",
        },
        "stats": item.get("stats") or [],
        "enchantments": item.get("enchantments") or [],
        "sockets": item.get("sockets") or [],
        "gems": item.get("gems") or [],
        "spells": item.get("spells") or [],
        "set": item.get("set"),
        "context": item.get("context"),
        "modifiers": item.get("modifiers") or [],
        "upgrade": item.get("upgrade"),
        "source": "Blizzard WoW Character Equipment API",
    }


def normalize_character(profile, equipment):
    active_spec = profile.get("active_spec") or {}
    character_class = profile.get("character_class") or {}
    race = profile.get("race") or {}
    realm = profile.get("realm") or {}
    items = [normalize_equipped_item(i) for i in equipment.get("equipped_items", [])]
    items = [i for i in items if i["id"] is not None]
    return {
        "id": profile.get("id"),
        "name": profile.get("name"),
        "realm": {
            "id": resource_id(realm),
            "name": normalize_name(realm.get("name")) if isinstance(realm, dict) else "",
            "slug": realm.get("slug") if isinstance(realm, dict) else "",
        },
        "level": profile.get("level"),
        "class": {"id": resource_id(character_class), "name": normalize_name(character_class.get("name")) if isinstance(character_class, dict) else ""},
        "race": {"id": resource_id(race), "name": normalize_name(race.get("name")) if isinstance(race, dict) else ""},
        "activeSpec": {"id": resource_id(active_spec), "name": normalize_name(active_spec.get("name")) if isinstance(active_spec, dict) else ""},
        "equipment": items,
        "equipmentCount": len(items),
        "source": "Blizzard WoW Profile API",
    }


def fetch_character(token, realm, character):
    realm_slug = slugify(realm)
    character_name = urllib.parse.quote(str(character).strip().lower(), safe="")
    if not realm_slug or not character_name:
        raise ValueError("Realm and character name are required.")
    base = f"{API_BASE}/profile/wow/character/{realm_slug}/{character_name}?namespace={PROFILE_NAMESPACE}&locale={LOCALE}"
    equipment_url = f"{API_BASE}/profile/wow/character/{realm_slug}/{character_name}/equipment?namespace={PROFILE_NAMESPACE}&locale={LOCALE}"
    return normalize_character(request_json(base, token), request_json(equipment_url, token))


def main():
    token = os.environ.get("BLIZZARD_ACCESS_TOKEN")
    realm = os.environ.get("WOW_REALM")
    character = os.environ.get("WOW_CHARACTER")
    output = os.environ.get("WOW_CHARACTER_OUTPUT", "data/current-character.json")
    if not token:
        print("Missing BLIZZARD_ACCESS_TOKEN.")
        sys.exit(1)
    if not realm or not character:
        print("Missing WOW_REALM or WOW_CHARACTER.")
        sys.exit(1)
    try:
        normalized = fetch_character(token, realm, character)
    except urllib.error.HTTPError as error:
        print(f"Blizzard character API returned HTTP {error.code}.")
        sys.exit(1)
    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    with open(output, "w", encoding="utf-8") as handle:
        json.dump(normalized, handle, indent=2)
        handle.write("\n")
    print(f"Imported {normalized['name']} ({normalized['realm']['name']}) with {normalized['equipmentCount']} equipped items.")


if __name__ == "__main__":
    main()
