"""Read-only live audit of Blizzard tier-set coverage; never writes the production catalog."""
import os
import sys

from import_blizzard_data import (
    collect_season_tier_set_item_ids,
    get_access_token,
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
    print(f"Target item {TARGET_ITEM_ID} present: {TARGET_ITEM_ID in item_sources}.")
    if TARGET_ITEM_ID in item_sources:
        print(f"Target sources: {item_sources[TARGET_ITEM_ID]}")
        return 0

    print("Target item was not recovered by the live tier-set scan.", file=sys.stderr)
    print(f"Missing expected set names: {missing_sets}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
