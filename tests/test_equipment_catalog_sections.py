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

    def test_catalog_only_includes_ids_verified_by_season_sources(self):
        def search(_path, _token, params):
            return {"maxPage": 1, "results": [{"id": 10}, {"id": 11}, {"id": 12}]}

        with patch("builtins.print") as printer:
            sections, sources = collect_equipment_section_ids(
                "token", search, {11}, sleep=lambda _s: None
            )
        self.assertTrue(all(set(ids) <= {11} for ids in sections.values()))
        diagnostics = "\n".join(str(call.args[0]) for call in printer.call_args_list)
        self.assertIn("verified_source_ids=1", diagnostics)
        self.assertIn("raw_unique_ids=3", diagnostics)
        self.assertIn("verified_overlap=1", diagnostics)
        self.assertTrue(all("eligibilitySource" in source for values in sources.values() for source in values))
        self.assertTrue(all("profession recipe" in source["eligibilitySource"] for values in sources.values() for source in values))

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
