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


def is_verified_unsupported_conditional_effect(item):
    """Allow only the specifically documented Permafrost Essence effect-only record."""
    return (
        isinstance(item, dict)
        and item.get("id") == 250244
        and item.get("name") == "Permafrost Essence"
        and item.get("isEquippable") is True
        and item.get("catalogClassification") == "effect-based"
        and item.get("optimizationStatus") == "unsupported_conditional_effect"
        and item.get("conditionalEffectsSupported") is False
        and item.get("optimizationStatusSource")
        == "Wowhead tooltip explicitly contains Mark of Frost and Frost Barrier; effect scaling/model unresolved"
        and not has_numeric_stats(item)
    )


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

        # Cosmetic classification is accepted only when backed by an explicit
        # source label; item level/name alone never determines classification.
        if item.get("catalogClassification") == "cosmetic":
            if not str(item.get("classificationSource", "")).startswith(
                "Wowhead tooltip explicitly labels item Cosmetic"
            ):
                problems.append(
                    f"{label} ({item.get('name', 'unnamed')}): cosmetic classification lacks explicit source provenance"
                )
            continue

        # One verified effect-based exception is retained but explicitly excluded
        # from static-stat optimization. This exception cannot cover other IDs.
        if is_verified_unsupported_conditional_effect(item):
            continue

        # Every other non-cosmetic record must meet the complete verified-stat contract.
        if item.get("isEquippable") is not True:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): not explicitly marked equippable")
        if not has_numeric_stats(item):
            problems.append(f"{label} ({item.get('name', 'unnamed')}): no non-zero numeric stats")
        if item.get("statsSource") not in ALLOWED_STAT_SOURCES:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): missing or unrecognized statsSource provenance")

    if problems:
        missing_stats = sum(
            isinstance(item, dict)
            and item.get("catalogClassification") != "cosmetic"
            and not is_verified_unsupported_conditional_effect(item)
            and not has_numeric_stats(item)
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

    actual_verified = sum(
        1 for item in items
        if isinstance(item, dict)
        and item.get("catalogClassification") != "cosmetic"
        and not is_verified_unsupported_conditional_effect(item)
        and has_numeric_stats(item)
        and item.get("statsSource") in ALLOWED_STAT_SOURCES
    )
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
    effect_only = sum(is_verified_unsupported_conditional_effect(item) for item in dataset["items"])
    print(f"Catalog items: {total}; records with verified numeric stats and provenance: {verified}; effect-only records excluded from static ranking: {effect_only}")
    print("Strict combat-item coverage gate passed.")


if __name__ == "__main__":
    main()
