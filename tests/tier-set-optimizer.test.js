const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const bonuses = [
  { setId: "midnight-tier", name: "Test Tier", className: "Mage", specialization: "Fire", pieces: 2, bonusScore: 300 },
  { setId: "midnight-tier", name: "Test Tier", className: "Mage", specialization: "Fire", pieces: 4, bonusScore: 500 }
];
const items = [
  { id: 1, name: "Set Helm", slot: "Head", setId: "midnight-tier", itemLevel: 450, stats: { Intellect: 100 } },
  { id: 2, name: "Set Chest", slot: "Chest", setId: "midnight-tier", itemLevel: 450, stats: { Intellect: 100 } },
  { id: 3, name: "Nonset Helm", slot: "Head", itemLevel: 500, stats: { Intellect: 100 } },
  { id: 4, name: "Nonset Chest", slot: "Chest", itemLevel: 500, stats: { Intellect: 100 } }
];
const character = { className: "Mage", specialization: "Fire", goal: "Raid", equipment: {} };

const normal = optimizer.optimizeEquipment({ items, character, goal: "Raid" });
const tier = optimizer.optimizeEquipment({ items, character, goal: "Raid", tierSetAware: true, setBonuses: bonuses });
assert.equal(normal.equipment.Head.id, 3, "normal mode should retain the higher base-score non-set helm");
assert.equal(normal.equipment.Chest.id, 4, "normal mode should retain the higher base-score non-set chest");
assert.equal(tier.equipment.Head.id, 1, "tier-aware mode should choose set helm when verified bonus score offsets base-score loss");
assert.equal(tier.equipment.Chest.id, 2, "tier-aware mode should choose set chest when verified bonus score offsets base-score loss");
assert.equal(tier.setBonusScore, 300, "two pieces should activate the configured 2-piece score only");
assert.equal(tier.score, tier.baseScore + 300, "reported total should include active set-bonus score");

const wrongSpec = optimizer.getSetBonusContext({ equipment: tier.equipment, setBonuses: bonuses, className: "Mage", specialization: "Frost" });
assert.equal(wrongSpec.bonusScore, 0, "specialization-specific bonus must not apply to another spec");

const report = optimizer.createOptimizationReport({
  character, availableItems: items, dataset: { setBonuses: [] }, tierSetAware: true
});
assert.equal(report.tierSetAware, true, "report should expose tier-set mode state");
assert.equal(report.tierSet.scoringDataAvailable, false, "missing verified bonus scores must be disclosed");
assert.ok(report.tierSet.note.includes("no verified numeric set-bonus scoring values"), "missing metadata warning should be explicit");

console.log("Tier-set-aware optimizer tests passed.");
