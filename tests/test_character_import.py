import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "import_character.py"
SPEC = importlib.util.spec_from_file_location("import_character", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CharacterImportTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(MODULE.slugify("Area 52"), "area-52")
        self.assertEqual(MODULE.slugify("Zul'jin"), "zuljin")

    def test_normalize_statistics(self):
        statistics = {
            "_links": {"self": {"href": "private"}},
            "character": {"key": "private"},
            "strength": 1000,
            "agility": 500,
            "haste": 12.5,
        }
        normalized = MODULE.normalize_statistics(statistics)
        self.assertEqual(normalized["strength"], 1000)
        self.assertEqual(normalized["agility"], 500)
        self.assertEqual(normalized["haste"], 12.5)
        self.assertNotIn("_links", normalized)
        self.assertNotIn("character", normalized)

    def test_normalize_character(self):
        profile = {
            "id": 123, "name": "Testchar", "level": 90,
            "realm": {"id": 1, "name": {"en_US": "Area 52"}, "slug": "area-52"},
            "character_class": {"id": 1, "name": {"en_US": "Warrior"}},
            "race": {"id": 2, "name": {"en_US": "Orc"}},
            "active_spec": {"id": 71, "name": {"en_US": "Arms"}},
        }
        equipment = {"equipped_items": [
            {"item": {"id": 12345}, "name": "Validation Helm", "slot": {"name": {"en_US": "Head"}, "type": "HEAD"}, "level": 318, "quality": {"id": 4, "name": {"en_US": "Epic"}}},
            {"item": {"id": 67890}, "name": "Validation Ring", "slot": {"name": {"en_US": "Finger"}, "type": "FINGER"}, "level": 321},
        ]}
        statistics = {"strength": 1000, "haste": 12.5}
        normalized = MODULE.normalize_character(profile, equipment, statistics)
        self.assertEqual(normalized["name"], "Testchar")
        self.assertEqual(normalized["realm"]["slug"], "area-52")
        self.assertEqual(normalized["class"]["name"], "Warrior")
        self.assertEqual(normalized["activeSpec"]["name"], "Arms")
        self.assertEqual(normalized["statistics"]["strength"], 1000)
        self.assertEqual(normalized["statistics"]["haste"], 12.5)
        self.assertEqual(normalized["equipmentCount"], 2)
        self.assertEqual(normalized["equipment"][0]["id"], 12345)
        self.assertEqual(normalized["equipment"][0]["itemLevel"], 318)
        self.assertEqual(normalized["equipment"][0]["slot"], "Head")
        self.assertEqual(normalized["equipment"][0]["slotType"], "HEAD")
        self.assertEqual(normalized["equipment"][1]["slotType"], "FINGER")


class ImportCharacterWorkflowContractTests(unittest.TestCase):
    def test_normalized_character_fixture_has_ui_contract(self):
        fixture = {
            "id": 1,
            "name": "Example",
            "realm": {"id": 1, "name": "Area 52", "slug": "area-52"},
            "class": {"id": 1, "name": "Warrior"},
            "activeSpec": {"id": 71, "name": "Arms"},
            "statistics": {"strength": 1000, "haste": 12.5},
            "equipment": [],
            "equipmentCount": 0,
        }
        for field in ("id", "name", "realm", "class", "activeSpec", "statistics", "equipment"):
            self.assertIn(field, fixture)
        self.assertIsInstance(fixture["statistics"], dict)
        self.assertIsInstance(fixture["equipment"], list)


if __name__ == "__main__":
    unittest.main()
