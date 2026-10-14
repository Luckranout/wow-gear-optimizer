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
  { id: 4, name: "Valid Mail Helm", slot: "Head", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] },
  { id: 5, name: "Disabled Mail Shoulders", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, optimizerEligible: false, stats: [{ type: { name: "haste" }, value: 10000 }] }
];

const report = optimizer.diagnoseSlotCandidates(items, "Shoulders", "Shaman");
assert.equal(report.catalogCount, 5);
assert.equal(report.slotMatchCount, 4);
assert.equal(report.classEligibleCount, 3);
assert.equal(report.optimizerEligibleCount, 2);
assert.equal(report.usableStatsCount, 1);
assert.equal(report.candidates[0].name, "Valid Mail Shoulders");
assert.equal(report.excludedByClass[0].name, "Plate Shoulders");
assert.equal(report.excludedByStats[0].name, "Shoulders Without Stats");
assert.equal(report.excludedByEligibility[0].name, "Disabled Mail Shoulders");
assert.equal(report.candidates.some(item => item.id === 5), false);
assert.equal(
  optimizer.findBestItemForSlot([items[4]], "Shoulders", "general", null, "Shaman"),
  null,
  "optimizer must not recommend an item explicitly marked ineligible"
);
assert.equal(typeof optimizer.diagnoseSlotCandidates, "function");

// Regression: a much lower-level shoulder must not replace a stronger equipped item
// merely because it is the best candidate remaining in a sparse catalog.
const equippedShoulders = {
  id: 271481,
  name: "Hissing Mantle of the Ophidian Oracle",
  slot: "Shoulders",
  itemLevel: 308,
  stats: [
    { type: { name: "agility" }, value: 111 },
    { type: { name: "intellect" }, value: 111 },
    { type: { name: "stamina" }, value: 2172 },
    { type: { name: "critical strike" }, value: 65 },
    { type: { name: "haste" }, value: 70 }
  ]
};
const lowLevelFallback = {
  id: 6,
  name: "Soulslither Spaulders",
  slot: "Shoulders",
  itemLevel: 219,
  stats: [
    { type: { name: "intellect" }, value: 48 },
    { type: { name: "agility" }, value: 48 },
    { type: { name: "stamina" }, value: 754 },
    { type: { name: "critical strike" }, value: 25 },
    { type: { name: "mastery" }, value: 56 }
  ]
};
const guardedShoulders = optimizer.findBestItemForSlot(
  [lowLevelFallback], "Shoulders", "general", null, "Shaman", equippedShoulders
);
assert.equal(guardedShoulders.item.id, equippedShoulders.id);
assert.equal(guardedShoulders.retainedEquipped, true);



const suspiciousTrinket = {
  id: 9991,
  name: "Vile Vial of Volatile Venom",
  slot: "Trinket 1",
  level: 219,
  source: "Blizzard Game Data API",
  stats: [
    { type: { name: "Intellect" }, value: 61 },
    { type: { name: "Agility" }, value: 61 },
    { type: { name: "Strength" }, value: 61 }
  ]
};
const trinketAudit = optimizer.diagnoseSlotCandidates([suspiciousTrinket], "Trinket 1", "Shaman");
assert.equal(trinketAudit.candidates[0].itemLevel, 219);
assert.equal(trinketAudit.candidates[0].itemLevelSource, "level");
assert.equal(trinketAudit.candidates[0].source, "Blizzard Game Data API");
assert.deepEqual(Array.from(trinketAudit.candidates[0].statNames), ["Intellect", "Agility", "Strength"]);
assert.equal(trinketAudit.candidates[0].upgradeTrack, null);

// Regression: use the exact normalized Blizzard item shape (inventoryType.name,
// level, itemClass/itemSubclass, and type.name stats), without a synthetic slot field.
const liveNormalizedShoulder = {
  id: 271481,
  name: "Hissing Mantle of the Ophidian Oracle",
  level: 219,
  inventoryType: { name: "Shoulder" },
  itemClass: { name: "Armor" },
  itemSubclass: { name: "Mail" },
  isEquippable: true,
  stats: [
    { type: { name: "agility" }, value: 48 },
    { type: { name: "intellect" }, value: 48 },
    { type: { name: "stamina" }, value: 754 },
    { type: { name: "critical strike" }, value: 25 },
    { type: { name: "haste" }, value: 56 }
  ]
};
assert.equal(
  optimizer.itemMatchesSlot(liveNormalizedShoulder, "Shoulders"),
  true,
  "Blizzard inventoryType.name=Shoulder must map into the Shoulders slot"
);
const liveShoulderAudit = optimizer.diagnoseSlotCandidates(
  [liveNormalizedShoulder], "Shoulders", "Shaman"
);
assert.equal(liveShoulderAudit.slotMatchCount, 1);
assert.equal(liveShoulderAudit.classEligibleCount, 1);
assert.equal(liveShoulderAudit.usableStatsCount, 1);
assert.equal(liveShoulderAudit.candidates[0].id, 271481);
const liveGuardedShoulder = optimizer.findBestItemForSlot(
  [liveNormalizedShoulder], "Shoulders", "general", null, "Shaman", equippedShoulders
);
assert.equal(liveGuardedShoulder.item.id, equippedShoulders.id);
assert.equal(
  liveGuardedShoulder.item.itemLevel ?? liveGuardedShoulder.item.level,
  equippedShoulders.itemLevel,
  "matching item ID must resolve to the equipped higher-level variant"
);

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
