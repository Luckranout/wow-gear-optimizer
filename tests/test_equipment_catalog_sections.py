import json
import tempfile
import unittest
from pathlib import Path

from scripts.equipment_catalog_sections import (
    PAGE_SIZE,
    SECTION_SEARCHES,
    collect_equipment_section_ids,
    fetch_inventory_type_ids,
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

    def test_collect_fails_closed_if_a_section_is_empty(self):
        def empty_search(_path, _token, _params):
            return {"maxPage": 1, "results": []}

        with self.assertRaisesRegex(RuntimeError, "returned no items"):
            collect_equipment_section_ids("token", empty_search, sleep=lambda _s: None)

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
