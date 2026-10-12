"""Regression coverage for Mindpiercer's temporary Intellect tooltip proc."""
import unittest
from unittest.mock import patch

from scripts import import_blizzard_data as importer


class MindpiercerImporterRegressionTests(unittest.TestCase):
    ITEM_ID = 250224
    TEMPORARY_PROC = [{"type": {"name": "intellect"}, "value": 561}]

    @patch.object(importer.time, "sleep")
    @patch.object(importer, "fetch_wowhead_tooltip_stats")
    @patch.object(importer, "normalize_item")
    @patch.object(importer, "get_api_json")
    @patch.object(importer, "item_has_verified_stats")
    def test_temporary_wowhead_intellect_is_not_permanent_item_stat(
        self, has_verified_stats, get_api_json, normalize_item, fetch_tooltip, _sleep
    ):
        get_api_json.return_value = {"id": self.ITEM_ID, "is_equippable": True}
        normalize_item.return_value = {
            "id": self.ITEM_ID,
            "name": "Mindpiercer's Sigil",
            "stats": [],
        }
        has_verified_stats.return_value = False
        fetch_tooltip.return_value = self.TEMPORARY_PROC

        items = importer.fetch_item_details(
            token="test-token",
            item_ids=[self.ITEM_ID],
            item_sources={self.ITEM_ID: ["test-source"]},
        )

        self.assertEqual(len(items), 1, "the catalog record must be preserved")
        item = items[0]
        self.assertEqual(item["id"], self.ITEM_ID)
        self.assertEqual(item["stats"], [], "temporary 561 Intellect must not become a permanent stat")
        self.assertEqual(
            item["statsSource"],
            "Wowhead tooltip (effect-only; excluded from permanent stats)",
        )
        self.assertEqual(item["catalogClassification"], "effect-only-unmodeled")
        self.assertFalse(item["optimizerEligible"])

    @patch.object(importer.time, "sleep")
    @patch.object(importer, "fetch_wowhead_tooltip_stats")
    @patch.object(importer, "normalize_item")
    @patch.object(importer, "get_api_json")
    @patch.object(importer, "item_has_verified_stats")
    def test_blizzard_verified_stats_are_not_replaced_by_tooltip_rule(
        self, has_verified_stats, get_api_json, normalize_item, fetch_tooltip, _sleep
    ):
        permanent_stats = [{"type": {"name": "stamina"}, "value": 100}]
        get_api_json.return_value = {"id": self.ITEM_ID, "is_equippable": True}
        normalize_item.return_value = {
            "id": self.ITEM_ID,
            "name": "Mindpiercer's Sigil",
            "stats": permanent_stats.copy(),
            "statsSource": "Blizzard Game Data API",
        }
        has_verified_stats.return_value = True

        items = importer.fetch_item_details(
            token="test-token",
            item_ids=[self.ITEM_ID],
            item_sources={self.ITEM_ID: ["test-source"]},
        )

        self.assertEqual(items[0]["stats"], permanent_stats)
        self.assertEqual(items[0]["statsSource"], "Blizzard Game Data API")
        fetch_tooltip.assert_not_called()


if __name__ == "__main__":
    unittest.main()
