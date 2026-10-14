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

// Hard armor proficiency matrix: only the character's armor type is eligible.
const armorMatrix = [
  ["Warrior", "Plate", true], ["Warrior", "Mail", false], ["Warrior", "Leather", false], ["Warrior", "Cloth", false],
  ["Paladin", "Plate", true], ["Paladin", "Mail", false], ["Paladin", "Leather", false], ["Paladin", "Cloth", false],
  ["Death Knight", "Plate", true], ["Death Knight", "Mail", false], ["Death Knight", "Leather", false], ["Death Knight", "Cloth", false],
  ["Hunter", "Mail", true], ["Hunter", "Plate", false], ["Hunter", "Leather", false], ["Hunter", "Cloth", false],
  ["Shaman", "Mail", true], ["Shaman", "Plate", false], ["Shaman", "Leather", false], ["Shaman", "Cloth", false],
  ["Evoker", "Mail", true], ["Evoker", "Plate", false], ["Evoker", "Leather", false], ["Evoker", "Cloth", false],
  ["Demon Hunter", "Leather", true], ["Demon Hunter", "Plate", false], ["Demon Hunter", "Mail", false], ["Demon Hunter", "Cloth", false],
  ["Druid", "Leather", true], ["Druid", "Plate", false], ["Druid", "Mail", false], ["Druid", "Cloth", false],
  ["Monk", "Leather", true], ["Monk", "Plate", false], ["Monk", "Mail", false], ["Monk", "Cloth", false],
  ["Rogue", "Leather", true], ["Rogue", "Plate", false], ["Rogue", "Mail", false], ["Rogue", "Cloth", false],
  ["Mage", "Cloth", true], ["Mage", "Plate", false], ["Mage", "Mail", false], ["Mage", "Leather", false],
  ["Priest", "Cloth", true], ["Priest", "Plate", false], ["Priest", "Mail", false], ["Priest", "Leather", false],
  ["Warlock", "Cloth", true], ["Warlock", "Plate", false], ["Warlock", "Mail", false], ["Warlock", "Leather", false]
];
for (const [className, armorType, expected] of armorMatrix) {
  const armorItem = {
    id: 8000 + armorMatrix.indexOf(armorMatrix.find(entry => entry[0] === className && entry[1] === armorType)),
    name: armorType + " Shoulders",
    slot: "Shoulders",
    itemClass: { name: "Armor" },
    itemSubclass: { name: armorType },
    itemLevel: 300,
    stats: { Haste: 20 }
  };
  assert.equal(
    optimizer.diagnoseSlotCandidates([armorItem], "Shoulders", className).classEligibleCount,
    expected ? 1 : 0,
    className + " must " + (expected ? "accept " : "reject ") + armorType + " armor"
  );
}
const unknownArmor = { slot: "Shoulders", itemClass: { name: "Armor" }, itemLevel: 300, stats: { Haste: 20 } };
assert.equal(optimizer.diagnoseSlotCandidates([unknownArmor], "Shoulders", "Warrior").classEligibleCount, 0,
  "armor with unknown subclass must be rejected for armor slots");
const unrestrictedNeck = { slot: "Neck", itemClass: { name: "Armor" }, itemSubclass: { name: "Cloth" }, itemLevel: 300, stats: { Haste: 20 } };
assert.equal(optimizer.diagnoseSlotCandidates([unrestrictedNeck], "Neck", "Warrior").classEligibleCount, 1,
  "neck items must not be filtered by armor proficiency");


// Regression: a much lower-level shoulder must not replace a stronger equipped item
// merely because it is the best candidate remaining in a sparse catalog.
const equippedShoulders = {
  id: 271481,
  name: "Hissing Mantle of the Ophidian Oracle",
  slot: "Shoulders",
  itemClass: { name: "Armor" },
  itemSubclass: { name: "Mail" },
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
  itemClass: { name: "Armor" },
  itemSubclass: { name: "Mail" },
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
  // Report slot coverage even when the known target is absent from the
  // checked-in catalog, so missing Neck/Shoulders candidates are visible in CI.
  for (const slot of ["Neck", "Shoulders"]) {
    const slotReport = optimizer.diagnoseSlotCandidates(catalogItems, slot, "Shaman");
    console.log(`Catalog ${slot} coverage:`, JSON.stringify({
      catalogCount: slotReport.catalogCount,
      slotMatchCount: slotReport.slotMatchCount,
      classEligibleCount: slotReport.classEligibleCount,
      optimizerEligibleCount: slotReport.optimizerEligibleCount,
      usableStatsCount: slotReport.usableStatsCount,
      candidates: slotReport.candidates.slice(0, 5).map(item => ({
        id: item.id, name: item.name, itemLevel: item.itemLevel
      })),
      excludedByClass: slotReport.excludedByClass.slice(0, 3).map(item => ({
        id: item.id, name: item.name, itemSubclass: item.itemSubclass
      })),
      excludedByStats: slotReport.excludedByStats.slice(0, 3).map(item => ({
        id: item.id, name: item.name
      }))
    }, null, 2));
  }

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
