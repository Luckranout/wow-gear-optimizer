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

    def test_context_dependent_ids_are_not_scored_as_scalar_stats(self):
        item = MODULE.convert_record({
            "id": 2,
            "stat_type_1": 73,
            "stat_alloc_1": 10,
            "stat_type_2": 13,
            "stat_alloc_2": 4,
        })
        self.assertEqual(item["stats"], {})
        self.assertEqual(
            {pair["statTypeId"] for pair in item["contextDependentStatPairs"]},
            {13, 73},
        )
        self.assertFalse(item["fullyMapped"])
        report = MODULE.convert_records([{
            "id": 3, "stat_type_1": 71, "stat_alloc_1": 5
        }])
        self.assertEqual(report["contextDependentStatIdPairCounts"], {"71": 1})

    def test_bonus_and_resistance_ids_are_classified_not_guessed(self):
        item = MODULE.convert_record({
            "id": 4,
            "stat_type_1": 24, "stat_alloc_1": 5,
            "stat_type_2": 25, "stat_alloc_2": 7,
            "stat_type_3": 51, "stat_alloc_3": 2,
            "stat_type_4": 52, "stat_alloc_4": 3,
            "stat_type_5": 54, "stat_alloc_5": 4,
            "stat_type_6": 55, "stat_alloc_6": 6,
        })
        self.assertEqual(item["stats"], {})
        self.assertEqual(
            {pair["statTypeId"] for pair in item["contextDependentStatPairs"]},
            {24, 25, 51, 52, 54, 55},
        )
        self.assertFalse(item["fullyMapped"])

    def test_known_legacy_ids_are_classified_but_not_scored(self):
        item = MODULE.convert_record({
            "id": 5,
            "stat_type_1": 6, "stat_alloc_1": 2,
            "stat_type_2": 20, "stat_alloc_2": 3,
            "stat_type_3": 38, "stat_alloc_3": 4,
            "stat_type_4": 39, "stat_alloc_4": 5,
            "stat_type_5": 41, "stat_alloc_5": 6,
            "stat_type_6": 45, "stat_alloc_6": 7,
            "stat_type_7": 46, "stat_alloc_7": 8,
            "stat_type_8": 50, "stat_alloc_8": 9,
            "stat_type_9": 56, "stat_alloc_9": 10,
            "stat_type_10": 64, "stat_alloc_10": 1,
        })
        self.assertEqual(item["stats"], {})
        self.assertEqual(
            {pair["statTypeId"] for pair in item["contextDependentStatPairs"]},
            {6, 20, 38, 39, 41, 45, 46, 50, 56, 64},
        )
        self.assertFalse(item["fullyMapped"])

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
