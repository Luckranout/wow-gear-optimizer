const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;
const statWeights = { Strength: 1, Mastery: 0.5 };
const base = { id: 1, name: "Test Trinket", slot: "Trinket 1", itemLevel: 340, stats: { Strength: 190 } };
const withUse = {
  ...base,
  trinketEffect: { durationSeconds: 10, cooldownSeconds: 90, temporaryStats: { Mastery: 422 } }
};
const scoreWithout = optimizer.scoreItem(base, statWeights);
const scoreWith = optimizer.scoreItem(withUse, statWeights);
assert.ok(scoreWith > scoreWithout, "a modeled on-use temporary stat effect must contribute to trinket score");
assert.equal(optimizer.scoreTrinketUseEffect(withUse, statWeights), 422 * 0.5 * (10 / 90));
assert.equal(optimizer.scoreTrinketUseEffect({ ...withUse, slot: "Neck" }, statWeights), 0, "only trinket slots receive the active trinket score");
assert.equal(optimizer.scoreTrinketUseEffect({ ...withUse, trinketEffect: { durationSeconds: 10, cooldownSeconds: 90, temporaryStats: {} } }, statWeights), 0);
const loadoutWithout = optimizer.scoreLoadout({ "Trinket 1": base }, statWeights, [], "", 90).score;
const loadoutWith = optimizer.scoreLoadout({ "Trinket 1": withUse }, statWeights, [], "", 90).score;
assert.ok(loadoutWith > loadoutWithout, "cooldown-aware effect must be included in full-loadout scoring even when DR scoring is active");
console.log("Trinket on-use effect scoring tests passed.");
