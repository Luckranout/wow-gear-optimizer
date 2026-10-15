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

// Real Midnight Season 2 / Tier 36 Shaman item IDs are verified against the item
// pages referenced in data/tier-set-item-ids.json. Numeric bonus scores below are
// test fixtures only; real specialization-specific set effects have no invented weights.
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

// Set identities are recorded for every class, but only classes with verified
// piece IDs may count as mapped. Empty pending records must not masquerade as
// complete tier-piece coverage.
const expectedSetIdentities = [
  ["Death Knight", "2055", "Baleful Grave-Knight's Crucible"],
  ["Demon Hunter", "2056", "Abyssal Doomhound's Pursuit"],
  ["Druid", "2057", "Bark of the Enigmatic Dreamwatcher"],
  ["Evoker", "2058", "Echo of Calamity"],
  ["Hunter", "2059", "Skulking Viper's Ambush"],
  ["Mage", "2060", "Primal Leywarden's Attire"],
  ["Monk", "2061", "Guile of the Monkey King"],
  ["Paladin", "2062", "Radiance of the Consecrated Flame"],
  ["Priest", "2063", "Cosmic Penitent's Raiment"],
  ["Rogue", "2064", "Chosen Bloodslayer's Hexweave"],
  ["Shaman", "2065", "Ophidian Oracle's Prophecy"],
  ["Warlock", "2066", "Damned Necrolyte's Shattered Restraints"],
  ["Warrior", "2067", "Jade Warlord's Dominion"]
];
assert.equal(tierItemManifest.sets.length, 13, "manifest should identify all 13 Midnight Season 2 class sets");
assert.equal(new Set(tierItemManifest.sets.map(set => set.className)).size, 13,
  "each class must have one distinct tier-set record");
assert.equal(new Set(tierItemManifest.sets.map(set => set.setId)).size, 13,
  "class tier-set IDs must be unique");
for (const [className, setId, setName] of expectedSetIdentities) {
  const set = tierItemManifest.sets.find(candidate => candidate.className === className);
  assert.ok(set, `missing tier-set identity for ${className}`);
  assert.equal(set.setId, setId, `${className} set ID should match the Wowhead item-set record`);
  assert.equal(set.setName, setName, `${className} set name should match the Wowhead item-set record`);
  if (className !== "Shaman") {
    assert.equal(set.pieces.length, 0, `${className} must remain unmapped until item IDs are verified`);
    assert.equal(set.mappingStatus, "set-verified-pieces-pending",
      `${className} must explicitly disclose pending piece mapping`);
  }
}
assert.deepEqual(
  tierItemManifest.completeness.mappedClasses,
  ["Shaman"],
  "only classes with verified item IDs may be marked as mapped"
);

const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync("wow-data.js", "utf8"), dataContext);
const wowData = dataContext.window.WoWData;
const normalizedShamanDataset = wowData.normalizeRetailDataset({
  expansion: "Midnight",
  season: 2,
  items: shamanSet.pieces.map(piece => ({
    id: piece.itemId,
    name: piece.name,
    slot: piece.slot,
    itemLevel: 321,
    stats: { Intellect: 100 }
  }))
}, tierItemManifest);
const realShamanItems = normalizedShamanDataset.items;
assert.equal(realShamanItems.length, 5, "all five real Shaman items should survive dataset normalization");
assert.ok(realShamanItems.every(item => item.setId === shamanSet.setId && item.isSetPiece === true),
  "verified item IDs should acquire tier-set membership during dataset normalization");
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
    `${pieceCount} Shaman tier items should score only the active test-fixture thresholds`);
  assert.deepEqual(
    Array.from(contextAtBreakpoint.activeBonuses, bonus => bonus.pieces).sort((a, b) => a - b),
    expectedThresholds,
    `${pieceCount} Shaman tier items should activate the correct 2-piece/4-piece breakpoints`
  );
}

console.log("Tier-set-aware optimizer tests passed.");
