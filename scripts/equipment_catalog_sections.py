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

# Season 2 dungeon gear starts at item level 259 (Normal difficulty).
# Legacy Journal loot can appear beside current-season loot in the same encounters.
MIN_CURRENT_SEASON_PVE_ITEM_LEVEL = 259
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
            continue
        inventory = detail.get("inventory_type") or {}
        inventory_type = inventory.get("type") if isinstance(inventory, dict) else None
        matched_sections = type_to_sections.get(inventory_type, set())
        if not matched_sections:
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
            print(f"Equipment source rejected without provenance: id={item_id}; no source evidence.")
            continue

        # Do not treat low-level legacy loot as current-season gear solely because
        # its dungeon is in the Season 2 rotation. Keep independent PvP/crafted
        # provenance even when those items are below the PvE level floor.
        pve_evidence = [source for source in evidence if isinstance(source, dict) and source.get("category") == "PvE"]
        independent_evidence = [source for source in evidence if not (isinstance(source, dict) and source.get("category") == "PvE")]
        item_level = detail.get("level")
        if pve_evidence and (not isinstance(item_level, (int, float)) or item_level < MIN_CURRENT_SEASON_PVE_ITEM_LEVEL):
            print(f"Equipment source rejected as legacy PvE loot: id={item_id}; item_level={item_level!r}; minimum={MIN_CURRENT_SEASON_PVE_ITEM_LEVEL}.")
            evidence = independent_evidence
            if not evidence:
                continue
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
        f"section_counts={{{', '.join(f'{key}: {len(value)}' for key, value in sorted(section_ids.items()))}}}"
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
