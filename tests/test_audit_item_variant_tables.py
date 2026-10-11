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

    def test_relationship_audit_reports_unresolved_known_reference(self):
        report = MODULE.audit_relationships({
            "ItemEffect": [{"id": 10}],
            "ItemXItemEffect": [
                {"id": 1, "id_item_effect": 10},
                {"id": 2, "id_item_effect": 999},
            ],
        })
        effect_check = next(row for row in report if row["sourceTable"] == "ItemXItemEffect")
        self.assertEqual(effect_check["nonzeroReferencesChecked"], 2)
        self.assertEqual(effect_check["unresolvedReferenceCount"], 1)
        self.assertEqual(effect_check["sampleUnresolvedIds"], ["999"])

    def test_documented_bonus_tree_child_reference_is_checked(self):
        report = MODULE.audit_relationships({
            "ItemBonusTreeNode": [
                {"id": 1, "id_child": 2},
                {"id": 2, "id_child": 0},
                {"id": 3, "id_child": 999},
            ],
        })
        child_check = next(row for row in report if row["sourceTable"] == "ItemBonusTreeNode")
        self.assertEqual(child_check["nonzeroReferencesChecked"], 2)
        self.assertEqual(child_check["unresolvedReferenceCount"], 1)
        self.assertEqual(child_check["sampleUnresolvedIds"], ["999"])

    def test_linkage_candidates_are_reported_without_asserting_foreign_keys(self):
        report = MODULE.audit_linkage_candidates({
            "ItemBonus": [{"id_node": 5}, {"id_node": 99}],
            "ItemBonusTreeNode": [{"id": 1, "id_node": 5, "id_parent": 1}],
            "ItemXBonusTree": [{"id_tree": 5}, {"id_tree": 77}],
        })
        bonus_node = next(row for row in report if row["sourceTable"] == "ItemBonus")
        self.assertEqual(bonus_node["distinctValuesInCommon"], 1)
        self.assertEqual(bonus_node["sourceValuesWithoutTargetMatch"], 1)
        self.assertIn("candidate only", bonus_node["interpretation"])

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
