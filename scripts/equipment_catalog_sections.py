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


def validate_required_sections(section_ids):
    """Fail before writing any files if a required equipment section has no verified candidates."""
    missing = [section for section in SECTION_SEARCHES if not section_ids.get(section)]
    if missing:
        raise RuntimeError(
            "Equipment catalog validation failed; no verified Season 2+ candidates for required "
            f"section(s): {', '.join(missing)}. No section files should be published."
        )


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


def collect_equipment_section_ids(token, get_api_json, allowed_item_ids, sleep=time.sleep):
    """Find slot matches intersecting the importer's independently verified Season 2+ candidate sources."""
    allowed_item_ids = set(allowed_item_ids)
    if not allowed_item_ids:
        raise RuntimeError("No verified Season 2+ item IDs were supplied; refusing to publish a catalog.")
    sample_source_ids = sorted(allowed_item_ids)[:12]
    print(
        "Equipment catalog source diagnostics: "
        f"verified_source_ids={len(allowed_item_ids)}; "
        f"sample_ids={sample_source_ids}"
    )
    # Inspect actual Blizzard item-detail properties for representative IDs from
    # the PvE/PvP/crafted source union before slot filtering. This distinguishes
    # bad source IDs or missing inventory_type metadata from a search/overlap bug.
    for source_id in sample_source_ids:
        try:
            detail = get_api_json(
                f"/data/wow/item/{source_id}",
                token,
                {"namespace": "static-us", "locale": "en_US"},
            )
            inventory = detail.get("inventory_type") or {}
            item_class = detail.get("item_class") or {}
            item_subclass = detail.get("item_subclass") or {}
            print(
                "Source item raw properties: "
                f"id={source_id}; name={detail.get('name')!r}; "
                f"is_equippable={detail.get('is_equippable')!r}; "
                f"level={detail.get('level')!r}; "
                f"inventory_type_id={inventory.get('id') if isinstance(inventory, dict) else None!r}; "
                f"inventory_type_name={inventory.get('name') if isinstance(inventory, dict) else None!r}; "
                f"item_class_id={item_class.get('id') if isinstance(item_class, dict) else None!r}; "
                f"item_class_name={item_class.get('name') if isinstance(item_class, dict) else None!r}; "
                f"item_subclass_id={item_subclass.get('id') if isinstance(item_subclass, dict) else None!r}; "
                f"item_subclass_name={item_subclass.get('name') if isinstance(item_subclass, dict) else None!r}"
            )
        except Exception as error:
            print(
                f"Source item raw properties unavailable: id={source_id}; "
                f"error_type={type(error).__name__}"
            )
    section_ids = {}
    source_map = {}
    for section, inventory_types in SECTION_SEARCHES.items():
        ids = set()
        raw_counts = {}
        for inventory_type in inventory_types:
            type_ids = fetch_inventory_type_ids(token, inventory_type, get_api_json, sleep)
            raw_counts[inventory_type] = len(type_ids)
            ids.update(type_ids)
        raw_count = len(ids)
        overlap_ids = ids.intersection(allowed_item_ids)
        # Blizzard item search is a slot lookup, not a season filter. Intersect it
        # with IDs independently verified by the importer (PvE/PvP loot or
        # eligible Midnight profession recipe outputs). Keep raw and overlap
        # counts visible so a source-scope mismatch cannot masquerade as an
        # empty API response or a throttling/authentication failure.
        print(
            f"Equipment section diagnostics {section}: "
            f"inventory_types={raw_counts}; raw_unique_ids={raw_count}; "
            f"verified_overlap={len(overlap_ids)}; "
            f"overlap_sample={sorted(overlap_ids)[:8]}"
        )
        ids = overlap_ids
        if not ids:
            print(f"Equipment section {section}: no verified Season 2+ source items; section omitted.")
            continue
        section_ids[section] = ids
        for item_id in ids:
            source_map.setdefault(item_id, []).append({
                "category": "Verified Season 2+ Equipment Catalog",
                "catalogSection": section,
                "seasonScope": "Midnight Season 2+",
                "eligibilitySource": "Verified Midnight Season 2+ loot or profession recipe source intersection",
            })
        print(f"Equipment section {section}: {len(ids)} unique item IDs.")
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
