import unittest

from scripts.verify_item_stat_coverage import validate_dataset


def valid_item(item_id, stats):
    return {
        "id": item_id,
        "name": f"Test item {item_id}",
        "isEquippable": True,
        "statsSource": "Blizzard Game Data API",
        "stats": stats,
    }


def dataset(items, reported=None):
    if reported is None:
        reported = sum(
            1 for item in items
            if any(
                isinstance(stat, dict)
                and isinstance(stat.get("value"), (int, float))
                and not isinstance(stat.get("value"), bool)
                and stat.get("value") != 0
                for stat in (item.get("stats") or [])
            )
        )
    return {
        "items": items,
        "apiCheck": {"itemStatCoverage": {"itemsWithVerifiedStats": reported}},
    }


class ItemStatCoverageGateTests(unittest.TestCase):
    def test_rejects_empty_catalog(self):
        with self.assertRaisesRegex(ValueError, "contains no items"):
            validate_dataset(dataset([]))

    def test_rejects_known_bad_catalog_with_empty_stats(self):
        with self.assertRaisesRegex(ValueError, "no item record"):
            validate_dataset(dataset([valid_item(1, []), valid_item(2, [])], 0))

    def test_rejects_zero_only_stats(self):
        with self.assertRaisesRegex(ValueError, "no item record"):
            validate_dataset(dataset([valid_item(1, [{"value": 0}])], 0))

    def test_rejects_string_boolean_and_nonfinite_values(self):
        items = [valid_item(1, [{"value": "12"}, {"value": True}, {"value": float("nan")}])]
        with self.assertRaisesRegex(ValueError, "no item record"):
            validate_dataset(dataset(items, 0))

    def test_accepts_real_numeric_stats_when_count_matches(self):
        total, verified = validate_dataset(dataset([
            valid_item(1, [{"value": 12}]),
            valid_item(2, [{"value": 0}, {"value": 7.5}]),
        ], 2))
        self.assertEqual((total, verified), (2, 2))

    def test_accepts_explicitly_sourced_cosmetic_without_combat_stats(self):
        cosmetic = {
            "id": 3,
            "name": "Test cosmetic",
            "isEquippable": True,
            "catalogClassification": "cosmetic",
            "classificationSource": "Wowhead tooltip explicitly labels item Cosmetic",
            "stats": [],
        }
        total, verified = validate_dataset(dataset([
            valid_item(1, [{"value": 12}]),
            cosmetic,
        ], 1))
        self.assertEqual((total, verified), (2, 1))

    def test_rejects_cosmetic_classification_without_source(self):
        cosmetic = {
            "id": 4,
            "name": "Unproven cosmetic",
            "catalogClassification": "cosmetic",
            "stats": [],
        }
        with self.assertRaisesRegex(ValueError, "classification lacks explicit source provenance"):
            validate_dataset(dataset([cosmetic], 0))

    def test_accepts_only_source_verified_permafrost_effect_only_exception(self):
        permafrost = {
            "id": 250244,
            "name": "Permafrost Essence",
            "isEquippable": True,
            "catalogClassification": "effect-based",
            "optimizationStatus": "unsupported_conditional_effect",
            "conditionalEffectsSupported": False,
            "optimizationStatusSource": "Wowhead tooltip explicitly contains Mark of Frost and Frost Barrier; effect scaling/model unresolved",
            "stats": [],
        }
        total, verified = validate_dataset(dataset([
            valid_item(1, [{"value": 12}]),
            permafrost,
        ], 1))
        self.assertEqual((total, verified), (2, 1))

    def test_rejects_unproven_or_different_effect_only_exception(self):
        bad = {
            "id": 250245,
            "name": "Other item",
            "isEquippable": True,
            "catalogClassification": "effect-based",
            "optimizationStatus": "unsupported_conditional_effect",
            "conditionalEffectsSupported": False,
            "optimizationStatusSource": "Wowhead tooltip explicitly contains Mark of Frost and Frost Barrier; effect scaling/model unresolved",
            "stats": [],
        }
        with self.assertRaisesRegex(ValueError, "no non-zero numeric stats"):
            validate_dataset(dataset([valid_item(1, [{"value": 12}]), bad], 1))

    def test_rejects_mismatched_reported_count(self):
        with self.assertRaisesRegex(ValueError, "does not match"):
            validate_dataset(dataset([valid_item(1, [{"value": 12}])], 0))


if __name__ == "__main__":
    unittest.main()
