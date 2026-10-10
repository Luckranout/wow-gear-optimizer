#!/usr/bin/env python3
"""Audit SimulationCraft dbc_extract.py ItemSparse JSON without guessing stat meanings.

Expected input is the JSON array emitted by:
  dbc_extract.py -t json -b <matching-build> -p <build>/DBFilesClient ItemSparse.db2

This is an audit/probe, not a production importer: numeric stat type IDs are kept
as IDs until their meaning is verified against the matching build's authoritative
data. The script never invents missing values or upgrades.
"""
import argparse
import json
import math
from pathlib import Path


def finite_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def audit_records(records):
    if not isinstance(records, list):
        raise ValueError("input root must be a JSON array")
    if not records:
        raise ValueError("ItemSparse input contains no records")

    valid_ids = 0
    records_with_stat_pairs = 0
    records_with_nonzero_stat_pairs = 0
    malformed_stat_records = 0
    examples = []

    for record in records:
        if not isinstance(record, dict):
            malformed_stat_records += 1
            continue
        item_id = record.get("id")
        if isinstance(item_id, int) and not isinstance(item_id, bool) and item_id > 0:
            valid_ids += 1

        pairs = []
        malformed = False
        for index in range(1, 11):
            stat_type = record.get(f"stat_type_{index}")
            # SimulationCraft ItemSparse schema names these fields stat_alloc_N.
            # Accept stat_value_N as a compatibility alias for older/custom exports.
            stat_value = record.get(f"stat_alloc_{index}", record.get(f"stat_value_{index}"))
            if stat_type is None and stat_value is None:
                continue
            if not isinstance(stat_type, int) or isinstance(stat_type, bool):
                malformed = True
                continue
            if not finite_number(stat_value):
                malformed = True
                continue
            if stat_type > 0:
                pairs.append({"statTypeId": stat_type, "value": stat_value})

        if malformed:
            malformed_stat_records += 1
        if pairs:
            records_with_stat_pairs += 1
        if any(pair["value"] != 0 for pair in pairs):
            records_with_nonzero_stat_pairs += 1
        if len(examples) < 5 and pairs:
            examples.append({
                "id": item_id,
                "name": record.get("name"),
                "itemLevel": record.get("item_level"),
                "statPairs": pairs,
                "hotfixed": record.get("hotfixed", False),
            })

    return {
        "recordCount": len(records),
        "recordsWithValidItemIds": valid_ids,
        "recordsWithStatPairs": records_with_stat_pairs,
        "recordsWithNonzeroStatPairs": records_with_nonzero_stat_pairs,
        "recordsWithMalformedStatFields": malformed_stat_records,
        "exampleRecords": examples,
        "policy": (
            "Audit only. Stat type IDs are intentionally not converted to named stats; "
            "this output does not prove item variant scaling, upgrade context, or completeness."
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON file from dbc_extract.py -t json")
    parser.add_argument("--build", required=True, help="Exact WoW client build used for extraction")
    parser.add_argument("--output", type=Path, help="Optional path to write the audit JSON")
    args = parser.parse_args()

    if not args.build.strip():
        parser.error("--build must be a non-empty exact build identifier")
    try:
        records = json.loads(args.input.read_text(encoding="utf-8"))
        result = audit_records(records)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        parser.exit(1, f"AUDIT FAILED: {error}\n")

    result["source"] = "SimulationCraft dbc_extract.py ItemSparse JSON"
    result["clientBuild"] = args.build.strip()
    serialized = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")


if __name__ == "__main__":
    main()
