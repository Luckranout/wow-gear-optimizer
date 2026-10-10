import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "import_blizzard_data",
    ROOT / "scripts" / "import_blizzard_data.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ItemStatCoverageTests(unittest.TestCase):
    def test_item_level_alone_does_not_count_as_verified_stats(self):
        item = {"id": 1001, "name": "High Item Level", "level": 334, "stats": []}
        self.assertFalse(MODULE.item_has_verified_stats(item))

    def test_zero_or_malformed_values_do_not_count_as_verified_stats(self):
        cases = [
            {"stats": []},
            {"stats": [{"type": {"name": "Haste"}, "value": 0}]},
            {"stats": [{"type": {"name": "Haste"}, "value": None}]},
            {"stats": [{"type": {"name": "Haste"}, "value": "unknown"}]},
            {"stats": None},
        ]
        for item in cases:
            with self.subTest(item=item):
                self.assertFalse(MODULE.item_has_verified_stats(item))

    def test_nonzero_source_stats_count_as_verified(self):
        self.assertTrue(MODULE.item_has_verified_stats({
            "stats": [{"type": {"name": "Haste"}, "value": 12}]
        }))
        self.assertTrue(MODULE.item_has_verified_stats({
            "stats": {"haste": 12.5, "criticalStrike": 0}
        }))

    def test_coverage_reports_count_and_percentage(self):
        items = [
            {"id": 1, "level": 334, "stats": []},
            {"id": 2, "level": 318, "stats": [{"value": 0}]},
            {"id": 3, "level": 321, "stats": [{"value": 15}]},
            {"id": 4, "level": 305, "stats": {"versatility": 8}},
        ]
        report = MODULE.build_item_stat_coverage(items)
        self.assertEqual(report["candidateItemCount"], 4)
        self.assertEqual(report["itemsWithVerifiedStats"], 2)
        self.assertEqual(report["itemsMissingVerifiedStats"], 2)
        self.assertEqual(report["itemStatCoveragePercent"], 50.0)
        self.assertEqual(report["itemsWithAnyNumericStats"], 2)
        self.assertEqual(report["itemsMissingAnyNumericStats"], 2)
        self.assertEqual(report["itemRecordsWithAnyNumericStatsPercent"], 50.0)
        self.assertEqual(report["coverageMetricType"], "source-record-stat-presence-not-completeness")
        self.assertIn("does not prove that every expected stat", report["coveragePolicy"])
        self.assertIn("item level alone does not qualify", report["coveragePolicy"])

    def test_empty_catalog_reports_zero_coverage_without_division_error(self):
        report = MODULE.build_item_stat_coverage([])
        self.assertEqual(report["candidateItemCount"], 0)
        self.assertEqual(report["itemsWithVerifiedStats"], 0)
        self.assertEqual(report["itemsMissingVerifiedStats"], 0)
        self.assertEqual(report["itemStatCoveragePercent"], 0.0)
        self.assertEqual(report["itemsWithAnyNumericStats"], 0)
        self.assertEqual(report["itemsMissingAnyNumericStats"], 0)
        self.assertEqual(report["itemRecordsWithAnyNumericStatsPercent"], 0.0)


if __name__ == "__main__":
    unittest.main()
