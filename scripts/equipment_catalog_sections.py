"""Complete, section-by-section Blizzard item-search ingestion.

Each search is paginated to the API's advertised maxPage (or until an empty page
when pagination metadata is absent). Section files are replaced atomically only
after all IDs discovered for that section have an enriched, equippable record.
"""
import json
import os
import tempfile
import time
from pathlib import Path

PAGE_SIZE = 1000
REQUEST_DELAY_SECONDS = 0.15

SECTION_SEARCHES = {
    "rings": ("FINGER",),
    "necklaces": ("NECK",),
    "trinkets": ("TRINKET",),
    "head": ("HEAD",),
    "shoulders": ("SHOULDER",),
    "back": ("CLOAK",),
    "chest": ("CHEST", "ROBE"),
    "wrists": ("WRIST",),
    "hands": ("HAND",),
    "waist": ("WAIST",),
    "legs": ("LEGS",),
    "feet": ("FEET",),
    "main-hand": ("WEAPON", "WEAPONMAINHAND", "TWOHWEAPON", "RANGED", "RANGEDRIGHT", "THROWN"),
    "off-hand": ("WEAPON", "WEAPONOFFHAND", "HOLDABLE", "SHIELD"),
}
SECTION_DIR = Path("data/equipment-sections")

# Canonical Blizzard inventory-type codes are the primary mapping key. Names are
# fallback-only because localized display names can vary by locale/API shape.
INVENTORY_TYPE_NAME_ALIASES = {
    "FINGER": "rings", "RING": "rings", "NECK": "necklaces", "NECKLACE": "necklaces",
    "TRINKET": "trinkets", "HEAD": "head", "SHOULDER": "shoulders",
    "CLOAK": "back", "BACK": "back", "CHEST": "chest", "ROBE": "chest",
    "WRIST": "wrists", "HAND": "hands", "WAIST": "waist",
    "LEGS": "legs", "LEG": "legs", "FEET": "feet",
}
INVENTORY_TYPE_NAME_ALIASES.update({
    "WEAPONMAINHAND": "main-hand", "TWOHWEAPON": "main-hand",
    "RANGED": "main-hand", "RANGEDRIGHT": "main-hand", "THROWN": "main-hand",
    "WEAPONOFFHAND": "off-hand", "HOLDABLE": "off-hand", "SHIELD": "off-hand",
})


def sections_for_inventory_type(inventory_type):
    """Map Blizzard item-detail inventory metadata to one or more catalog categories.

    Accepts the canonical inventory_type.type code or a Blizzard inventory_type
    object. Generic WEAPON metadata is intentionally mapped to both hand sections;
    class/spec/slot eligibility is the optimizer/API's responsibility.
    """
    if isinstance(inventory_type, dict):
        code = inventory_type.get("type")
        name = inventory_type.get("name")
    else:
        code = inventory_type
        name = inventory_type
    code = str(code or "").strip().upper().replace("-", "").replace("_", "")
    name = str(name or "").strip().lower()
    code_map = {
        key.replace("-", "").replace("_", ""): value
        for key, value in INVENTORY_TYPE_NAME_ALIASES.items()
    }
    if code in code_map:
        return (code_map[code],)
    if code == "WEAPON":
        return ("main-hand", "off-hand")
    name_aliases = {
        "finger": "rings", "ring": "rings", "neck": "necklaces",
        "necklace": "necklaces", "trinket": "trinkets", "head": "head",
        "shoulder": "shoulders", "cloak": "back", "back": "back",
        "chest": "chest", "robe": "chest", "wrist": "wrists",
        "hand": "hands", "waist": "waist", "legs": "legs", "leg": "legs",
        "feet": "feet", "weapon": "main-hand",
        "weapon main hand": "main-hand", "two-hand": "main-hand",
        "weapon off hand": "off-hand", "held in off-hand": "off-hand",
        "shield": "off-hand",
    }
    if name in name_aliases:
        return (name_aliases[name],)
    return ()




def validate_required_sections(section_ids):
    """Fail closed when any required equipment section has no verified candidates.

    Continuing with an empty section can publish a dataset that looks successful
    while silently omitting an entire equipment slot. The caller must refresh
    source evidence or correct the missing category before publishing.
    """
    missing = [section for section in SECTION_SEARCHES if not section_ids.get(section)]
    if missing:
        raise RuntimeError(
            "No verified candidates for required equipment section(s): "
            f"{', '.join(missing)}. Refusing to publish an incomplete equipment catalog."
        )
    print(f"All {len(SECTION_SEARCHES)} equipment sections have verified candidates.")
    return []


def _item_id(result):
    if not isinstance(result, dict):
        return None
    data = result.get("data") if isinstance(result.get("data"), dict) else {}
    for candidate in (result.get("id"), data.get("id")):
        if isinstance(candidate, int) and not isinstance(candidate, bool):
            return candidate
    return None


def fetch_inventory_type_ids(token, inventory_type, get_api_json, sleep=time.sleep):
    """Return all unique item IDs for one Blizzard inventory type, with full pagination."""
    ids = set()
    page = 1
    advertised_max_page = None
    while True:
        response = get_api_json(
            "/data/wow/search/item",
            token,
            {
                "namespace": "static-us",
                "locale": "en_US",
                "inventory_type.type": inventory_type,
                "_page": page,
                "_pageSize": PAGE_SIZE,
                "orderby": "id",
            },
        )
        if not isinstance(response, dict):
            raise RuntimeError(
                f"Blizzard item search for {inventory_type} returned a non-object response."
            )
        results = response.get("results")
        if not isinstance(results, list):
            raise RuntimeError(
                f"Blizzard item search for {inventory_type} did not return a results list."
            )
        max_page = response.get("max_page", response.get("maxPage"))
        if isinstance(max_page, int) and max_page >= 0:
            advertised_max_page = max_page
        page_ids = {_item_id(result) for result in results}
        page_ids.discard(None)
        ids.update(page_ids)
        print(
            f"Equipment search {inventory_type}: page {page}, "
            f"{len(page_ids)} IDs, {len(ids)} unique so far."
        )
        if advertised_max_page is not None:
            if page >= advertised_max_page:
                break
        elif not results or len(results) < PAGE_SIZE:
            break
        page += 1
        sleep(REQUEST_DELAY_SECONDS)
    return ids


def collect_equipment_section_ids(token, get_api_json, allowed_item_ids, sleep=time.sleep, source_evidence=None):
    """Classify verified Season 2+ source items by their item-detail inventory type.

    Blizzard's item search can cap a slot query at its first 1,000 ID-ordered
    results, which can omit newer IDs entirely. The importer already has an
    independently verified source list, so use each item's authoritative detail
    endpoint to assign its slot instead of intersecting against that capped search.
    """
    source_evidence = source_evidence or {}
    allowed_item_ids = set(allowed_item_ids)
    if not allowed_item_ids:
        raise RuntimeError("No verified Season 2+ item IDs were supplied; refusing to publish a catalog.")

    print(
        "Equipment catalog source diagnostics: "
        f"verified_source_ids={len(allowed_item_ids)}; "
        f"sample_ids={sorted(allowed_item_ids)[:12]}"
    )
    section_ids = {}
    source_map = {}
    type_to_sections = {}
    for section, inventory_types in SECTION_SEARCHES.items():
        for inventory_type in inventory_types:
            type_to_sections.setdefault(inventory_type, set()).add(section)

    detail_errors = 0
    rejection_counts = {
        "not_equippable": 0,
        "unsupported_inventory_type": {},
        "missing_source_evidence": 0,
    }
    for index, item_id in enumerate(sorted(allowed_item_ids), start=1):
        try:
            detail = get_api_json(
                f"/data/wow/item/{item_id}",
                token,
                {"namespace": "static-us", "locale": "en_US"},
            )
        except Exception as error:
            detail_errors += 1
            print(
                f"Equipment detail lookup failed: id={item_id}; "
                f"error_type={type(error).__name__}"
            )
            continue

        if not isinstance(detail, dict) or not detail.get("is_equippable"):
            rejection_counts["not_equippable"] += 1
            print(
                f"Equipment source excluded: id={item_id}; "
                "reason=Blizzard item detail does not confirm is_equippable."
            )
            continue
        inventory = detail.get("inventory_type") or {}
        inventory_type = inventory.get("type") if isinstance(inventory, dict) else None
        matched_sections = type_to_sections.get(inventory_type, set())
        if not matched_sections:
            key = str(inventory_type or "missing")
            rejection_counts["unsupported_inventory_type"][key] = (
                rejection_counts["unsupported_inventory_type"].get(key, 0) + 1
            )
            print(
                f"Equipment source not classified: id={item_id}; "
                f"name={detail.get('name')!r}; inventory_type={key!r}; "
                "reason=no equipment section mapping."
            )
            continue

        print(
            f"Equipment source classification: id={item_id}; "
            f"name={detail.get('name')!r}; inventory_type={inventory_type!r}; "
            f"sections={sorted(matched_sections)}"
        )
        evidence = source_evidence.get(item_id, [])
        if isinstance(evidence, dict):
            evidence = [evidence]
        if not evidence:
            rejection_counts["missing_source_evidence"] += 1
            print(
                f"Equipment source not classified: id={item_id}; "
                "reason=no independent source evidence."
            )
            continue

        # Do not use item-detail "level" as a season eligibility gate. Blizzard's
        # static item record can expose the item's base/preview level (for example,
        # 219) even when its current-season difficulty drop is 292+ or scales by
        # difficulty. Current-season eligibility is established by source_evidence;
        # slot and equippability are established by this item-detail response.
        for section in matched_sections:
            section_ids.setdefault(section, set()).add(item_id)
            for source in evidence:
                if not isinstance(source, dict):
                    continue
                source_map.setdefault(item_id, []).append({
                    **source,
                    "catalogSection": section,
                    "slotConfirmedBy": "Blizzard item detail inventory_type.type",
                })
        if index % 50 == 0:
            print(
                f"Equipment source classification progress: {index}/{len(allowed_item_ids)} "
                f"items checked; detail_errors={detail_errors}; "
                f"sections={{{', '.join(f'{key}: {len(value)}' for key, value in sorted(section_ids.items()))}}}"
            )

    print(
        "Equipment source classification summary: "
        f"verified_source_ids={len(allowed_item_ids)}; detail_errors={detail_errors}; "
        f"not_equippable={rejection_counts['not_equippable']}; "
        f"missing_source_evidence={rejection_counts['missing_source_evidence']}; "
        f"unsupported_inventory_types={rejection_counts['unsupported_inventory_type']}; "
        f"section_counts={{{', '.join(f'{key}: {len(value)}' for key, value in sorted(section_ids.items()))}}}"
    )
    if detail_errors:
        raise RuntimeError(
            f"Blizzard item-detail classification was incomplete: {detail_errors} of "
            f"{len(allowed_item_ids)} source item lookups failed. Refusing to publish "
            "a catalog from a partial source scan; rerun after Blizzard/API access recovers."
        )
    if rejection_counts["unsupported_inventory_type"]:
        unsupported = ", ".join(
            f"{inventory_type}={count}"
            for inventory_type, count in sorted(
                rejection_counts["unsupported_inventory_type"].items()
            )
        )
        raise RuntimeError(
            "Blizzard returned equippable, source-verified items whose inventory types "
            "are not mapped to an equipment section. Refusing to publish a catalog that "
            f"silently omits these records: {unsupported}. Add an explicit section mapping "
            "or an explicit documented exclusion before rerunning."
        )
    return section_ids, source_map


def write_section_catalogs(section_ids, enriched_items, output_dir=SECTION_DIR, remove_stale=True):
    """Atomically publish each complete section; preserve old files on validation failure."""
    item_by_id = {
        item.get("id"): item
        for item in enriched_items
        if isinstance(item, dict) and isinstance(item.get("id"), int)
    }
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = {}
    for section, ids in section_ids.items():
        missing = sorted(item_id for item_id in ids if item_id not in item_by_id)
        if missing:
            raise RuntimeError(
                f"Section '{section}' is incomplete: {len(missing)} of {len(ids)} "
                f"search results lack enriched item records (sample: {missing[:10]}). "
                "Existing section file was not replaced."
            )
        records = [item_by_id[item_id] for item_id in sorted(ids)]
        invalid = [
            item.get("id") for item in records
            if item.get("isEquippable") is not True
        ]
        if invalid:
            raise RuntimeError(
                f"Section '{section}' contains non-equippable or unverified records "
                f"(sample IDs: {invalid[:10]}). Existing section file was not replaced."
            )
        payload = {
            "schemaVersion": 1,
            "section": section,
            "source": "Blizzard Game Data API item search",
            "complete": True,
            "candidateCount": len(ids),
            "items": records,
        }
        destination = output_dir / f"{section}.json"
        fd, temporary_name = tempfile.mkstemp(
            prefix=f".{section}.", suffix=".tmp", dir=str(output_dir)
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            # Re-read and sanity-check the temporary file before replacement.
            with open(temporary_name, "r", encoding="utf-8") as handle:
                checked = json.load(handle)
            if (
                checked.get("complete") is not True
                or checked.get("section") != section
                or len(checked.get("items", [])) != len(ids)
            ):
                raise RuntimeError(f"Section '{section}' failed its write-back validation.")
            os.replace(temporary_name, destination)
        finally:
            if os.path.exists(temporary_name):
                os.unlink(temporary_name)
        summary[section] = len(records)
        print(f"Stored complete equipment section {section}: {len(records)} items.")

    # After all non-empty sections have validated and been written, remove old
    # section files that no longer contain any verified Season 2+ candidates.
    for section in SECTION_SEARCHES:
        if remove_stale and section not in section_ids:
            stale_path = output_dir / f"{section}.json"
            if stale_path.exists():
                stale_path.unlink()
                print(f"Removed stale unverified equipment section: {section}.")
    return summary
