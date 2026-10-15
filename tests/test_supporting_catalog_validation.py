import unittest

from scripts.import_blizzard_data import (
    SEASON_SCOPE,
    validate_supporting_catalogs,
)


def recipe(recipe_id=1, name="Test recipe", crafted_item_id=10):
    return {
        "id": recipe_id,
        "name": name,
        "profession": "Jewelcrafting",
        "craftedItemId": crafted_item_id,
        "seasonScope": SEASON_SCOPE,
        "source": "Blizzard Game Data API — current Midnight profession recipe",
        "item": {"id": crafted_item_id, "name": "Test item"},
    }


class SupportingCatalogValidationTests(unittest.TestCase):
    def test_accepts_empty_or_valid_catalogs_and_reports_counts(self):
        result = validate_supporting_catalogs(
            [recipe()], [recipe(2, "Enchant test", None)],
            {"food": [recipe(3, "Meal", 30)], "potions": [], "flaskOrPhial": [], "other": []},
        )
        self.assertEqual(result["gems"], 1)
        self.assertEqual(result["enchants"], 1)
        self.assertEqual(result["consumables.food"], 1)
        self.assertEqual(result["consumables.potions"], 0)

    def test_rejects_missing_source_and_season_scope(self):
        record = recipe()
        record.pop("source")
        record["seasonScope"] = "Legacy"
        with self.assertRaisesRegex(RuntimeError, "source attribution"):
            validate_supporting_catalogs([record], [], {})

    def test_rejects_malformed_linked_item(self):
        record = recipe()
        record["item"] = {"id": "not-an-id", "name": ""}
        with self.assertRaisesRegex(RuntimeError, "malformed linked item metadata"):
            validate_supporting_catalogs([record], [], {})

    def test_rejects_duplicate_recipe_output_pairs(self):
        with self.assertRaisesRegex(RuntimeError, "duplicates recipe/output pair"):
            validate_supporting_catalogs([recipe(), recipe()], [], {})

    def test_rejects_non_list_bucket(self):
        with self.assertRaisesRegex(RuntimeError, "consumables.food must be a list"):
            validate_supporting_catalogs([], [], {"food": None})


if __name__ == "__main__":
    unittest.main()
