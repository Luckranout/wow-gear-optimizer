import unittest

from scripts.verify_item_stat_coverage import has_numeric_stats, validate_dataset


def item(item_id, stats):
    return {"id": item_id, "stats": stats}


def dataset(items):
    verified = sum(has_numeric_stats(record) for record in items)
    return {
        "items": items,
        "apiCheck": {"itemStatCoverage": {
            "itemsWithVerifiedStats": verified,
            "itemsMissingVerifiedStats": len(items) - verified,
            "candidateItemCount": len(items),
        }},
    }


class ItemStatCoverageGateTests(unittest.TestCase):
    def test_accepts_complete_named_numeric_stats(self):
        value = dataset([
            item(1, [{"type": {"name": "Critical Strike"}, "value": 123}]),
            item(2, [{"stat": {"name": "Haste"}, "value": 45}]),
        ])
        self.assertEqual(validate_dataset(value), (2, 2))

    def test_rejects_empty_stats_when_any_candidate_is_incomplete(self):
        with self.assertRaisesRegex(ValueError, "lack named, non-zero numeric stats"):
            validate_dataset(dataset([item(1, []), item(2, [{"name": "Haste", "value": 12}])]))

    def test_rejects_unnamed_numeric_stat(self):
        self.assertFalse(has_numeric_stats(item(1, [{"value": 123}])))

    def test_rejects_boolean_and_non_finite_values(self):
        self.assertFalse(has_numeric_stats(item(1, [{"name": "Haste", "value": True}])))
        self.assertFalse(has_numeric_stats(item(2, [{"name": "Haste", "value": float("nan")}])))

    def test_rejects_duplicate_ids(self):
        with self.assertRaisesRegex(ValueError, "duplicate item IDs"):
            validate_dataset(dataset([item(1, [{"name": "Haste", "value": 12}]),
                                      item(1, [{"name": "Crit", "value": 12}])]))

    def test_rejects_inconsistent_importer_counts(self):
        value = dataset([item(1, [{"name": "Haste", "value": 12}])])
        value["apiCheck"]["itemStatCoverage"]["itemsMissingVerifiedStats"] = 1
        with self.assertRaisesRegex(ValueError, "missing-stat count"):
            validate_dataset(value)


if __name__ == "__main__":
    unittest.main()
