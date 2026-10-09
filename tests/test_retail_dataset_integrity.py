import json
import pathlib
import unittest
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "current-retail.json"
REQUIRED_SLOTS = {
    "Head", "Neck", "Shoulders", "Back", "Chest", "Wrists", "Hands",
    "Waist", "Legs", "Feet", "Ring 1", "Ring 2", "Trinket 1",
    "Trinket 2", "Main Hand", "Off Hand",
}
MAX_DATA_AGE_DAYS = 7


class RetailDatasetIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with DATA_PATH.open(encoding="utf-8") as handle:
            cls.data = json.load(handle)

    def test_dataset_has_current_retail_metadata_and_import_status(self):
        data = self.data
        self.assertEqual(data.get("game"), "World of Warcraft")
        self.assertEqual(data.get("mode"), "Retail")
        self.assertEqual(data.get("expansion"), "Midnight")
        self.assertGreaterEqual(int(data.get("season", 0)), 2)
        self.assertTrue(data.get("status"), "Dataset status must explain its import state.")
        self.assertNotEqual(data.get("status"), "pending-live-import")
        self.assertEqual(data.get("source"), "Blizzard Game Data API")

    def test_dataset_timestamp_is_valid_and_not_stale(self):
        raw_timestamp = self.data.get("updatedAt")
        self.assertTrue(raw_timestamp, "Dataset is missing updatedAt.")
        timestamp = datetime.fromisoformat(str(raw_timestamp).replace("Z", "+00:00"))
        self.assertIsNotNone(timestamp.tzinfo, "Dataset timestamp must include a timezone.")
        age_seconds = (datetime.now(timezone.utc) - timestamp.astimezone(timezone.utc)).total_seconds()
        self.assertGreaterEqual(age_seconds, -300, "Dataset timestamp is unexpectedly in the future.")
        self.assertLessEqual(
            age_seconds,
            MAX_DATA_AGE_DAYS * 24 * 60 * 60,
            f"Dataset is older than {MAX_DATA_AGE_DAYS} days; refresh it before treating it as current.",
        )

    def test_item_catalog_is_nonempty_unique_and_slot_valid(self):
        items = self.data.get("items")
        self.assertIsInstance(items, list)
        self.assertGreater(len(items), 0, "Retail gear catalog is empty.")
        seen_ids = set()
        for item in items:
            self.assertIsInstance(item, dict)
            self.assertIsNotNone(item.get("id"), "Catalog item is missing its Blizzard item ID.")
            self.assertTrue(str(item.get("name", "")).strip(), "Catalog item is missing its name.")
            self.assertIn(item.get("slot"), REQUIRED_SLOTS, f"Unsupported or missing slot for item {item.get('id')}.")
            item_id = str(item["id"])
            self.assertNotIn(item_id, seen_ids, f"Duplicate Blizzard item ID: {item_id}.")
            seen_ids.add(item_id)

    def test_import_audit_counts_match_published_catalog(self):
        audit = self.data.get("apiCheck")
        self.assertIsInstance(audit, dict, "Dataset is missing its import audit.")
        self.assertEqual(audit.get("gearItemCount"), len(self.data["items"]))
        self.assertGreater(audit.get("candidateItemCount", 0), 0)
        self.assertGreater(audit.get("talentSpecializationCount", 0), 0)
        self.assertGreater(audit.get("talentTreeCount", 0), 0)
        self.assertGreater(audit.get("professionRecipeCount", 0), 0)
        self.assertGreater(audit.get("upgradeTrackCount", 0), 0)
        pvp_season = audit.get("pvpSeason") or {}
        self.assertEqual(pvp_season.get("id"), 42, "PvP season metadata does not match the supported Season 2 policy.")
        self.assertEqual(pvp_season.get("name"), "Midnight Season 2")
        self.assertGreater(pvp_season.get("gearItemCount", 0), 0, "No current-season PvP gear candidates were audited.")


if __name__ == "__main__":
    unittest.main()
