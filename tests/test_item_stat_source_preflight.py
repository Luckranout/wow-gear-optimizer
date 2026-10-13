import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "import_blizzard_data", ROOT / "scripts" / "import_blizzard_data.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ItemStatSourcePreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.catalog = pathlib.Path(self.temp.name) / "catalog.json"
        self.catalog.write_text(
            json.dumps({"items": [{"id": 123, "name": "Test item"}]}),
            encoding="utf-8",
        )

    @patch.object(MODULE, "get_api_json", return_value={"id": 123, "name": "Test item"})
    def test_fails_fast_when_api_has_no_stats(self, mock_api):
        with self.assertRaisesRegex(RuntimeError, "did not return non-zero numeric stats"):
            MODULE.validate_item_stat_source("token", str(self.catalog))
        mock_api.assert_called_once_with(
            "/data/wow/item/123", "token", {"namespace": MODULE.NAMESPACE, "locale": MODULE.LOCALE}
        )

    @patch.object(
        MODULE,
        "get_api_json",
        return_value={"id": 123, "stats": [{"type": {"type": "STRENGTH"}, "value": 12}]},
    )
    def test_accepts_numeric_nonzero_stats(self, mock_api):
        MODULE.validate_item_stat_source("token", str(self.catalog))
        mock_api.assert_called_once()

    def test_fails_when_catalog_has_no_sample_item(self):
        self.catalog.write_text(json.dumps({"items": []}), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "no sample item ID"):
            MODULE.validate_item_stat_source("token", str(self.catalog))


if __name__ == "__main__":
    unittest.main()
