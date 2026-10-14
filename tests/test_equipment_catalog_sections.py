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

    def test_missing_neck_or_shoulders_fails_before_catalog_publication(self):
        with self.assertRaises(RuntimeError) as raised:
            validate_required_sections({"rings": {100}, "head": {200}})
        self.assertIn("necklaces", str(raised.exception))
        self.assertIn("shoulders", str(raised.exception))

    def test_all_required_sections_pass_validation(self):
        validate_required_sections({section: {index + 1} for index, section in enumerate(SECTION_SEARCHES)})

    def test_unverified_or_empty_sections_are_omitted(self):
        def empty_search(_path, _token, _params):
            return {"maxPage": 1, "results": []}

        sections, sources = collect_equipment_section_ids(
            "token", empty_search, {1, 2}, sleep=lambda _s: None
        )
        self.assertEqual(sections, {})
        self.assertEqual(sources, {})

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
                "token", get_detail, {10, 11, 12, 13, 14}, sleep=lambda _s: None,
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
        self.assertEqual(len(calls), 5)
        diagnostics = "\\n".join(str(call.args[0]) for call in printer.call_args_list)
        self.assertIn("verified_source_ids=5", diagnostics)
        self.assertIn("section_counts=", diagnostics)
        self.assertEqual(sources[11][0]["encounter"], "Test encounter")
        self.assertEqual(sources[12][0]["professionRecipeSource"], "Test recipe")
        self.assertTrue(all(source["slotConfirmedBy"] == "Blizzard item detail inventory_type.type" for values in sources.values() for source in values))

    def test_low_level_pvp_item_is_preserved_by_independent_source_evidence(self):
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
        self.assertEqual(sources[21][0]["category"], "PvP")

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

    def test_detail_lookup_failure_does_not_create_unverified_slot_candidates(self):
        def failed_detail(_path, _token, _params):
            raise RuntimeError("temporary API failure")

        sections, sources = collect_equipment_section_ids(
            "token", failed_detail, {11}, sleep=lambda _s: None
        )
        self.assertEqual(sections, {})
        self.assertEqual(sources, {})

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
