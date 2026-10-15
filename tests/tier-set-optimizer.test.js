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

// Real Midnight Season 2 / Tier 36 item IDs are sourced from the Wowhead
// 12.1 PTR item-set pages and each linked item page. Bonus scores below are
// TEST FIXTURES only; the manifest intentionally contains no invented live scores.
const tierItemManifest = JSON.parse(fs.readFileSync("data/tier-set-item-ids.json", "utf8"));
const expectedClasses = [
  "Death Knight", "Demon Hunter", "Druid", "Evoker", "Hunter", "Mage", "Monk",
  "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"
];
const expectedSlots = ["Chest", "Hands", "Head", "Legs", "Shoulders"];
assert.equal(tierItemManifest.sets.length, 13, "manifest should include all 13 class tier sets");
assert.deepEqual(tierItemManifest.completeness.mappedClasses, expectedClasses,
  "all class sets with five verified pieces should be marked mapped");
assert.deepEqual(tierItemManifest.completeness.pendingClasses, [],
  "no class should remain pending after complete verified mapping");
assert.equal(new Set(tierItemManifest.sets.map(set => set.className)).size, 13,
  "each class must have one distinct tier-set record");
assert.equal(new Set(tierItemManifest.sets.map(set => set.setId)).size, 13,
  "class tier-set IDs must be unique");
const allPieceIds = [];
for (const className of expectedClasses) {
  const set = tierItemManifest.sets.find(candidate => candidate.className === className);
  assert.ok(set, `missing tier-set mapping for ${className}`);
  assert.equal(set.pieces.length, 5, `${className} must have all five tier slots mapped`);
  assert.deepEqual(set.pieces.map(piece => piece.slot).sort(),
    expectedSlots.slice().sort(), `${className} must map chest, hands, head, legs, and shoulders`);
  assert.equal(new Set(set.pieces.map(piece => piece.itemId)).size, 5,
    `${className} item IDs must be unique`);
  assert.equal(set.mappingStatus, "verified", `${className} mapping must be explicitly verified`);
  for (const piece of set.pieces) {
    assert.ok(Number.isSafeInteger(piece.itemId) && piece.itemId > 0,
      `${className} ${piece.name} must have a valid base item ID`);
    assert.ok(piece.name && piece.slot && piece.sourceUrl,
      `${className} piece metadata must include name, slot, and source URL`);
    allPieceIds.push(piece.itemId);
  }
}
assert.equal(new Set(allPieceIds).size, 65, "all 65 tier-piece item IDs must be globally unique");

const dataContext = { window: {} };
vm.runInNewContext(fs.readFileSync("wow-data.js", "utf8"), dataContext);
const wowData = dataContext.window.WoWData;
const normalizedDataset = wowData.normalizeRetailDataset({
  expansion: "Midnight",
  season: 2,
  items: tierItemManifest.sets.flatMap(set => set.pieces.map(piece => ({
    id: piece.itemId, name: piece.name, slot: piece.slot, itemLevel: 321,
    stats: { Intellect: 100 }
  })))
}, tierItemManifest);
assert.equal(normalizedDataset.items.length, 65,
  "all 65 verified tier items should survive dataset normalization");
for (const set of tierItemManifest.sets) {
  const setItems = normalizedDataset.items.filter(item => item.setId === set.setId);
  assert.equal(setItems.length, 5, `${set.className} items should normalize to the correct set ID`);
  assert.ok(setItems.every(item => item.isSetPiece === true && item.tierSetClassName === set.className),
    `${set.className} pieces should acquire class-scoped tier membership`);
  const testBonuses = [
    { setId: set.setId, name: set.setName, className: set.className, specialization: "Test", pieces: 2, bonusScore: 10 },
    { setId: set.setId, name: set.setName, className: set.className, specialization: "Test", pieces: 4, bonusScore: 20 }
  ];
  function loadoutAt(pieceCount) {
    return Object.fromEntries(setItems.slice(0, pieceCount).map(item => [item.slot, item]));
  }
  for (const [pieceCount, expectedScore, expectedThresholds] of [
    [1, 0, []], [2, 10, [2]], [3, 10, [2]], [4, 30, [2, 4]], [5, 30, [2, 4]]
  ]) {
    const contextAtBreakpoint = optimizer.getSetBonusContext({
      equipment: loadoutAt(pieceCount), setBonuses: testBonuses,
      className: set.className, specialization: "Test"
    });
    assert.equal(contextAtBreakpoint.bonusScore, expectedScore,
      `${set.className} ${pieceCount}-piece loadout should activate only fixture thresholds`);
    assert.deepEqual(
      Array.from(contextAtBreakpoint.activeBonuses, bonus => bonus.pieces).sort((a,b)=>a-b),
      expectedThresholds,
      `${set.className} ${pieceCount}-piece loadout should activate correct 2pc/4pc thresholds`
    );
  }
  const wrongSpec = optimizer.getSetBonusContext({
    equipment: loadoutAt(4), setBonuses: testBonuses,
    className: set.className, specialization: "Other"
  });
  assert.equal(wrongSpec.bonusScore, 0,
    `${set.className} bonus fixtures must remain specialization-scoped`);
}

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
