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

        # Effect-only records are permitted only for specifically reviewed items
        # with explicit source provenance. These remain visible but unscored.
        if item.get("catalogClassification") == "effect-only-unmodeled":
            classification_source = str(item.get("classificationSource", ""))
            supported_effect_only = (
                item_id == 250244
                and classification_source.startswith(
                    "Wowhead tooltip for item 250244: equip effect only; no explicit base stats"
                )
            ) or (
                item_id == 250224
                and classification_source.startswith(
                    "Mindpiercer's Sigil tooltip: temporary Intellect proc only; no permanent base stats"
                )
            )
            if not supported_effect_only or item.get("optimizerEligible") is not False:
                problems.append(
                    f"{label} ({item.get('name', 'unnamed')}): unsupported effect-only classification lacks verified provenance"
                )
            if has_numeric_stats(item):
                problems.append(f"{label} ({item.get('name', 'unnamed')}): effect-only item must not carry fabricated base stats")
            continue

        # Every non-cosmetic record is treated as combat/unknown and must meet
        # the complete verified-stat contract. Unknown records remain blocked.
        if item.get("isEquippable") is not True:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): not explicitly marked equippable")
        if not has_numeric_stats(item):
            problems.append(f"{label} ({item.get('name', 'unnamed')}): no non-zero numeric stats")
        if item.get("statsSource") not in ALLOWED_STAT_SOURCES:
            problems.append(f"{label} ({item.get('name', 'unnamed')}): missing or unrecognized statsSource provenance")

    if problems:
        missing_stats = sum(
            isinstance(item, dict)
            and item.get("catalogClassification") not in {"cosmetic", "effect-only-unmodeled"}
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
        and item.get("catalogClassification") not in {"cosmetic", "effect-only-unmodeled"}
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
    print(f"Catalog items: {total}; records with verified numeric stats and provenance: {verified}")
    print("Strict combat-item coverage gate passed.")


if __name__ == "__main__":
    main()
