"""Run the full Blizzard catalog importer against a temporary copy, never the checked-in dataset.

This is a live, read-only publication-path audit: it exercises source discovery, source-map
assembly, item enrichment, catalog serialization, and the optimizer against the generated result.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import import_blizzard_data as importer  # noqa: E402

TARGET_ITEM_ID = 271481


def main():
    client_id = os.environ.get("BLIZZARD_CLIENT_ID")
    client_secret = os.environ.get("BLIZZARD_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("Full catalog dry-run skipped: Blizzard API credentials are unavailable.")
        return 0

    checked_in_catalog = ROOT / "data" / "current-retail.json"
    if not checked_in_catalog.exists():
        raise RuntimeError(f"Seed catalog does not exist: {checked_in_catalog}")

    with tempfile.TemporaryDirectory(prefix="wow-catalog-dry-run-") as temp_dir:
        output_path = Path(temp_dir) / "current-retail.json"
        shutil.copyfile(checked_in_catalog, output_path)

        # main() uses this module-level destination for both reading the seed and
        # writing the generated catalog. Redirect it before running the exact importer.
        importer.OUTPUT = str(output_path)
        importer.main()

        if not output_path.exists():
            raise RuntimeError("Importer did not write the isolated output catalog.")

        with output_path.open("r", encoding="utf-8") as handle:
            dataset = json.load(handle)

        items = dataset.get("items", [])
        matches = [
            item for item in items
            if str(item.get("id", item.get("itemId", ""))) == str(TARGET_ITEM_ID)
        ]
        if not matches:
            raise RuntimeError(
                f"Full catalog assembly completed but target item {TARGET_ITEM_ID} "
                "is absent from the generated catalog."
            )

        target = matches[0]
        inventory = target.get("inventoryType") or {}
        stats = target.get("stats") or []
        source_locations = target.get("sourceLocations") or []
        has_numeric_stats = any(
            isinstance(entry, dict)
            and isinstance(entry.get("value"), (int, float))
            and not isinstance(entry.get("value"), bool)
            and entry.get("value") != 0
            for entry in stats
        )
        print(f"DRY-RUN generated catalog item count: {len(items)}.")
        print(f"DRY-RUN target item name: {target.get('name')}.")
        print(f"DRY-RUN target slot: {inventory.get('name')}.")
        print(f"DRY-RUN target equippable: {target.get('isEquippable')}.")
        print(f"DRY-RUN target has numeric stats: {has_numeric_stats}.")
        print(f"DRY-RUN target source locations: {len(source_locations)}.")

        if (
            inventory.get("name") != "Shoulder"
            or not target.get("isEquippable")
            or not has_numeric_stats
            or not source_locations
        ):
            raise RuntimeError(
                "Target item did not pass full assembled-catalog validation."
            )

        # Exercise the production optimizer against the catalog produced by the
        # full importer, with the character's known upgraded item-level variant.
        node_check = r"""
const fs = require("node:fs");
const path = require("node:path");
global.window = {};
require(path.join(process.env.REPO_ROOT, "optimizer.js"));
const optimizer = window.WoWOptimizer;
const dataset = JSON.parse(fs.readFileSync(process.env.AUDIT_CATALOG_PATH, "utf8"));
const items = dataset.items || [];
const target = items.find(item => String(item.id ?? item.itemId) === "271481");
if (!target) throw new Error("Generated catalog does not contain target item 271481.");
const report = optimizer.diagnoseSlotCandidates(items, "Shoulders", "Shaman");
if (!report.candidates.some(item => String(item.id) === "271481")) {
  throw new Error("Target item failed optimizer slot/class/stats eligibility.");
}
const equipped = { ...target, slot: "Shoulders", itemLevel: 308, level: 308 };
const result = optimizer.findBestItemForSlot(
  items, "Shoulders", "general", null, "Shaman", equipped, "Enhancement"
);
if (!result || String(result.item.id) !== "271481" || Number(result.item.itemLevel ?? result.item.level) !== 308) {
  throw new Error("Optimizer did not retain the equipped level-308 target variant.");
}
console.log("DRY-RUN optimizer: generated target passes Shoulder eligibility and equipped level-308 retention.");
"""
        env = os.environ.copy()
        env["REPO_ROOT"] = str(ROOT)
        env["AUDIT_CATALOG_PATH"] = str(output_path)
        subprocess.run(["node", "-e", node_check], cwd=ROOT, env=env, check=True)

        print("Full catalog dry-run passed. The checked-in catalog and repository were not modified.")


if __name__ == "__main__":
    main()
