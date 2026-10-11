#!/usr/bin/env python3
"""Audit extracted SimulationCraft item-variant/upgrade tables without guessing.

Input is a directory containing JSON arrays emitted by dbc_extract.py. The audit
reports per-table record counts and basic key/relationship coverage. It does not
calculate scaled stats or assert that an item variant is valid for a character.
"""
import argparse
import json
from pathlib import Path

TABLES = {
    "ItemUpgrade": {"keys": ("id", "ID")},
    "RulesetItemUpgrade": {"keys": ("id", "ID")},
    "GarrItemLevelUpgradeData": {"keys": ("id", "ID")},
    "ItemBonusSeasonUpgradeCost": {"keys": ("id", "ID")},
    "ItemBonus": {"keys": ("id", "ID")},
    "ItemBonusTreeNode": {"keys": ("id", "ID")},
    "ItemXBonusTree": {"keys": ("id", "ID")},
    "ItemBonusListLevelDelta": {"keys": ("id", "ID")},
    "ItemBonusSeason": {"keys": ("id", "ID")},
    "ItemEffect": {"keys": ("id", "ID")},
    "ItemXItemEffect": {"keys": ("id", "ID")},
    "RulesetRaidLootUpgrade": {"keys": ("id", "ID")},
    "ChrUpgradeBucketSpell": {"keys": ("id", "ID")},
    "ChrUpgradeBucket": {"keys": ("id", "ID")},
    "ChrUpgradeTier": {"keys": ("id", "ID")},
    "ScalingStatDistribution": {"keys": ("id", "ID")},
    "ItemLevelSelector": {"keys": ("id", "ID")},
    "ItemLevelSelectorQualitySet": {"keys": ("id", "ID")},
    "ItemLevelSelectorQuality": {"keys": ("id", "ID")},
    "ItemBonusList": {"keys": ("id", "ID")},
    "ItemBonusListWarforgeLevelDelta": {"keys": ("id", "ID")},
    "ChallengeModeItemBonusOverride": {"keys": ("id", "ID")},
    "ItemBonusListGroupEntry": {"keys": ("id", "ID")},
    "ItemBonusSequenceSpell": {"keys": ("id", "ID")},
    "ItemBonusTree": {"keys": ("id", "ID")},
    "ItemBonusListGroup": {"keys": ("id", "ID")},
    "ItemBonusTreeGroupEntry": {"keys": ("id", "ID")},
    "ItemBonusSeasonBonusListGroup": {"keys": ("id", "ID")},
}


def audit_table(name, records):
    if not isinstance(records, list):
        raise ValueError(f"{name}: expected JSON array")
    if any(not isinstance(row, dict) for row in records):
        raise ValueError(f"{name}: all records must be objects")
    keys = TABLES[name]["keys"]
    ids = [next((row.get(key) for key in keys if row.get(key) is not None), None) for row in records]
    identified = sum(value is not None for value in ids)
    unique = len({str(value) for value in ids if value is not None})
    field_names = sorted({key for row in records for key in row})
    schema_requirements = {
        "ItemBonus": ("id", "id_node", "type", "val_1", "val_2", "val_3", "val_4", "index"),
        "ItemBonusTreeNode": ("id",),
        "ItemXBonusTree": ("id",),
        "ItemBonusListLevelDelta": ("id",),
    }
    expected_fields = schema_requirements.get(name, ())
    return {
        "recordCount": len(records),
        "observedFields": field_names,
        "requiredFields": list(expected_fields),
        "missingRequiredFields": [field for field in expected_fields if field not in field_names],
        "recordsWithId": identified,
        "uniqueIds": unique,
        "duplicateIdsAmongIdentified": identified - unique,
    }


def _record_ids(records):
    return {
        str(value)
        for row in records
        for value in [row.get("id", row.get("ID"))]
        if value is not None
    }


def audit_relationships(tables):
    """Check relationships documented by the pinned WoWDBDefs definitions.

    Overloaded bonus-tree child values remain diagnostic candidates, not foreign keys.
    """
    checks = [
        ("ItemBonusListLevelDelta", ("ID", "id"), "ItemBonusList"),
        ("ItemBonus", ("ParentItemBonusListID", "id_parent"), "ItemBonusList"),
        ("ItemXBonusTree", ("ItemBonusTreeID", "id_tree"), "ItemBonusTree"),
        ("ItemBonusTreeNode", ("ParentItemBonusTreeID", "id_parent"), "ItemBonusTree"),
        ("ItemBonusTreeNode", ("ChildItemBonusListID", "id_child_bonus_list"), "ItemBonusList"),
        ("ItemBonusTreeNode", ("ChildItemBonusTreeID", "id_child_bonus_tree"), "ItemBonusTree"),
        ("ItemBonusTreeNode", ("ChildItemBonusListGroupID", "id_child_bonus_list_group"), "ItemBonusListGroup"),
        ("ItemBonusListGroupEntry", ("ItemBonusListID", "id_item_bonus_list"), "ItemBonusList"),
        ("ItemBonusListGroupEntry", ("ItemBonusListGroupID", "id_item_bonus_list_group"), "ItemBonusListGroup"),
        ("ItemBonusSeasonBonusListGroup", ("ItemBonusListGroupID", "id_item_bonus_list_group"), "ItemBonusListGroup"),
        ("ItemBonusSeasonBonusListGroup", ("ItemBonusSeasonID", "id_item_bonus_season"), "ItemBonusSeason"),
        ("ItemBonusSeasonUpgradeCost", ("ItemBonusSeasonID", "id_item_bonus_season"), "ItemBonusSeason"),
        ("ItemXItemEffect", ("ItemEffectID", "id_item_effect"), "ItemEffect"),
    ]
    report = []
    for source_name, candidate_fields, target_name in checks:
        if source_name not in tables or target_name not in tables:
            continue
        source_rows = tables[source_name]
        target_ids = _record_ids(tables[target_name])
        field = next((name for name in candidate_fields if any(name in row for row in source_rows)), None)
        if field is None:
            continue
        values = [row.get(field) for row in source_rows if row.get(field) not in (None, 0, "0")]
        missing = [value for value in values if str(value) not in target_ids]
        report.append({
            "sourceTable": source_name,
            "field": field,
            "targetTable": target_name,
            "nonzeroReferencesChecked": len(values),
            "unresolvedReferenceCount": len(missing),
            "sampleUnresolvedIds": sorted({str(value) for value in missing})[:10],
            "status": "unresolved" if missing else "resolved",
        })
    return report


def audit_linkage_candidates(tables):
    """Report field-overlap candidates without asserting undocumented FK semantics."""
    candidates = [
        ("ItemBonus", ("id_node", "NodeID"), "ItemBonusTreeNode", ("id_node", "NodeID")),
        ("ItemBonusTreeNode", ("id_child", "ChildItemBonusListID"), "ItemBonusList", ("id", "ID")),
        ("ItemBonusTreeNode", ("id_child", "ChildItemBonusTreeID"), "ItemBonusTree", ("id", "ID")),
    ]
    report = []
    for source_name, source_fields, target_name, target_fields in candidates:
        if source_name not in tables or target_name not in tables:
            continue
        source_field = next((field for field in source_fields if any(field in row for row in tables[source_name])), None)
        target_field = next((field for field in target_fields if any(field in row for row in tables[target_name])), None)
        if source_field is None or target_field is None:
            continue
        source_values = {
            str(row[source_field]) for row in tables[source_name]
            if row.get(source_field) not in (None, 0, "0")
        }
        target_values = {
            str(row[target_field]) for row in tables[target_name]
            if row.get(target_field) not in (None, 0, "0")
        }
        overlap = source_values & target_values
        report.append({
            "sourceTable": source_name,
            "sourceField": source_field,
            "targetTable": target_name,
            "targetField": target_field,
            "distinctNonzeroSourceValues": len(source_values),
            "distinctNonzeroTargetValues": len(target_values),
            "distinctValuesInCommon": len(overlap),
            "sourceValuesWithoutTargetMatch": len(source_values - target_values),
            "sampleUnmatchedSourceValues": sorted(source_values - target_values)[:10],
            "interpretation": "candidate only; confirm foreign-key semantics before treating unmatched values as errors",
        })
    return report


def audit_directory(directory):
    result = {"source": "SimulationCraft DB2 JSON export", "tables": {}, "missingTables": []}
    loaded_tables = {}
    for name in TABLES:
        path = directory / f"{name}.json"
        if not path.exists():
            result["missingTables"].append(name)
            continue
        records = json.loads(path.read_text(encoding="utf-8"))
        loaded_tables[name] = records
        result["tables"][name] = audit_table(name, records)
    result["relationships"] = audit_relationships(loaded_tables)
    result["linkageCandidates"] = audit_linkage_candidates(loaded_tables)
    result["unresolvedRelationshipChecks"] = sum(r["unresolvedReferenceCount"] for r in result["relationships"])
    result["tableCountFound"] = len(result["tables"])
    result["tableCountExpected"] = len(TABLES)
    result["tablesWithMissingRequiredFields"] = [
        name for name, report in result["tables"].items() if report.get("missingRequiredFields")
    ]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--allow-missing", action="store_true", help="Write an incomplete report and exit successfully when some tables are unavailable in this build.")
    args = parser.parse_args()
    try:
        report = audit_directory(args.directory)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        parser.exit(1, f"AUDIT FAILED: {error}\n")
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["missingTables"]:
        print("AUDIT INCOMPLETE: missing tables: " + ", ".join(report["missingTables"]))
        if not args.allow_missing:
            parser.exit(2, "AUDIT INCOMPLETE: required variant/upgrade tables are missing\n")


if __name__ == "__main__":
    main()
