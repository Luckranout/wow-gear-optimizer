const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const items = [
  { id: 1, name: "Valid Mail Shoulders", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] },
  { id: 2, name: "Plate Shoulders", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] },
  { id: 3, name: "Shoulders Without Stats", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [] },
  { id: 4, name: "Valid Mail Helm", slot: "Head", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] }
];

const report = optimizer.diagnoseSlotCandidates(items, "Shoulders", "Shaman");
assert.equal(report.catalogCount, 4);
assert.equal(report.slotMatchCount, 3);
assert.equal(report.classEligibleCount, 2);
assert.equal(report.usableStatsCount, 1);
assert.equal(report.candidates[0].name, "Valid Mail Shoulders");
assert.equal(report.excludedByClass[0].name, "Plate Shoulders");
assert.equal(report.excludedByStats[0].name, "Shoulders Without Stats");
assert.equal(typeof optimizer.diagnoseSlotCandidates, "function");

console.log("Slot candidate diagnostics tests passed.");

 
// Audit the real checked-in retail catalog in CI, without needing a Vercel preview.
const catalogPath = "data/current-retail.json";
if (fs.existsSync(catalogPath)) {
  const dataset = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const catalogItems = Array.isArray(dataset) ? dataset : (dataset.items || []);
  const targetId = 271481;
  const targetName = "Hissing Mantle of the Ophidian Oracle";
  const matches = catalogItems.filter(item =>
    String(item.id ?? item.itemId ?? "") === String(targetId) ||
    String(item.name ?? "").toLowerCase() === targetName.toLowerCase()
  );

  console.log("\\n=== REAL RETAIL CATALOG AUDIT ===");
  console.log("Catalog item count:", catalogItems.length);
  console.log("Target ID:", targetId, "| Target name:", targetName);
  console.log("Target matches:", JSON.stringify(matches.map(item => ({
    id: item.id ?? item.itemId ?? null,
    name: item.name ?? null,
    slot: item.slot ?? null,
    inventoryType: item.inventoryType?.name || item.inventoryType || null,
    itemLevel: item.itemLevel ?? item.level ?? null,
    itemClass: item.itemClass?.name || item.itemClass || null,
    itemSubclass: item.itemSubclass?.name || item.itemSubclass || null,
    stats: item.stats ?? null
  })), null, 2));

  if (matches.length) {
    console.log("Shoulder eligibility diagnostics:", JSON.stringify(
      optimizer.diagnoseSlotCandidates(catalogItems, "Shoulders", "Shaman"), null, 2
    ));
  } else {
    console.log("RESULT: Target item is ABSENT from data/current-retail.json.");
    console.log("Name-near matches:", JSON.stringify(catalogItems
      .filter(item => String(item.name ?? "").toLowerCase().includes("ophidian oracle"))
      .slice(0, 10)
      .map(item => ({ id: item.id ?? item.itemId ?? null, name: item.name ?? null })),
      null, 2));
  }
} else {
  console.log("REAL CATALOG AUDIT SKIPPED: data/current-retail.json is not present in this checkout.");
}
