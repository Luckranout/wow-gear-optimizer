import unittest

from scripts.import_blizzard_data import classify_consumables


class ConsumableClassificationTests(unittest.TestCase):
    def setUp(self):
        self.items = [
            {"id": 1, "name": "Silvermoon Parade", "itemClass": {"id": 0}},
            {"id": 2, "name": "Flask of the Blood Knights", "itemClass": {"id": 0}},
            {"id": 3, "name": "Light's Potential", "itemClass": {"id": 0}},
            {"id": 4, "name": "Thalassian Phoenix Oil", "itemClass": {"id": 0}},
            {"id": 5, "name": "Unrelated crafting material", "itemClass": {"id": 0}},
        ]
        self.recipes = [
            {"id": 101, "name": "Silvermoon Parade", "profession": "Cooking", "craftedItemId": 1},
            {"id": 102, "name": "Flask of the Blood Knights", "profession": "Alchemy", "craftedItemId": 2},
            {"id": 103, "name": "Light's Potential", "profession": "Alchemy", "craftedItemId": 3},
            {"id": 104, "name": "Thalassian Phoenix Oil", "profession": "Alchemy", "craftedItemId": 4},
            {"id": 105, "name": "Unrelated crafting material", "profession": "Alchemy", "craftedItemId": 5},
        ]

    def test_classifies_food_flasks_potions_and_weapon_oils(self):
        result = classify_consumables(self.recipes, self.items)
        self.assertEqual([r["craftedItemId"] for r in result["food"]], [1])
        self.assertEqual([r["craftedItemId"] for r in result["flaskOrPhial"]], [2])
        self.assertEqual([r["craftedItemId"] for r in result["potions"]], [3])
        self.assertEqual([r["craftedItemId"] for r in result["other"]], [4])

    def test_retains_recipe_and_item_provenance(self):
        result = classify_consumables(self.recipes, self.items)
        food = result["food"][0]
        self.assertEqual(food["id"], 101)
        self.assertEqual(food["item"]["id"], 1)
        self.assertIn("Blizzard profession recipe output", food["classificationSource"])

    def test_does_not_misclassify_unrecognized_alchemy_outputs(self):
        result = classify_consumables(self.recipes, self.items)
        all_records = sum(result.values(), [])
        self.assertNotIn(105, [r["id"] for r in all_records])

    def test_empty_inputs_return_all_expected_buckets(self):
        self.assertEqual(
            classify_consumables([], []),
            {"food": [], "flaskOrPhial": [], "potions": [], "other": []},
        )


if __name__ == "__main__":
    unittest.main()
