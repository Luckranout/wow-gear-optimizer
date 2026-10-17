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

            report = audit_catalog(sections, manifest)

        self.assertFalse(report["allGearCatalogueComplete"])
        self.assertEqual(report["totalUniqueSectionItemIds"], 1)
        self.assertEqual(report["tierSetCoverage"]["manifestPieceCount"], 2)
        self.assertEqual(report["tierSetCoverage"]["piecesPresentInEquipmentSections"], 1)
        self.assertEqual(report["tierSetCoverage"]["piecesMissingFromEquipmentSections"], 1)
        self.assertEqual(report["tierSetCoverage"]["missingPieces"][0]["itemId"], 11)
        self.assertFalse(report["sections"]["head"]["allGearCoverage"])
        self.assertEqual(report["sections"]["head"]["recordedVariantCount"], 1)


if __name__ == "__main__":
    unittest.main()
