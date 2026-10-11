import unittest

from scripts.verify_item_stat_coverage import validate_dataset


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
            validate_dataset(dataset([{"id": 1, "stats": []}, {"id": 2, "stats": []}], 0))

    def test_rejects_zero_only_stats(self):
        with self.assertRaisesRegex(ValueError, "no item record"):
            validate_dataset(dataset([{"id": 1, "stats": [{"value": 0}]}], 0))

    def test_rejects_string_boolean_and_nonfinite_values(self):
        items = [{"id": 1, "stats": [{"value": "12"}, {"value": True}, {"value": float("nan")}]}]
        with self.assertRaisesRegex(ValueError, "no item record"):
            validate_dataset(dataset(items, 0))

    def test_accepts_real_numeric_stats_when_count_matches(self):
        total, verified, cosmetics = validate_dataset(dataset([
            {"id": 1, "stats": [{"value": 12}]},
            {"id": 2, "stats": [{"value": 0}, {"value": 7.5}]},
            {"id": 3, "stats": []},
        ], 2))
        self.assertEqual((total, verified, cosmetics), (3, 2, 0))

    def test_rejects_mismatched_reported_count(self):
        with self.assertRaisesRegex(ValueError, "does not match"):
            validate_dataset(dataset([{"id": 1, "stats": [{"value": 12}]}], 0))

    def test_explicitly_source_proven_cosmetic_can_lack_numeric_stats(self):
        items = [
            {"id": 100, "name": "Combat Ring", "stats": [{"value": 12}]},
            {
                "id": 258045,
                "name": "Dawnblade's Glaives",
                "stats": [],
                "catalogClassification": "cosmetic",
                "classificationSource": "Wowhead tooltip explicitly labels item Cosmetic",
                "wowheadTooltipClassificationEvidence": "Explicit Cosmetic label in tooltip",
            },
        ]
        self.assertEqual(validate_dataset(dataset(items)), (2, 1, 1))

    def test_cosmetic_flag_without_source_evidence_does_not_bypass_gate(self):
        items = [
            {"id": 100, "name": "Combat Ring", "stats": [{"value": 12}]},
            {"id": 258045, "name": "Unverified Item", "stats": [], "catalogClassification": "cosmetic"},
        ]
        with self.assertRaisesRegex(ValueError, "lack verified non-zero numeric stats"):
            validate_dataset(dataset(items))

    def test_permafrost_effect_only_item_does_not_bypass_base_stat_gate(self):
        items = [
            {"id": 100, "name": "Combat Ring", "stats": [{"value": 12}]},
            {
                "id": 250244,
                "name": "Permafrost Essence",
                "stats": [],
                "effects": [{"description": "Conditional Mark of Frost effect"}],
            },
        ]
        with self.assertRaisesRegex(ValueError, "250244 Permafrost Essence"):
            validate_dataset(dataset(items))

    unittest.main()
