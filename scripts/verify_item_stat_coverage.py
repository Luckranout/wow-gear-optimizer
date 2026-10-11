#!/usr/bin/env python3
"""Fail-closed validation for the imported combat-item catalog."""
import json
import math
import sys
from numbers import Real
from pathlib import Path


ALLOWED_STAT_SOURCES = {
    "Blizzard Game Data API",
    "Wowhead tooltip (explicit displayed stats)",
}


def has_numeric_stats(item):
    stats = item.get("stats") if isinstance(item, dict) else None
    if not isinstance(stats, list):
        return False
    for stat in stats:
        if not isinstance(stat, dict):
            continue
        value = stat.get("value")
        if (
            isinstance(value, Real)
            and not isinstance(value, bool)
            and math.isfinite(value)
            and value != 0
        ):
            return True
    return False


def validate_dataset(dataset):
    if not isinstance(dataset, dict):
        raise ValueError("dataset root must be an object")
    items = dataset.get("items")
    if not isinstance(items, list):
        raise ValueError("catalog 'items' field is missing or not a list")
    if not items:
        raise ValueError("catalog contains no items")

    problems = []
    seen_ids = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            problems.append(f"record #{index + 1} is not an object")
            continue

        item_id = item.get("id")
        label = f"item {item_id}" if item_id is not None else f"record #{index + 1}"
        if item_id is not None:
            if item_id in seen_ids:
                problems.append(f"{label}: duplicate item ID")
            seen_ids.add(item_id)

        # This importer's catalog is built from equippable combat-item candidates.
        # Do not silently treat unknown or non-equippable records as cosmetic.
        if item.get("isEquippable") is not True:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): not explicitly marked equippable")
        if not has_numeric_stats(item):
            problems.append(f"{label} ({item.get('name', 'unnamed')}): no non-zero numeric stats")
        if item.get("statsSource") not in ALLOWED_STAT_SOURCES:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): missing or unrecognized statsSource provenance")

    if problems:
        missing_stats = sum(
            isinstance(item, dict) and not has_numeric_stats(item)
            for item in items
        )
        prefix = (
            f"no item record has verified stats ({missing_stats} item record(s) lack non-zero numeric stats); "
            if missing_stats else ""
        )
        preview = "; ".join(problems[:20])
        remaining = len(problems) - min(len(problems), 20)
        suffix = f"; and {remaining} more problem(s)" if remaining else ""
        raise ValueError(
            f"{prefix}{len(problems)} catalog validation problem(s); refusing to publish: "
            f"{preview}{suffix}"
        )

    actual_verified = len(items)
    coverage = (dataset.get("apiCheck") or {}).get("itemStatCoverage") or {}
    reported_verified = coverage.get("itemsWithVerifiedStats")
    if reported_verified != actual_verified:
        raise ValueError(
            f"importer coverage count ({reported_verified!r}) does not match "
            f"independently validated combat-item count ({actual_verified})"
        )
    return len(items), actual_verified


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/current-retail.json")
    if not path.exists():
        sys.exit("VERIFY FAILED: importer did not create the catalog.")
    try:
        with path.open(encoding="utf-8") as handle:
            dataset = json.load(handle)
        total, verified = validate_dataset(dataset)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        sys.exit(f"VERIFY FAILED: {error}; refusing to publish catalog.")
    print(f"Catalog items: {total}; records with verified numeric stats and provenance: {verified}")
    print("Strict combat-item coverage gate passed.")


if __name__ == "__main__":
    main()
