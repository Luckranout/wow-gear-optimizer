#!/usr/bin/env python3
"""Fail-closed validation for imported item-stat records.

This gate requires complete coverage of the imported equipment candidate set.
Presence of a few numeric values is not enough to publish a catalog for recommendations.
"""
import json
import math
import sys
from numbers import Real
from pathlib import Path


def _stat_name(stat):
    if not isinstance(stat, dict):
        return ""
    for key in ("stat", "type"):
        value = stat.get(key)
        if isinstance(value, dict):
            name = value.get("name") or value.get("type")
            if name:
                return str(name).strip()
        elif isinstance(value, str) and value.strip():
            return value.strip()
    name = stat.get("name")
    return str(name).strip() if name else ""


def has_numeric_stats(item):
    """True only when at least one named stat has a finite non-zero value."""
    stats = item.get("stats") if isinstance(item, dict) else None
    if not isinstance(stats, list):
        return False
    for stat in stats:
        if not isinstance(stat, dict) or not _stat_name(stat):
            continue
        value = stat.get("value")
        if isinstance(value, Real) and not isinstance(value, bool) and math.isfinite(value) and value != 0:
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

    ids = [item.get("id") for item in items if isinstance(item, dict)]
    if len(ids) != len(items) or any(item_id is None for item_id in ids):
        raise ValueError("every catalog item must be an object with an ID")
    if len(set(ids)) != len(ids):
        raise ValueError("catalog contains duplicate item IDs")

    actual_verified = sum(has_numeric_stats(item) for item in items)
    missing = len(items) - actual_verified
    coverage = (dataset.get("apiCheck") or {}).get("itemStatCoverage") or {}
    reported_verified = coverage.get("itemsWithVerifiedStats")
    reported_missing = coverage.get("itemsMissingVerifiedStats")
    reported_candidates = coverage.get("candidateItemCount")

    if reported_verified != actual_verified:
        raise ValueError(
            f"importer coverage count ({reported_verified!r}) does not match "
            f"independently counted item records ({actual_verified})"
        )
    if reported_missing != missing:
        raise ValueError(
            f"importer missing-stat count ({reported_missing!r}) does not match "
            f"independently counted incomplete records ({missing})"
        )
    if reported_candidates != len(items):
        raise ValueError(
            f"importer candidate count ({reported_candidates!r}) does not match "
            f"catalog item count ({len(items)})"
        )
    if missing:
        raise ValueError(
            f"{missing}/{len(items)} candidate items lack named, non-zero numeric stats; "
            "refusing to publish a partially verified catalog"
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
    print(f"Catalog items: {total}; records with named numeric stats: {verified}")
    print("Complete basic stat coverage gate passed. This does not prove correct item variants, accurate stat scaling, or enhancement-effect completeness.")


if __name__ == "__main__":
    main()
