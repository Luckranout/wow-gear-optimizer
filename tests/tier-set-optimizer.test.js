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



// Real Midnight Season 2 / Tier 36 item IDs, verified against the item pages in
// data/tier-set-item-ids.json. The numeric scores below are TEST FIXTURES only;
// Actual set bonuses are specialization-specific effects and are not assigned
// invented optimizer weights by this manifest.
const tierItemManifest = JSON.parse(fs.readFileSync("data/tier-set-item-ids.json", "utf8"));
const shamanSet = tierItemManifest.sets.find(set => set.className === "Shaman");
assert.ok(shamanSet, "verified Shaman Tier 36 mapping should exist");
assert.equal(shamanSet.setId, "2065", "Shaman set ID should match Wowhead's item-set record");
assert.equal(shamanSet.pieces.length, 5, "Shaman mapping should include the five tier slots");
assert.equal(new Set(shamanSet.pieces.map(piece => piece.itemId)).size, 5, "tier piece item IDs must be unique");
assert.deepEqual(
  shamanSet.pieces.map(piece => piece.itemId).sort((a, b) => a - b),
  [271481, 271482, 271483, 271484, 271486],
  "Shaman piece IDs should match the verified Tier 36 item pages"
);
assert.deepEqual(tierItemManifest.completeness.pendingClasses.length, 12,
  "manifest must disclose that 12 other class sets remain unmapped");

const realShamanItems = shamanSet.pieces.map(piece => ({
  id: piece.itemId,
  name: piece.name,
  slot: piece.slot,
  setId: shamanSet.setId,
  itemLevel: 321,
  stats: { Intellect: 100 }
}));
const actualShamanBonuses = [
  { setId: shamanSet.setId, name: shamanSet.setName, className: "Shaman", specialization: "Elemental", pieces: 2, bonusScore: 10 },
  { setId: shamanSet.setId, name: shamanSet.setName, className: "Shaman", specialization: "Elemental", pieces: 4, bonusScore: 20 }
];
function actualShamanLoadout(pieceCount) {
  return Object.fromEntries(realShamanItems.slice(0, pieceCount).map(item => [item.slot, item]));
}
for (const [pieceCount, expectedScore, expectedThresholds] of [
  [1, 0, []],
  [2, 10, [2]],
  [3, 10, [2]],
  [4, 30, [2, 4]],
  [5, 30, [2, 4]]
]) {
  const contextAtBreakpoint = optimizer.getSetBonusContext({
    equipment: actualShamanLoadout(pieceCount),
    setBonuses: actualShamanBonuses,
    className: "Shaman",
    specialization: "Elemental"
  });
  assert.equal(contextAtBreakpoint.bonusScore, expectedScore,
    `${pieceCount} real Shaman tier items should score only the active test-fixture thresholds`);
  assert.deepEqual(
    Array.from(contextAtBreakpoint.activeBonuses, bonus => bonus.pieces).sort((a, b) => a - b),
    expectedThresholds,
    `${pieceCount} real Shaman tier items should activate the correct 2-piece/4-piece breakpoints`
  );
}

console.log("Tier-set-aware optimizer tests passed.");
