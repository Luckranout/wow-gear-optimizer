"""Regression coverage for the verified Wavecaller's Seastone Ascendant Venomforged Myth variant."""
import json
import pathlib
import unittest
from unittest.mock import patch

from scripts import import_blizzard_data as importer


ROOT = pathlib.Path(__file__).resolve().parents[1]
ITEM_ID = 270167
BONUS_IDS = [6652, 13335, 12854]
EXPECTED_STATS = [{"type": {"name": "haste"}, "value": 147, "source": "Wowhead tooltip"}]


class WavecallerVariantRegressionTests(unittest.TestCase):
    @patch.object(importer.time, "sleep")
    @patch.object(importer, "fetch_wowhead_tooltip_stats")
    @patch.object(importer, "normalize_item")
    @patch.object(importer, "get_api_json")
    @patch.object(importer, "item_has_verified_stats")
    def test_importer_requests_verified_340_variant(
        self, has_verified_stats, get_api_json, normalize_item, fetch_tooltip, _sleep
    ):
        get_api_json.return_value = {"id": ITEM_ID, "is_equippable": True}
        normalize_item.return_value = {
            "id": ITEM_ID,
            "name": "Wavecaller's Seastone",
            "level": 219,
            "stats": [{"type": {"name": "haste"}, "value": 76}],
        }
        has_verified_stats.return_value = True
        fetch_tooltip.return_value = EXPECTED_STATS

        items = importer.fetch_item_details(
            token="test-token",
            item_ids=[ITEM_ID],
            item_sources={ITEM_ID: ["test-source"]},
        )

        self.assertEqual(len(items), 1)
        variant = items[0]["variants"][0]
        self.assertEqual(variant["itemLevel"], 340)
        self.assertEqual(variant["level"], 340)
        self.assertEqual(variant["description"], "Equip: Your spells have a high chance to call to the sea, granting Tidal Insight to increase your Intellect by 65 up to 6 times. After reaching its peak, your spells instead diminish Tidal Insight before beginning the cycle anew.")
        self.assertEqual(variant["stats"], EXPECTED_STATS)
        self.assertEqual(variant["bonusIds"], BONUS_IDS)
        self.assertIn("340", variant["statsSource"])
        self.assertIn("340", variant["variantKey"])
        fetch_tooltip.assert_called_once_with(
            ITEM_ID, importer.wowhead_diagnostics if hasattr(importer, "wowhead_diagnostics") else unittest.mock.ANY,
            bonus_ids=BONUS_IDS, item_level=340,
        )

    def test_checked_in_catalog_matches_verified_340_variant(self):
        catalog = json.loads((ROOT / "data" / "equipment-sections" / "trinkets.json").read_text())
        item = next(entry for entry in catalog["items"] if entry.get("id") == ITEM_ID)
        variant = next(entry for entry in item["variants"] if entry.get("variantKey", "").endswith("ilvl340"))
        self.assertEqual(variant["itemLevel"], 334)
        self.assertEqual(variant["level"], 334)
        self.assertEqual(variant["description"], "Equip: Your spells have a high chance to call to the sea, granting Tidal Insight to increase your Intellect by 65 up to 6 times. After reaching its peak, your spells instead diminish Tidal Insight before beginning the cycle anew.")
        self.assertIn("Tidal Insight", variant["description"])
        self.assertIn("Intellect by 65", variant["description"])
        self.assertEqual(
            [(stat["type"]["name"], stat["value"]) for stat in variant["stats"]],
            [("haste", 147)],
        )
        self.assertEqual(variant["bonusIds"], BONUS_IDS)
        self.assertIn("340", variant["variantSource"])


if __name__ == "__main__":
    unittest.main()
