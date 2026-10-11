#!/usr/bin/env python3
"""Fail-closed validation for imported item-stat records, with explicit cosmetic exceptions."""
import json
import math
import sys
from numbers import Real
from pathlib import Path


def has_numeric_stats(item):
    stats = item.get("stats") if isinstance(item, dict) else None
    if not isinstance(stats, list):
        return False
    for stat in stats:
        if not isinstance(stat, dict):
            continue
        value = stat.get("value")
        if isinstance(value, Real) and not isinstance(value, bool) and math.isfinite(value) and value != 0:
            return True
    return False


def is_explicitly_cosmetic(item):
    """Only accept a cosmetic exception when the importer records source evidence."""
    if not isinstance(item, dict):
        return False
    return (
        item.get("catalogClassification") == "cosmetic"
        and item.get("classificationSource") == "Wowhead tooltip explicitly labels item Cosmetic"
        and item.get("wowheadTooltipClassificationEvidence") == "Explicit Cosmetic label in tooltip"
    )


def validate_dataset(dataset):
    if not isinstance(dataset, dict):
        raise ValueError("dataset root must be an object")
    items = dataset.get("items")
    if not isinstance(items, list):
        raise ValueError("catalog 'items' field is missing or not a list")
    if not items:
        raise ValueError("catalog contains no items")

    actual_verified = sum(has_numeric_stats(item) for item in items)
    if actual_verified <= 0:
        raise ValueError("no item record contains a non-zero numeric stat value")
    coverage = (dataset.get("apiCheck") or {}).get("itemStatCoverage") or {}
    reported_verified = coverage.get("itemsWithVerifiedStats")
    if reported_verified != actual_verified:
        raise ValueError(
            f"importer coverage count ({reported_verified!r}) does not match "
            f"independently counted item records ({actual_verified})"
        )

    missing = [
        item for item in items
        if not has_numeric_stats(item) and not is_explicitly_cosmetic(item)
    ]
    if missing:
        details = []
        for item in missing[:20]:
            if isinstance(item, dict):
                details.append(f"{item.get('id', 'unknown')} {item.get('name', 'unnamed')}")
            else:
                details.append("malformed item record")
        suffix = f" (and {len(missing) - 20} more)" if len(missing) > 20 else ""
        raise ValueError(
            f"{len(missing)} non-cosmetic item record(s) lack verified non-zero numeric stats: "
            + ", ".join(details) + suffix
            + "; explicit conditional-effect metadata is not a substitute for base stats"
        )
    cosmetic_exceptions = sum(is_explicitly_cosmetic(item) and not has_numeric_stats(item) for item in items)
    return len(items), actual_verified, cosmetic_exceptions


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/current-retail.json")
    if not path.exists():
        sys.exit("VERIFY FAILED: importer did not create the catalog.")
    try:
        with path.open(encoding="utf-8") as handle:
            dataset = json.load(handle)
        total, verified, cosmetics = validate_dataset(dataset)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        sys.exit(f"VERIFY FAILED: {error}; refusing to publish catalog.")
    print(f"Catalog items: {total}; records with numeric stats: {verified}; explicit cosmetic exceptions: {cosmetics}")
    print("Stat presence gate passed. This does not prove complete coverage, correct item variants, or accurate stat scaling.")


if __name__ == "__main__":
    main()
