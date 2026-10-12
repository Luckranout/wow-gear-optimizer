// Regression test for Blizzard preview_item.stats structure in current-retail.json.
// Run with: node tests/optimizer-stat-shape.test.js
const assert = require("node:assert/strict");

global.window = {};
require("../optimizer.js");
const optimizer = global.window.WoWOptimizer;

const blizzardItem = {
  id: 193767,
  name: "Havoc Crusher",
  slot: "Main Hand",
  level: 100,
  stats: [
    { type: { name: "agility" }, value: 5, source: "Blizzard preview_item.stats" },
    { type: { name: "stamina" }, value: 8, source: "Blizzard preview_item.stats" },
    { type: { name: "criticalStrike" }, value: 7, source: "Blizzard preview_item.stats" },
    { type: { name: "haste" }, value: 4, source: "Blizzard preview_item.stats" }
  ]
};

assert.equal(optimizer.hasUsableItemStats(blizzardItem), true,
  "Blizzard type.name stats should qualify as usable numerical item stats");
assert.equal(optimizer.scoreItem(blizzardItem, {
  Agility: 1, Stamina: 0, CriticalStrike: 0, Haste: 0
}), 205, "Blizzard type.name stats should contribute to the item score");

const optimized = optimizer.optimizeEquipment({
  items: [blizzardItem],
  character: optimizer.createCharacterProfile(),
  statWeights: { Agility: 1, Stamina: 0, CriticalStrike: 0, Haste: 0 }
});
assert.equal(optimized.equipment["Main Hand"]?.id, 193767,
  "A valid Blizzard-format item should be selectable for its slot");

console.log("PASS: Blizzard item stat format is validated, scored, and eligible for optimization.");
