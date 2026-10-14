"""Read-only live audit of Blizzard tier-set coverage; never writes the production catalog."""
import os
import sys

from import_blizzard_data import (
    LOCALE,
    NAMESPACE,
    collect_season_tier_set_item_ids,
    get_access_token,
    get_api_json,
    item_has_verified_stats,
    normalize_item,
)

TARGET_ITEM_ID = 271481


def main():
    client_id = os.environ.get("BLIZZARD_CLIENT_ID")
    client_secret = os.environ.get("BLIZZARD_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("Live tier-set audit skipped: Blizzard API credentials are unavailable.")
        return 0

    token = get_access_token(client_id, client_secret)
    item_sources, matched_sets, missing_sets = collect_season_tier_set_item_ids(token)

    print(f"Live Item Set API matched {len(matched_sets)} expected sets.")
    print(f"Live Item Set API returned {len(item_sources)} unique tier item IDs.")
    print(f"Target item {TARGET_ITEM_ID} present in tier-set sources: {TARGET_ITEM_ID in item_sources}.")
    if TARGET_ITEM_ID not in item_sources:
        print("Target item was not recovered by the live tier-set scan.", file=sys.stderr)
        print(f"Missing expected set names: {missing_sets}", file=sys.stderr)
        return 1

    # Verify the next importer stage too: that the item endpoint resolves the ID
    # and the normalizer produces an equippable catalog record. This remains read-only.
    raw_item = get_api_json(
        f"/data/wow/item/{TARGET_ITEM_ID}",
        token,
        {"namespace": NAMESPACE, "locale": LOCALE},
    )
    normalized = normalize_item(
        raw_item,
        source="Blizzard Game Data API — Season 2+ content source",
    )
    inventory_type = normalized.get("inventoryType") or {}
    verified_stats = item_has_verified_stats(normalized)
    print(f"Target item detail name: {normalized.get('name')}.")
    print(f"Target item detail level: {normalized.get('level')}.")
    print(f"Target item inventory type: {inventory_type.get('name')} (id {inventory_type.get('id')}).")
    print(f"Target item is equippable: {bool(raw_item.get('is_equippable'))}.")
    print(f"Target item has verified numeric stats: {verified_stats}.")

    if (
        not raw_item.get("is_equippable")
        or normalized.get("id") != TARGET_ITEM_ID
        or not inventory_type.get("id")
    ):
        print("Target item failed the live item-detail/slot-metadata gate.", file=sys.stderr)
        return 1
    if not verified_stats:
        print(
            "Target item has no verified numeric stats in Blizzard detail; "
            "the catalog must preserve it as incomplete rather than silently claiming a complete comparison."
        )
    print("Target item passed live source, equippability, ID, and inventory-slot metadata checks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
