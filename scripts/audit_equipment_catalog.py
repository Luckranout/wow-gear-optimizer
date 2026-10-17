"""Audit equipment catalogue breadth without confusing section completeness with full gear coverage.

Run with: python scripts/audit_equipment_catalog.py
The report is informational: missing candidates and incomplete variants are surfaced,
never silently promoted into optimizer-eligible records.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTION_DIR = ROOT / "data" / "equipment-sections"
TIER_MANIFEST = ROOT / "data" / "tier-set-item-ids.json"


def audit_catalog(section_dir=SECTION_DIR, manifest_path=TIER_MANIFEST):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    sections = {}
    known_ids = set()
    for path in sorted(Path(section_dir).glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        items = payload.get("items") if isinstance(payload.get("items"), list) else []
        ids = [item.get("id") for item in items if isinstance(item, dict) and isinstance(item.get("id"), int)]
        known_ids.update(ids)
        variant_records = sum(
            len(item.get("variants", []))
            for item in items
            if isinstance(item, dict) and isinstance(item.get("variants"), list)
        )
        sections[path.stem] = {
            "fileCompleteForSourceAllowlist": payload.get("complete") is True,
            "candidateCount": len(items),
            "uniqueItemIds": len(set(ids)),
            "itemsWithAtLeastOneVariant": sum(
                1 for item in items
                if isinstance(item, dict) and isinstance(item.get("variants"), list) and item["variants"]
            ),
            "recordedVariantCount": variant_records,
            "allGearCoverage": False,
            "coverageScope": "source-verified current-season candidate subset; not an exhaustive class gear list",
        }

    missing_tier_pieces = []
    total_tier_pieces = 0
    for tier_set in manifest.get("sets", []):
        for piece in tier_set.get("pieces", []):
            total_tier_pieces += 1
            item_id = piece.get("itemId")
            if item_id not in known_ids:
                missing_tier_pieces.append({
                    "class": tier_set.get("className"),
                    "itemId": item_id,
                    "name": piece.get("name"),
                    "slot": piece.get("slot"),
                })

    return {
        "schemaVersion": 1,
        "auditScope": "all saved equipment-section files compared with the tier-piece ID manifest",
        "sectionCount": len(sections),
        "totalSectionItemRecords": sum(section["candidateCount"] for section in sections.values()),
        "totalUniqueSectionItemIds": len(known_ids),
        "allGearCatalogueComplete": False,
        "sectionCompletenessMeaning": "complete means complete for the importer's currently verified source allowlist, not all gear for all classes or all upgrade variants",
        "sections": sections,
        "tierSetCoverage": {
            "manifestPieceCount": total_tier_pieces,
            "piecesPresentInEquipmentSections": total_tier_pieces - len(missing_tier_pieces),
            "piecesMissingFromEquipmentSections": len(missing_tier_pieces),
            "missingPieces": missing_tier_pieces,
        },
    }


def main():
    print(json.dumps(audit_catalog(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
