import json
import tempfile
import unittest
from pathlib import Path

from scripts.audit_equipment_catalog import audit_catalog


class EquipmentCatalogueAuditTests(unittest.TestCase):
    def test_reports_missing_tier_items_and_does_not_claim_full_gear_coverage(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sections = root / "sections"
            sections.mkdir()
            (sections / "head.json").write_text(json.dumps({
                "complete": True,
                "items": [{"id": 10, "variants": [{"itemLevel": 300}]}],
            }), encoding="utf-8")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({
                "sets": [
                    {"className": "Mage", "pieces": [
                        {"itemId": 10, "name": "Present", "slot": "Head"},
                        {"itemId": 11, "name": "Missing", "slot": "Chest"},
                    ]}
                ]
            }), encoding="utf-8")
            tier_data = root / "tier-data.json"
            tier_data.write_text(json.dumps({
                "sets": [
                    {
                        "class": "Mage",
                        "basePieces": [{"itemId": 10, "slot": "Head"}],
                        "pieces": [],
                        "verifiedVariantObservations": [{
                            "itemId": 10, "itemLevel": 300, "candidate": False,
                            "stats": [{"type": {"name": "haste"}, "value": 10}],
                        }],
                    }
                ]
            }), encoding="utf-8")

            report = audit_catalog(sections, manifest, tier_data)

        self.assertFalse(report["allGearCatalogueComplete"])
        self.assertEqual(report["totalUniqueSectionItemIds"], 1)
        self.assertEqual(report["tierSetCoverage"]["manifestPieceCount"], 2)
        self.assertEqual(report["tierSetCoverage"]["piecesPresentInEquipmentSections"], 1)
        self.assertEqual(report["tierSetCoverage"]["piecesMissingFromEquipmentSections"], 1)
        self.assertEqual(report["tierSetCoverage"]["missingPieces"][0]["itemId"], 11)
        self.assertFalse(report["sections"]["head"]["allGearCoverage"])
        self.assertEqual(report["sections"]["head"]["recordedVariantCount"], 1)
        mage = report["tierVariantCoverage"]["classes"][0]
        self.assertEqual(mage["missingBaseSlots"], ["Chest", "Hands", "Legs", "Shoulders"])
        self.assertEqual(mage["observedOnlyVariantRecordsWithLevelAndStats"], 1)
        self.assertEqual(mage["optimizerEligibleVariantRecordsWithLevelAndStats"], 0)
        self.assertEqual(mage["variantCoverageStatus"], "observations-only")

    def test_counts_only_explicit_candidate_variants_with_numeric_stats(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sections = root / "sections"
            sections.mkdir()
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"sets": []}), encoding="utf-8")
            tier_data = root / "tier-data.json"
            tier_data.write_text(json.dumps({
                "sets": [{
                    "class": "Shaman",
                    "basePieces": [],
                    "pieces": [
                        {"candidate": True, "itemLevel": 324, "stats": [{"type": {"name": "agility"}, "value": 172}]},
                        {"candidate": False, "itemLevel": 324, "stats": [{"type": {"name": "agility"}, "value": 172}]},
                        {"candidate": True, "itemLevel": 324, "stats": []},
                    ],
                    "verifiedVariantObservations": [],
                }]
            }), encoding="utf-8")

            report = audit_catalog(sections, manifest, tier_data)

        shaman = report["tierVariantCoverage"]["classes"][0]
        self.assertEqual(shaman["optimizerEligibleVariantRecordsWithLevelAndStats"], 1)
        self.assertEqual(shaman["variantCoverageStatus"], "verified-candidates-present")


if __name__ == "__main__":
    unittest.main()
