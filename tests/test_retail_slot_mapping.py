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


class InventorySlotMappingTests(unittest.TestCase):
    def test_supported_inventory_types_map_to_optimizer_slots(self):
        cases = {
            "Head": ("Head", ["Head"]),
            "Neck": ("Neck", ["Neck"]),
            "Shoulder": ("Shoulders", ["Shoulders"]),
            "Cloak": ("Back", ["Back"]),
            "Robe": ("Chest", ["Chest"]),
            "Wrist": ("Wrists", ["Wrists"]),
            "Finger": ("Ring 1", ["Ring 1", "Ring 2"]),
            "Trinket": ("Trinket 1", ["Trinket 1", "Trinket 2"]),
            "Weapon": ("Main Hand", ["Main Hand"]),
            "Two-Hand": ("Main Hand", ["Main Hand"]),
            "Off Hand": ("Off Hand", ["Off Hand"]),
            "Shield": ("Off Hand", ["Off Hand"]),
            "Held In Off-hand": ("Off Hand", ["Off Hand"]),
        }
        for inventory_name, expected in cases.items():
            with self.subTest(inventory_name=inventory_name):
                actual = MODULE.normalize_inventory_slot({
                    "inventory_type": {"name": {"en_US": inventory_name}}
                })
                self.assertEqual(actual, expected)

    def test_unknown_and_non_optimizer_inventory_types_are_not_guessed(self):
        for inventory_name in ("Bag", "Tabard", "Ranged", "Unknown"):
            with self.subTest(inventory_name=inventory_name):
                self.assertEqual(
                    MODULE.normalize_inventory_slot({
                        "inventory_type": {"name": {"en_US": inventory_name}}
                    }),
                    (None, []),
                )

    def test_normalized_item_contains_slot_and_compatible_slot_metadata(self):
        item = MODULE.normalize_item({
            "id": 123,
            "name": {"en_US": "Test Ring"},
            "inventory_type": {"name": {"en_US": "Finger"}},
            "is_equippable": True,
        })
        self.assertEqual(item["slot"], "Ring 1")
        self.assertEqual(item["compatibleSlots"], ["Ring 1", "Ring 2"])


if __name__ == "__main__":
    unittest.main()
