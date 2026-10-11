import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "audit_simc_item_sparse.py"
SPEC = importlib.util.spec_from_file_location("audit_simc_item_sparse", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ItemSparseAuditTests(unittest.TestCase):
    def test_curve_fields_are_reported_but_do_not_claim_scaling_verified(self):
        record = {
            "id": 123,
            "item_level": 700,
            "stat_type_1": 4,
            "stat_alloc_1": 100,
            "player_level_to_item_level_curve_id": 12,
            "item_level_offset_curve_id": 13,
            "item_level_offset_item_level": 700,
            "item_squish_era_id": 2,
        }
        report = MODULE.audit_records([record])
        self.assertTrue(report["currentItemCurveFieldsPresent"])
        self.assertEqual(report["itemLevelCurveReferenceCoverage"]["item_level_offset_curve_id"], 1)
        self.assertFalse(report["finalStatScalingVerified"])

    def test_missing_curve_fields_are_not_silently_assumed(self):
        report = MODULE.audit_records([{"id": 123, "stat_type_1": 4, "stat_alloc_1": 100}])
        self.assertFalse(report["currentItemCurveFieldsPresent"])
        self.assertFalse(report["finalStatScalingVerified"])
        self.assertIn("stat_alloc_1", report["observedFields"])


if __name__ == "__main__":
    unittest.main()
