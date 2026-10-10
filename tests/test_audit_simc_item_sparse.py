import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "audit_simc_item_sparse",
    ROOT / "scripts" / "audit_simc_item_sparse.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SimcItemSparseAuditTests(unittest.TestCase):
    def test_keeps_stat_type_ids_unmapped_and_reports_nonzero_pairs(self):
        report = MODULE.audit_records([
            {
                "id": 123,
                "name": "Test item",
                "item_level": 300,
                "stat_type_1": 4,
                "stat_alloc_1": 27,
                "stat_type_2": 0,
                "stat_alloc_2": 0,
                "hotfixed": True,
            }
        ])
        self.assertEqual(report["recordCount"], 1)
        self.assertEqual(report["recordsWithValidItemIds"], 1)
        self.assertEqual(report["recordsWithStatPairs"], 1)
        self.assertEqual(report["recordsWithNonzeroStatPairs"], 1)
        self.assertEqual(
            report["exampleRecords"][0]["statPairs"],
            [{"statTypeId": 4, "value": 27}],
        )
        self.assertTrue(report["exampleRecords"][0]["hotfixed"])
        self.assertIn("not converted", report["policy"])

    def test_legacy_stat_value_field_is_supported(self):
        report = MODULE.audit_records([{
            "id": 456,
            "stat_type_1": 3,
            "stat_value_1": 12,
        }])
        self.assertEqual(report["recordsWithNonzeroStatPairs"], 1)
        self.assertEqual(
            report["exampleRecords"][0]["statPairs"],
            [{"statTypeId": 3, "value": 12}],
        )

    def test_item_level_without_stats_does_not_count(self):
        report = MODULE.audit_records([{"id": 123, "item_level": 999}])
        self.assertEqual(report["recordsWithStatPairs"], 0)
        self.assertEqual(report["recordsWithNonzeroStatPairs"], 0)

    def test_malformed_stat_pair_is_reported_not_guessed(self):
        report = MODULE.audit_records([{
            "id": 123,
            "stat_type_1": 4,
            "stat_alloc_1": "unknown",
        }])
        self.assertEqual(report["recordsWithMalformedStatFields"], 1)
        self.assertEqual(report["recordsWithNonzeroStatPairs"], 0)

    def test_empty_or_wrong_root_fails(self):
        with self.assertRaises(ValueError):
            MODULE.audit_records([])
        with self.assertRaises(ValueError):
            MODULE.audit_records({"id": 1})


if __name__ == "__main__":
    unittest.main()
