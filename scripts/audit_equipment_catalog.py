"""Audit equipment catalogue breadth and tier variant verification coverage.

Run with: python scripts/audit_equipment_catalog.py
Missing candidates and incomplete variants are surfaced, never silently promoted.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTION_DIR = ROOT / "data" / "equipment-sections"
TIER_MANIFEST = ROOT / "data" / "tier-set-item-ids.json"
TIER_DATA = ROOT / "data" / "tier-sets-midnight-season-2.json"
EXPECTED_TIER_SLOTS = {"Head", "Shoulders", "Chest", "Hands", "Legs"}


def audit_catalog(section_dir=SECTION_DIR, manifest_path=TIER_MANIFEST, tier_data_path=TIER_DATA):
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

    tier_class_audit = []
    tier_variant_data_available = Path(tier_data_path).exists()
    if tier_variant_data_available:
        tier_data = json.loads(Path(tier_data_path).read_text(encoding="utf-8"))
        for tier_set in tier_data.get("sets", []):
            base_pieces = tier_set.get("basePieces", [])
            verified_pieces = tier_set.get("pieces", [])
            observations = tier_set.get("verifiedVariantObservations", [])
            base_slots = {piece.get("slot") for piece in base_pieces if isinstance(piece, dict)}
            verified_variants = [
                piece for piece in verified_pieces
                if isinstance(piece, dict)
                and piece.get("candidate") is True
                and isinstance(piece.get("itemLevel"), int)
                and isinstance(piece.get("stats"), list)
                and piece["stats"]
            ]
            observation_variants_with_stats = [
                item for item in observations
                if isinstance(item, dict)
                and isinstance(item.get("itemLevel"), int)
                and isinstance(item.get("stats"), list)
                and item["stats"]
            ]
            verified_slots = {
                piece.get("slot") for piece in verified_variants
                if isinstance(piece.get("slot"), str)
            }
            observed_slots = {
                piece.get("slot") for piece in observation_variants_with_stats
                if isinstance(piece.get("slot"), str)
            }
            slot_variant_levels = {}
            for slot in sorted(EXPECTED_TIER_SLOTS):
                slot_variant_levels[slot] = {
                    "verifiedCandidateItemLevels": sorted({
                        piece["itemLevel"] for piece in verified_variants
                        if piece.get("slot") == slot
                    }),
                    "observedOnlyItemLevels": sorted({
                        piece["itemLevel"] for piece in observation_variants_with_stats
                        if piece.get("slot") == slot
                    }),
                }
            tier_class_audit.append({
                "class": tier_set.get("class"),
                "basePieceCount": len(base_pieces),
                "baseSlotsPresent": sorted(base_slots),
                "missingBaseSlots": sorted(EXPECTED_TIER_SLOTS - base_slots),
                "verifiedVariantRecordCount": len(verified_pieces),
                "optimizerEligibleVariantRecordsWithLevelAndStats": len(verified_variants),
                "verifiedCandidateSlotsPresent": sorted(verified_slots),
                "missingVerifiedCandidateSlots": sorted(EXPECTED_TIER_SLOTS - verified_slots),
                "observedOnlyVariantRecordsWithLevelAndStats": len(observation_variants_with_stats),
                "observedOnlySlotsPresent": sorted(observed_slots),
                "missingObservedOnlySlots": sorted(EXPECTED_TIER_SLOTS - observed_slots),
                "slotVariantLevels": slot_variant_levels,
                "completeVariantMapVerified": tier_set.get("itemIdsVerified") is True,
                "variantCoverageStatus": (
                    "verified-candidates-present" if len(verified_variants) else
                    "observations-only" if observation_variants_with_stats else
                    "base-mapping-only" if base_pieces else "unavailable"
                ),
                "sourcePolicy": "Only explicit candidate=true variant records with item level and numeric stats count as optimizer-eligible here; observations are evidence only.",
            })

    return {
        "schemaVersion": 1,
        "auditScope": "all saved equipment-section files compared with the tier-piece ID manifest and per-class tier variant data",
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
        "tierVariantCoverage": {
            "dataAvailable": tier_variant_data_available,
            "classCount": len(tier_class_audit),
            "classes": tier_class_audit,
            "note": "Base item IDs and secondary-stat profiles do not prove numeric upgrade variants. Observed-only versions are not eligible candidates.",
        },
    }


def main():
    print(json.dumps(audit_catalog(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
