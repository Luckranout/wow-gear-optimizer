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
                        {"id": 2, "name": {"en_US": "Midnight Season 1"}},
                        {"id": 3, "name": {"en_US": "Midnight Season 2"}},
                    ]
                }
                if path.endswith("/pvp-season/index")
                else {"name": {"en_US": "Midnight Season 2"}}
            )
            season_id, season_name = MODULE.discover_current_pvp_season("token")
            self.assertEqual(season_id, 3)
            self.assertEqual(season_name, "Midnight Season 2")
        finally:
            MODULE.get_api_json = original

    def test_unsupported_season_is_rejected_before_publish(self):
        with self.assertRaises(RuntimeError):
            MODULE.enforce_supported_season("Midnight Season 3")

    def test_supported_season_is_allowed(self):
        MODULE.enforce_supported_season("Midnight Season 2")


if __name__ == "__main__":
    unittest.main()
