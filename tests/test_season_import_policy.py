import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "import_blizzard_data",
    ROOT / "scripts" / "import_blizzard_data.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SeasonImportPolicyTests(unittest.TestCase):
    def test_current_season_discovery_uses_newest_exposed_id(self):
        original = MODULE.get_api_json
        try:
            MODULE.get_api_json = lambda path, *args, **kwargs: (
                {
                    "pvp_seasons": [
                        {"id": 41, "name": {"en_US": "Midnight Season 1"}},
                        {"id": 42},
                    ]
                }
                if path.endswith("/pvp-season/index")
                else {"name": {"en_US": "Midnight Season 2"}}
            )
            season_id, season_name = MODULE.discover_current_pvp_season("token")
            self.assertEqual(season_id, 42)
            self.assertEqual(season_name, "Midnight Season 2")
        finally:
            MODULE.get_api_json = original

    def test_unsupported_season_is_rejected_before_publish(self):
        with self.assertRaises(RuntimeError):
            MODULE.enforce_supported_season(43, "Midnight Season 3")

    def test_supported_season_is_allowed(self):
        MODULE.enforce_supported_season(42, "Midnight Season 2")

    def test_crest_cap_is_active_before_blizzard_lift_date(self):
        before = MODULE.CREST_CAP_LIFT_DATE.replace(day=19)
        rules = MODULE.collect_upgrade_and_crest_data(before)
        self.assertEqual(rules["weeklyCrestCap"], 100)
        self.assertEqual(rules["crestCapStatus"], "active")

    def test_crest_cap_is_lifted_on_blizzard_effective_date(self):
        rules = MODULE.collect_upgrade_and_crest_data(MODULE.CREST_CAP_LIFT_DATE)
        self.assertIsNone(rules["weeklyCrestCap"])
        self.assertEqual(rules["crestCapStatus"], "lifted")
        self.assertTrue(all(track["weeklyCrestCap"] is None for track in rules["tracks"]))


    def test_tier_set_coverage_validation_accepts_complete_catalog(self):
        expected = sorted(MODULE.SEASON_TIER_SET_NAMES)
        self.assertTrue(MODULE.validate_season_tier_set_coverage(expected, []))

    def test_tier_set_coverage_validation_fails_closed_when_sets_are_missing(self):
        with self.assertRaisesRegex(RuntimeError, "Refusing to publish an incomplete Season 2 tier-set catalog"):
            MODULE.validate_season_tier_set_coverage(
                ["Ophidian Oracle's Prophecy"],
                ["Cosmic Penitent Raiment"],
            )

    def test_tier_set_coverage_validation_fails_closed_when_no_item_ids_are_extracted(self):
        expected = sorted(MODULE.SEASON_TIER_SET_NAMES)
        with self.assertRaisesRegex(RuntimeError, "zero tier-set item IDs"):
            MODULE.validate_season_tier_set_coverage(expected, [], {})
        self.assertTrue(
            MODULE.validate_season_tier_set_coverage(expected, [], {271481: [{"sourceType": "tier-set"}]})
        )

    def test_current_season_tier_pieces_are_collected_from_item_set_api(self):
        self.assertEqual(
            MODULE.normalize_tier_set_name("Cosmic Penitent Raiment"),
            MODULE.normalize_tier_set_name("Cosmic Penitent's Raiment"),
        )
        self.assertEqual(
            MODULE.normalize_tier_set_name("Chosen Bloodslayer Hexweave"),
            MODULE.normalize_tier_set_name("Chosen Bloodslayer's Hexweave"),
        )
        original_get_api_json = MODULE.get_api_json
        original_sleep = MODULE.time.sleep
        calls = []

        def fake_get_api_json(path, *args, **kwargs):
            calls.append(path)
            if path == "/data/wow/item-set/index":
                return {
                    "item_sets": [
                        {"id": 901, "name": {"en_US": "Ophidian Oracle's Prophecy"}},
                        {"id": 902, "name": {"en_US": "Old Expansion Set"}},
                    ]
                }
            if path == "/data/wow/item-set/901":
                return {
                    "id": 901,
                    "name": {"en_US": "Ophidian Oracle's Prophecy"},
                    "items": [
                        {"item": {"id": 271481, "name": "Hissing Mantle of the Ophidian Oracle"}},
                        {"item": {"id": 271482, "name": "Leggings of the Ophidian Oracle"}},
                        {"item": {"name": "Malformed item reference"}},
                    ],
                }
            raise AssertionError(f"Unexpected API path: {path}")

        try:
            MODULE.get_api_json = fake_get_api_json
            MODULE.time.sleep = lambda *_args, **_kwargs: None
            item_sources, matched_sets, missing_sets = MODULE.collect_season_tier_set_item_ids("token")
        finally:
            MODULE.get_api_json = original_get_api_json
            MODULE.time.sleep = original_sleep

        self.assertEqual(matched_sets, ["Ophidian Oracle's Prophecy"])
        self.assertIn("Ophidian Oracle's Prophecy", matched_sets)
        self.assertEqual(set(item_sources), {271481, 271482})
        self.assertEqual(item_sources[271481][0]["sourceType"], "tier-set")
        self.assertEqual(item_sources[271481][0]["itemSetId"], 901)
        self.assertEqual(calls, ["/data/wow/item-set/index", "/data/wow/item-set/901"])
        self.assertEqual(len(missing_sets), len(MODULE.SEASON_TIER_SET_NAMES) - 1)


if __name__ == "__main__":
    unittest.main()
