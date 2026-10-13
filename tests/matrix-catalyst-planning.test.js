const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;
const item = {
  id: 271481,
  name: "Hissing Mantle of the Ophidian Oracle",
  slot: "Shoulders",
  itemClass: { name: "Armor" },
  itemLevel: 344,
  upgradeTrack: { name: "Hero" },
  stats: [{ type: { name: "haste" }, value: 70 }]
};

const noCharge = optimizer.evaluateMatrixCatalystOption({ item, charges: 0 });
assert.equal(noCharge.eligible, false);
assert.match(noCharge.reason, /No Matrix Catalyst charge/);

const shoulder = optimizer.evaluateMatrixCatalystOption({ item, charges: 2 });
assert.equal(shoulder.eligible, true);
assert.equal(shoulder.slotType, "tier");
assert.equal(shoulder.grantsTierSetBonus, true);
assert.equal(shoulder.cost, 1);
assert.equal(shoulder.remainingCharges, 1);
assert.equal(shoulder.itemLevel, 344);
assert.equal(shoulder.upgradeTrack, "Hero");
assert.equal(shoulder.convertedItemAvailable, false);
assert.equal(shoulder.needsVerification, true);

const converted = {
  id: 999,
  name: "Class Tier Shoulders",
  slot: "Shoulders",
  itemClass: { name: "Armor" },
  itemLevel: 344,
  upgradeTrack: { name: "Hero" },
  stats: [{ type: { name: "critical strike" }, value: 70 }]
};
const verifiedShoulder = optimizer.evaluateMatrixCatalystOption({ item, charges: 1, convertedItem: converted });
assert.equal(verifiedShoulder.levelPreserved, true);
assert.equal(verifiedShoulder.trackPreserved, true);
assert.equal(verifiedShoulder.convertedStatsKnown, true);
assert.equal(verifiedShoulder.needsVerification, false);

const belt = optimizer.evaluateMatrixCatalystOption({
  item: { ...item, slot: "Waist" },
  charges: 1,
  convertedItem: { ...converted, slot: "Waist" }
});
assert.equal(belt.eligible, true);
assert.equal(belt.slotType, "non-tier");
assert.equal(belt.grantsTierSetBonus, false);
assert.equal(belt.cost, 1);

// Unsupported slots and non-armor items must never be offered as Catalyst options.
assert.equal(optimizer.evaluateMatrixCatalystOption({
  item: { ...item, slot: "Neck" }, charges: 1
}).eligible, false);
assert.equal(optimizer.evaluateMatrixCatalystOption({
  item: { ...item, itemClass: { name: "Weapon" } }, charges: 1
}).eligible, false);

console.log("Matrix Catalyst planning tests passed.");
