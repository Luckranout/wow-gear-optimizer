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
    return {
        "recordCount": len(records),
        "recordsWithId": identified,
        "uniqueIds": unique,
        "duplicateIdsAmongIdentified": identified - unique,
    }


def audit_directory(directory):
    result = {"source": "SimulationCraft DB2 JSON export", "tables": {}, "missingTables": []}
    for name in TABLES:
        path = directory / f"{name}.json"
        if not path.exists():
            result["missingTables"].append(name)
            continue
        records = json.loads(path.read_text(encoding="utf-8"))
        result["tables"][name] = audit_table(name, records)
    result["tableCountFound"] = len(result["tables"])
    result["tableCountExpected"] = len(TABLES)
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
