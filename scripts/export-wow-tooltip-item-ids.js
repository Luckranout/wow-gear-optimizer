#!/usr/bin/env node
"use strict";

// Build the ID batches consumed by /wgte from the optimizer's existing catalogs.
// Usage: node scripts/export-wow-tooltip-item-ids.js [output.txt] [--batch-size=200]

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sections = [
  "back", "chest", "feet", "hands", "head", "legs", "main-hand",
  "necklaces", "off-hand", "rings", "shoulders", "trinkets", "waist", "wrists"
];

function readJson(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function collectItemIDs() {
  const ids = new Set();
  const add = value => {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  };
  const addItems = items => {
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || typeof item !== "object") continue;
      if (item.slot || item.inventoryType || item.inventory_type) add(item.id ?? item.itemId ?? item.itemID);
    }
  };

  const current = readJson("data/current-retail.json");
  addItems(current.items);

  for (const section of sections) {
    try {
      const data = readJson("data/equipment-sections/" + section + ".json");
      addItems(data.items);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  try {
    const manifest = readJson("data/tier-set-item-ids.json");
    for (const set of manifest.sets || []) {
      for (const piece of set.pieces || []) add(piece.itemId ?? piece.itemID ?? piece.id);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return [...ids].sort((a, b) => a - b);
}

function makeBatches(ids, size) {
  if (!Number.isInteger(size) || size < 1 || size > 200) {
    throw new Error("Batch size must be an integer from 1 to 200.");
  }
  const batches = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));
  return batches;
}

function main() {
  const args = process.argv.slice(2);
  const output = args.find(arg => !arg.startsWith("--")) || path.join(root, "wow-tooltip-item-ids.txt");
  const sizeArg = args.find(arg => arg.startsWith("--batch-size="));
  const batchSize = sizeArg ? Number(sizeArg.split("=")[1]) : 200;
  const ids = collectItemIDs();
  const batches = makeBatches(ids, batchSize);
  const body = batches.map(batch => batch.join(" ")).join("\n\n") + "\n";
  fs.writeFileSync(path.resolve(output), body);
  console.log("Wrote " + ids.length + " unique equipment item IDs in " + batches.length + " batches to " + path.resolve(output));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { collectItemIDs, makeBatches };
