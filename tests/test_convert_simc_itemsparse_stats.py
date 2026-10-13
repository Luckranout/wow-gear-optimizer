import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "convert_simc_itemsparse_stats", ROOT / "scripts" / "convert_simc_itemsparse_stats.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ItemSparseStatConversionTests(unittest.TestCase):
    def test_maps_only_explicitly_verified_ids(self):
        item = MODULE.convert_record({
            "id": 123,
            "name": "Synthetic test only",
            "item_level": 300,
            "stat_type_1": 4,
            "stat_alloc_1": 27,
            "stat_type_2": 32,
            "stat_alloc_2": 18,
            "stat_type_3": 999,
            "stat_alloc_3": 50,
        })
        self.assertEqual(item["stats"], {"strength": 27, "criticalStrike": 18})
        self.assertEqual(item["unmappedStatPairs"], [{"statTypeId": 999, "value": 50}])
        self.assertFalse(item["fullyMapped"])
        report = MODULE.convert_records([{"id": 1, "stat_type_1": 999, "stat_alloc_1": 5}])
        self.assertEqual(report["unmappedStatIdPairCounts"], {"999": 1})

    def test_no_stats_are_invented_from_item_level(self):
        item = MODULE.convert_record({"id": 1, "item_level": 999})
        self.assertEqual(item["stats"], {})
        self.assertFalse(item["fullyMapped"])

    def test_malformed_pairs_are_not_guessed(self):
        item = MODULE.convert_record({"id": 1, "stat_type_1": 4, "stat_alloc_1": "unknown"})
        self.assertEqual(item["stats"], {})
        self.assertEqual(len(item["malformedStatPairs"]), 1)

    def test_empty_input_fails(self):
        with self.assertRaises(ValueError):
            MODULE.convert_records([])


if __name__ == "__main__":
    unittest.main()
