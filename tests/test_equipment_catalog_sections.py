import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.equipment_catalog_sections import (
    PAGE_SIZE,
    SECTION_SEARCHES,
    collect_equipment_section_ids,
    fetch_inventory_type_ids,
    validate_required_sections,
    write_section_catalogs,
)
from scripts import import_blizzard_data


class WowheadVariantTooltipTests(unittest.TestCase):
    def test_variant_request_parses_explicit_variant_stats(self):
        captured = {}

        def open_request(request, timeout=30):
            captured["url"] = request.full_url
            return __import__("io").BytesIO(b'{"tooltip":"<span>+147 Haste</span>"}')

        with patch.object(import_blizzard_data, "throttled_urlopen", side_effect=open_request):
            stats = import_blizzard_data.fetch_wowhead_tooltip_stats(
                270167, bonus_ids=[6652, 13335, 12854], item_level=340
            )
        self.assertEqual(stats[0]["type"]["name"], "haste")
        self.assertEqual(stats[0]["value"], 147)
        self.assertIn("bonus=6652%3A13335%3A12854", captured["url"])
        self.assertIn("ilvl=340", captured["url"])

    def test_item_level_override_without_verified_bonuses_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "requires verified bonus_ids"):
            import_blizzard_data.fetch_wowhead_tooltip_stats(270167, item_level=340)

    def test_invalid_bonus_ids_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "positive integer"):
            import_blizzard_data.fetch_wowhead_tooltip_stats(270167, bonus_ids=[6652, "unknown"])


class TalentNodeShapeTests(unittest.TestCase):
    def test_extracts_class_specialization_and_hero_node_arrays(self):
        cases = (
            ("class_talent_nodes", [{"id": 1}]),
            ("spec_talent_nodes", [{"id": 2}]),
            ("hero_talent_nodes", [{"id": 3}]),
            ("talent_nodes", [{"id": 4}]),
        )
        for key, expected in cases:
            with self.subTest(key=key):
                self.assertEqual(import_blizzard_data.extract_talent_nodes({key: expected}), expected)

    def test_extracts_nodes_from_nested_response_shapes(self):
        expected = [{"id": 42}]
        self.assertEqual(
            import_blizzard_data.extract_talent_nodes({"spec_talent_tree": {"spec_talent_nodes": expected}}),
            expected,
        )


class EquipmentSectionPaginationTests(unittest.TestCase):
    def test_paginates_until_advertised_last_page_and_deduplicates(self):
        calls = []

        def search(_path, _token, params):
            calls.append(params["_page"])
            if params["_page"] == 1:
                return {
                    "maxPage": 2,
                    "results": [{"data": {"id": 10}}, {"data": {"id": 11}}],
                }
            return {
                "maxPage": 2,
                "results": [{"data": {"id": 11}}, {"data": {"id": 12}}],
            }

        ids = fetch_inventory_type_ids("token", "FINGER", search, sleep=lambda _s: None)
        self.assertEqual(ids, {10, 11, 12})
        self.assertEqual(calls, [1, 2])

    def test_paginates_without_metadata_until_empty_page(self):
        calls = []

        def search(_path, _token, params):
            calls.append(params["_page"])
            if params["_page"] == 1:
                return {"results": [{"id": index} for index in range(1, PAGE_SIZE + 1)]}
            return {"results": []}

        ids = fetch_inventory_type_ids("token", "NECK", search, sleep=lambda _s: None)
        self.assertEqual(ids, set(range(1, PAGE_SIZE + 1)))
        self.assertEqual(calls, [1, 2])

    def test_section_plan_covers_all_supported_slot_families(self):
        expected = {
            "rings", "necklaces", "trinkets", "head", "shoulders", "back",
            "chest", "wrists", "hands", "waist", "legs", "feet",
            "main-hand", "off-hand",
        }
        self.assertEqual(set(SECTION_SEARCHES), expected)
        self.assertIn("WEAPONMAINHAND", SECTION_SEARCHES["main-hand"])
        self.assertIn("TWOHWEAPON", SECTION_SEARCHES["main-hand"])
        self.assertIn("WEAPONOFFHAND", SECTION_SEARCHES["off-hand"])
        self.assertIn("WEAPON", SECTION_SEARCHES["off-hand"])

    def test_missing_required_sections_fail_closed(self):
        with self.assertRaisesRegex(
            RuntimeError,
            "No verified candidates for required equipment section.*necklaces.*shoulders.*wrists",
        ):
            validate_required_sections({"rings": {100}, "head": {200}})

    def test_all_required_sections_pass_validation(self):
        result = validate_required_sections({section: {index + 1} for index, section in enumerate(SECTION_SEARCHES)})
        self.assertEqual(result, [])

    def test_unverified_or_empty_sections_are_omitted(self):
        def empty_search(_path, _token, _params):
            return {"maxPage": 1, "results": []}

        sections, sources = collect_equipment_section_ids(
            "token", empty_search, {1, 2}, sleep=lambda _s: None
        )
        self.assertEqual(sections, {})
        self.assertEqual(sources, {})

    def test_current_season_source_is_not_rejected_by_base_item_level(self):
        # Blizzard's static item-detail level may be a preview/base level rather
        # than the season's difficulty-specific drop level.
        details = {
            99: {"id": 99, "name": "Current Season Ring", "level": 219,
                 "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
        }

        def get_detail(path, _token, _params):
            return details[int(path.rsplit("/", 1)[-1])]

        sections, sources = collect_equipment_section_ids(
            "token", get_detail, {99}, sleep=lambda _s: None,
            source_evidence={
                99: [{"category": "PvE", "seasonScope": "Midnight Season 2+",
                      "instance": "Altar of Fangs", "encounter": "Zul'jan"}],
            },
        )
        self.assertEqual(sections, {"rings": {99}})
        self.assertEqual(sources[99][0]["encounter"], "Zul'jan")

    def test_catalog_classifies_only_verified_source_ids_by_item_detail(self):
        details = {
            10: {"id": 10, "name": "Old Ring", "level": 59, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
            11: {"id": 11, "name": "Season Ring", "level": 292, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
            12: {"id": 12, "name": "Season Head", "level": 292, "is_equippable": True, "inventory_type": {"type": "HEAD", "name": "Head"}},
            13: {"id": 13, "name": "Catch-up Ring", "level": 250, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
            14: {"id": 14, "name": "Below Threshold Ring", "level": 249, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
        }
        calls = []

        def get_detail(path, _token, _params):
            calls.append(path)
            item_id = int(path.rsplit("/", 1)[-1])
            return details[item_id]

        with patch("builtins.print") as printer:
            sections, sources = collect_equipment_section_ids(
                # The caller's allow-list is already source-verified for this season.
                # Legacy IDs 10 and 14 are intentionally excluded before classification.
                "token", get_detail, {11, 12, 13}, sleep=lambda _s: None,
                source_evidence={
                    10: [{"category": "PvE", "seasonScope": "Midnight Season 2+", "encounter": "Legacy loot table"}],
                    11: [{"category": "PvE", "seasonScope": "Midnight Season 2+", "encounter": "Test encounter"}],
                    12: [{"category": "Crafted Gear", "seasonScope": "Midnight Season 2+", "professionRecipeSource": "Test recipe"}],
                    13: [{"category": "PvE", "seasonScope": "Midnight Season 2+", "activity": "Catch-up/outdoor reward"}],
                    14: [{"category": "PvE", "seasonScope": "Midnight Season 2+", "activity": "Legacy loot test"}],
                },
            )
        self.assertEqual(sections, {"rings": {11, 13}, "head": {12}})
        self.assertEqual(set(sources), {11, 12, 13})
        self.assertEqual(len(calls), 3)
        diagnostics = "\\n".join(str(call.args[0]) for call in printer.call_args_list)
        self.assertIn("verified_source_ids=3", diagnostics)
        self.assertIn("section_counts=", diagnostics)
        self.assertEqual(sources[11][0]["encounter"], "Test encounter")
        self.assertEqual(sources[12][0]["professionRecipeSource"], "Test recipe")
        self.assertTrue(all(source["slotConfirmedBy"] == "Blizzard item detail inventory_type.type" for values in sources.values() for source in values))

    def test_source_verified_season_item_is_not_rejected_by_base_item_level(self):
        details = {
            21: {"id": 21, "name": "Season PvP Ring", "level": 197, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
        }

        def get_detail(path, _token, _params):
            return details[int(path.rsplit("/", 1)[-1])]

        sections, sources = collect_equipment_section_ids(
            "token", get_detail, {21}, sleep=lambda _s: None,
            source_evidence={
                21: [{"category": "PvP", "seasonScope": "Midnight Season 2+", "pvpSeasonId": 42}],
            },
        )
        self.assertEqual(sections, {"rings": {21}})
        self.assertEqual(sources[21][0]["pvpSeasonId"], 42)

    def test_pvp_item_at_boundary_is_preserved(self):
        details = {
            22: {"id": 22, "name": "Season PvP Ring", "level": 250, "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
        }

        def get_detail(path, _token, _params):
            return details[int(path.rsplit("/", 1)[-1])]

        sections, sources = collect_equipment_section_ids(
            "token", get_detail, {22}, sleep=lambda _s: None,
            source_evidence={
                22: [{"category": "PvP", "seasonScope": "Midnight Season 2+", "pvpSeasonId": 42}],
            },
        )
        self.assertEqual(sections, {"rings": {22}})
        self.assertEqual(sources[22][0]["category"], "PvP")

    def test_item_without_source_evidence_is_rejected(self):
        details = {
            11: {"id": 11, "name": "Unproven Ring", "is_equippable": True, "inventory_type": {"type": "FINGER", "name": "Finger"}},
        }
        def get_detail(path, _token, _params):
            return details[int(path.rsplit("/", 1)[-1])]
        sections, sources = collect_equipment_section_ids(
            "token", get_detail, {11}, sleep=lambda _s: None, source_evidence={}
        )
        self.assertEqual(sections, {})
        self.assertEqual(sources, {})

    def test_detail_lookup_failure_aborts_incomplete_source_scan(self):
        def failed_detail(_path, _token, _params):
            raise RuntimeError("temporary API failure")

        with self.assertRaisesRegex(RuntimeError, "classification was incomplete"):
            collect_equipment_section_ids(
                "token", failed_detail, {11}, sleep=lambda _s: None
            )

    def test_incomplete_section_does_not_replace_previous_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "rings.json"
            path.write_text('{"complete": true, "items": [{"id": 99}]}', encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "is incomplete"):
                write_section_catalogs(
                    {"rings": {1, 2}},
                    [{"id": 1, "isEquippable": True}],
                    output_dir=temporary,
                )
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["items"][0]["id"], 99)

    def test_complete_section_is_stored_and_marked_complete(self):
        with tempfile.TemporaryDirectory() as temporary:
            summary = write_section_catalogs(
                {"rings": {1, 2}},
                [
                    {"id": 1, "isEquippable": True},
                    {"id": 2, "isEquippable": True},
                ],
                output_dir=temporary,
            )
            payload = json.loads((Path(temporary) / "rings.json").read_text(encoding="utf-8"))
            self.assertEqual(summary, {"rings": 2})
            self.assertTrue(payload["complete"])
            self.assertEqual(payload["candidateCount"], 2)


if __name__ == "__main__":
    unittest.main()



class BlizzardMythicSeasonVerificationTests(unittest.TestCase):
    def test_resolves_supported_season_from_index_then_fetches_details(self):
        index = {
            "seasons": [{"id": 17, "name": "Mythic+ Season 1"}, {"id": 18, "name": "Midnight Mythic+ Season 2"}],
            "current_season": {"key": {"href": "https://us.api.blizzard.com/data/wow/mythic-keystone/season/18?namespace=dynamic-us"}, "id": 18},
        }
        detail = {
            "id": 18,
            "season_name": "Midnight Mythic+ Season 2",
            "periods": [{"id": 101}, {"id": 102}],
        }
        with patch.object(
            import_blizzard_data,
            "get_api_json",
            side_effect=[index, detail],
        ) as request:
            result = import_blizzard_data.get_mythic_keystone_season("token")

        self.assertEqual(result, detail)
        self.assertEqual(request.call_args_list[0].args, (
            "/data/wow/mythic-keystone/season/index",
            "token",
            {"namespace": "dynamic-us", "locale": "en_US"},
        ))
        self.assertEqual(request.call_args_list[1].args, (
            "/data/wow/mythic-keystone/season/18",
            "token",
            {"namespace": "dynamic-us", "locale": "en_US"},
        ))

    def test_rejects_configured_season_missing_from_index(self):
        with patch.object(
            import_blizzard_data,
            "get_api_json",
            return_value={"seasons": [{"id": 41, "name": "Season 1"}]},
        ):
            with self.assertRaisesRegex(RuntimeError, "Could not resolve a Mythic"):
                import_blizzard_data.get_mythic_keystone_season("token", season_id=42)

    def test_rejects_season_response_without_periods(self):
        index = {"seasons": [{"id": 18, "name": "Midnight Mythic+ Season 2"}]}
        detail = {"id": 18, "season_name": "Midnight Mythic+ Season 2", "periods": []}
        with patch.object(import_blizzard_data, "get_api_json", side_effect=[index, detail]):
            with self.assertRaisesRegex(RuntimeError, "returned no periods"):
                import_blizzard_data.get_mythic_keystone_season("token")

    def test_non_mythic_plus_season_sources_do_not_require_tracked_dungeon_map_ids(self):
        season = {"id": 18, "season_name": "Mythic+ Dungeons (Midnight Season 2)", "periods": [{"id": 101}]}
        journal_index = [
            {"id": 1, "name": {"en_US": "Kings' Rest"}},
            {"id": 2, "name": {"en_US": "The Tidebound Grotto"}},
            {"id": 3, "name": {"en_US": "The Venomous Abyss"}},
        ]
        legacy_instance = {"id": 1, "name": {"en_US": "Kings' Rest"}, "map": {"id": 7001}, "journal_encounters": [{"id": 11}]}
        tidebound_instance = {"id": 2, "name": {"en_US": "The Tidebound Grotto"}, "map": {"id": 9002}, "journal_encounters": [{"id": 22}]}
        raid_instance = {"id": 3, "name": {"en_US": "The Venomous Abyss"}, "map": {"id": 9003}, "journal_encounters": [{"id": 33}]}
        tidebound_encounter = {
            "id": 22, "name": {"en_US": "Tidebound Boss"},
            "instance": {"name": {"en_US": "The Tidebound Grotto"}}, "items": [{"item": {"id": 222}}],
        }
        raid_encounter = {
            "id": 33, "name": {"en_US": "Abyss Boss"},
            "instance": {"name": {"en_US": "The Venomous Abyss"}}, "items": [{"item": {"id": 333}}],
        }

        def api(path, _token, _params):
            responses = {
                "/data/wow/mythic-keystone/dungeon/index": {"dungeons": [{"id": 301}, {"id": 302}]},
                "/data/wow/mythic-keystone/dungeon/301": {"id": 301, "is_tracked": False, "map": {"id": 7001}},
                "/data/wow/mythic-keystone/dungeon/302": {"id": 302, "is_tracked": True, "map": {"id": 9001}},
                "/data/wow/journal-instance/1": legacy_instance,
                "/data/wow/journal-instance/2": tidebound_instance,
                "/data/wow/journal-instance/3": raid_instance,
                "/data/wow/journal-encounter/22": tidebound_encounter,
                "/data/wow/journal-encounter/33": raid_encounter,
            }
            if path in responses:
                return responses[path]
            raise AssertionError(f"Unexpected API request: {path}")

        with (
            patch.object(import_blizzard_data, "get_mythic_keystone_season", return_value=season),
            patch.object(import_blizzard_data, "get_season_instances", return_value=journal_index),
            patch.object(import_blizzard_data, "get_api_json", side_effect=api),
        ):
            ids, matched, missing = import_blizzard_data.collect_season_content_item_ids("token")

        self.assertEqual(set(ids), {222, 333})
        self.assertEqual(matched, ["The Tidebound Grotto", "The Venomous Abyss"])
        self.assertIn("Kings' Rest", missing)
