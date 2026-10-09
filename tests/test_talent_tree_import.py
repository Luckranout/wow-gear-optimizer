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


class TalentTreeImportTests(unittest.TestCase):
    def test_tree_id_is_taken_from_talent_tree_path_not_trailing_spec_id(self):
        ref = {
            "key": {
                "href": "https://us.api.blizzard.com/data/wow/talent-tree/12345/playable-specialization/71?namespace=static-us"
            }
        }
        self.assertEqual(MODULE.talent_tree_reference_id(ref), 12345)
        self.assertEqual(MODULE.talent_tree_reference_parts(ref), (12345, 71))

    def test_tree_href_takes_precedence_over_ambiguous_id_field(self):
        self.assertEqual(
            MODULE.talent_tree_reference_id({
                "id": 456,
                "key": {"href": "https://us.api.blizzard.com/data/wow/talent-tree/123/playable-specialization/71"}
            }),
            123,
        )

    def test_collector_imports_spec_and_hero_talent_trees(self):
        original_get = MODULE.get_api_json
        original_sleep = MODULE.time.sleep
        responses = {
            "/data/wow/playable-specialization/index": {
                "character_specializations": [
                    {"key": {"href": "https://us.api.blizzard.com/data/wow/playable-specialization/71"}}
                ]
            },
            "/data/wow/playable-specialization/71": {
                "id": 71,
                "name": {"en_US": "Arms"},
                "playable_class": {"id": 1},
                "spec_talent_tree": {
                    "key": {"href": "https://us.api.blizzard.com/data/wow/talent-tree/123/playable-specialization/71"}
                },
                "hero_talent_trees": [{
                    "name": {"en_US": "Slayer"},
                    "key": {"href": "https://us.api.blizzard.com/data/wow/talent-tree/456/playable-specialization/71"}
                }],
            },
            "/data/wow/talent-tree/index": {
                "spec_talent_trees": [{
                    "name": {"en_US": "Arms"},
                    "key": {"href": "https://us.api.blizzard.com/data/wow/talent-tree/123/playable-specialization/71"}
                }],
                "class_talent_trees": [{
                    "name": {"en_US": "Warrior"},
                    "key": {"href": "https://us.api.blizzard.com/data/wow/talent-tree/789"}
                }],
            },
            "/data/wow/talent-tree/123/playable-specialization/71": {"nodes": [{"id": 1}]},
            "/data/wow/talent-tree/456/playable-specialization/71": {"nodes": [{"id": 2}]},
            "/data/wow/talent-tree/789": {"nodes": [{"id": 3}]},
        }

        def fake_get(path, *args, **kwargs):
            if path not in responses:
                raise AssertionError(f"Unexpected Blizzard API path in fixture: {path}")
            return responses[path]

        try:
            MODULE.get_api_json = fake_get
            MODULE.time.sleep = lambda *_: None
            data = MODULE.collect_talent_data("test-token")
            self.assertEqual(data["specializationCount"], 1)
            self.assertEqual(data["treeCount"], 3)
            self.assertEqual(data["nodeCount"], 3)
            self.assertEqual(
                {(tree["id"], tree["type"]) for tree in data["trees"]},
                {(123, "specialization"), (456, "hero"), (789, "class")},
            )
        finally:
            MODULE.get_api_json = original_get
            MODULE.time.sleep = original_sleep

    def test_empty_talent_tree_response_fails_closed(self):
        original_get = MODULE.get_api_json
        original_sleep = MODULE.time.sleep
        responses = {
            "/data/wow/playable-specialization/index": {
                "character_specializations": [
                    {"key": {"href": "https://us.api.blizzard.com/data/wow/playable-specialization/71"}}
                ]
            },
            "/data/wow/playable-specialization/71": {
                "id": 71,
                "name": {"en_US": "Arms"},
                "spec_talent_tree": None,
                "hero_talent_trees": [],
            },
            "/data/wow/talent-tree/index": {"spec_talent_trees": []},
        }

        def fake_get(path, *args, **kwargs):
            return responses[path]

        try:
            MODULE.get_api_json = fake_get
            MODULE.time.sleep = lambda *_: None
            with self.assertRaisesRegex(RuntimeError, "no usable Retail talent trees"):
                MODULE.collect_talent_data("test-token")
        finally:
            MODULE.get_api_json = original_get
            MODULE.time.sleep = original_sleep


if __name__ == "__main__":
    unittest.main()
