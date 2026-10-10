#!/usr/bin/env python3
"""Convert verified SimulationCraft ItemSparse stat IDs into named primary/secondary stats.

Mapping source: SimulationCraft engine/dbc/data_enums.hh, enum item_mod_type,
from the exact SimulationCraft revision used by the caller. Only explicitly
listed IDs are converted. Unknown IDs are retained in the report and never guessed.
This is a conversion probe, not a complete production item importer.
"""
import argparse
import json
import math
from pathlib import Path

# Stable ItemModType IDs confirmed in SimulationCraft's item_mod_type enum.
# Some historical aliases are deliberately excluded until their current use is audited.
# IDs whose enum names are known but are intentionally not scored as ordinary
# scalar stats: combined primary stats need character/class-aware resolution;
# legacy defensive ratings need a current-retail applicability check.
KNOWN_CONTEXT_DEPENDENT_STAT_IDS = {
    13: "dodgeRating (legacy/context-dependent; not enabled for scoring)",
    14: "parryRating (legacy/context-dependent; not enabled for scoring)",
    71: "strengthAgilityIntellect (combined primary stats; requires context)",
    72: "strengthAgility (combined primary stats; requires context)",
    73: "agilityIntellect (combined primary stats; requires context)",
    74: "strengthIntellect (combined primary stats; requires context)",
}

VERIFIED_STAT_MAP = {
    3: "agility",
    4: "strength",
    5: "intellect",
    7: "stamina",
    32: "criticalStrike",
    36: "haste",
    40: "versatility",
    49: "mastery",
    61: "speed",
    62: "leech",
    63: "avoidance",
}


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def convert_record(record):
    if not isinstance(record, dict):
        raise ValueError("each ItemSparse record must be an object")
    item_id = record.get("id")
    if not isinstance(item_id, int) or isinstance(item_id, bool) or item_id <= 0:
        raise ValueError("record has no valid positive integer item ID")

    named_stats = {}
    unmapped = []
    context_dependent = []
    malformed = []
    for index in range(1, 11):
        stat_type = record.get(f"stat_type_{index}")
        value = record.get(f"stat_alloc_{index}", record.get(f"stat_value_{index}"))
        if stat_type is None and value is None:
            continue
        if not isinstance(stat_type, int) or isinstance(stat_type, bool) or not finite_number(value):
            malformed.append({"slot": index, "statTypeId": stat_type, "value": value})
            continue
        if stat_type <= 0:
            continue
        stat_name = VERIFIED_STAT_MAP.get(stat_type)
        if stat_name is None:
            pair = {"statTypeId": stat_type, "value": value}
            if stat_type in KNOWN_CONTEXT_DEPENDENT_STAT_IDS:
                context_dependent.append({
                    **pair,
                    "knownMeaning": KNOWN_CONTEXT_DEPENDENT_STAT_IDS[stat_type],
                })
            else:
                unmapped.append(pair)
            continue
        named_stats[stat_name] = named_stats.get(stat_name, 0) + value

    return {
        "itemId": item_id,
        "name": record.get("name"),
        "itemLevel": record.get("item_level"),
        "stats": named_stats,
        "unmappedStatPairs": unmapped,
        "contextDependentStatPairs": context_dependent,
        "malformedStatPairs": malformed,
        "fullyMapped": bool(named_stats) and not unmapped and not context_dependent and not malformed,
    }


def convert_records(records):
    if not isinstance(records, list) or not records:
        raise ValueError("input must be a non-empty JSON array")
    converted = [convert_record(record) for record in records]
    unmapped_stat_id_counts = {}
    context_dependent_stat_id_counts = {}
    for item in converted:
        for pair in item["contextDependentStatPairs"]:
            key = str(pair["statTypeId"])
            context_dependent_stat_id_counts[key] = context_dependent_stat_id_counts.get(key, 0) + 1
        for pair in item["unmappedStatPairs"]:
            key = str(pair["statTypeId"])
            unmapped_stat_id_counts[key] = unmapped_stat_id_counts.get(key, 0) + 1
    return {
        "source": "SimulationCraft ItemSparse",
        "mappingSource": "SimulationCraft engine/dbc/data_enums.hh item_mod_type",
        "mappingPolicy": "Only explicit IDs in VERIFIED_STAT_MAP are named; unknown IDs remain unmapped.",
        "recordCount": len(converted),
        "recordsWithNamedStats": sum(bool(r["stats"]) for r in converted),
        "fullyMappedRecords": sum(r["fullyMapped"] for r in converted),
        "recordsWithUnmappedStats": sum(bool(r["unmappedStatPairs"]) for r in converted),
        "recordsWithContextDependentStats": sum(bool(r["contextDependentStatPairs"]) for r in converted),
        "recordsWithMalformedStats": sum(bool(r["malformedStatPairs"]) for r in converted),
        "unmappedStatIdPairCounts": dict(sorted(unmapped_stat_id_counts.items(), key=lambda pair: int(pair[0]))),
        "contextDependentStatIdPairCounts": dict(sorted(context_dependent_stat_id_counts.items(), key=lambda pair: int(pair[0]))),
        "items": converted,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = convert_records(json.loads(args.input.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, ValueError) as error:
        parser.exit(1, f"CONVERSION FAILED: {error}\n")
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "items"}, indent=2))


if __name__ == "__main__":
    main()
