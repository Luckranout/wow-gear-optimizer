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
    """Check only source-verified relationships when both tables are present.

    Bonus-tree IDs are intentionally not checked here: their target table/field
    semantics have not yet been established from the current build schema.
    """
    checks = [
        ("ItemBonusListLevelDelta", ("id_item_bonus_list", "id_bonus_list"), "ItemBonus"),
        ("ItemXItemEffect", ("id_item_effect",), "ItemEffect"),
    ]
    report = []
    for source_name, candidate_fields, target_name in checks:
        if source_name not in tables or target_name not in tables:
            continue
        source_rows = tables[source_name]
        target_ids = _record_ids(tables[target_name])
        fields_present = [field for field in candidate_fields if any(field in row for row in source_rows)]
        for field in fields_present:
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
