import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "audit_item_variant_tables", ROOT / "scripts" / "audit_item_variant_tables.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ItemVariantTableAuditTests(unittest.TestCase):
    def test_reports_counts_and_duplicate_ids(self):
        result = MODULE.audit_table("ItemUpgrade", [
            {"ID": 1, "value": 100},
            {"ID": 1, "value": 200},
            {"value": 300},
        ])
        self.assertEqual(result["recordCount"], 3)
        self.assertEqual(result["recordsWithId"], 2)
        self.assertEqual(result["uniqueIds"], 1)
        self.assertEqual(result["duplicateIdsAmongIdentified"], 1)

    def test_rejects_non_array_and_non_object_records(self):
        with self.assertRaises(ValueError):
            MODULE.audit_table("ItemBonus", {"ID": 1})
        with self.assertRaises(ValueError):
            MODULE.audit_table("ItemBonus", [1])

    def test_missing_tables_are_explicit(self):
        with tempfile.TemporaryDirectory() as temp:
            path = pathlib.Path(temp)
            (path / "ItemUpgrade.json").write_text(json.dumps([{"ID": 1}]))
            report = MODULE.audit_directory(path)
            self.assertEqual(report["tableCountFound"], 1)
            self.assertEqual(report["tableCountExpected"], len(MODULE.TABLES))
            self.assertIn("ItemBonus", report["missingTables"])


if __name__ == "__main__":
    unittest.main()
