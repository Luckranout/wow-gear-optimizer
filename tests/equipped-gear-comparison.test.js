const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("optimizer.js", "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);
const optimizer = context.window.WoWOptimizer;

assert.strictEqual(
  optimizer.normalizeItemStatName("Critical Strike"),
  "CriticalStrike"
);
assert.strictEqual(
  optimizer.normalizeItemStatName("haste_rating"),
  "Haste"
);

const simWeights = {
  Strength: 0.1,
  CriticalStrike: 2.0,
  Haste: 0.2
};

const currentRing = {
  id: 2001,
  name: "Strength Ring",
  slot: "Ring 1",
  itemLevel: 318,
  stats: [{ name: "Strength", value: 20 }]
};

const critRing = {
  id: 2002,
  name: "Critical Strike Ring",
  slot: "Ring 1",
  itemLevel: 318,
  stats: [{ name: "Critical Strike", value: 20 }]
};

const hasteRing = {
  id: 2003,
  name: "Haste Ring",
  slot: "Ring 1",
  itemLevel: 318,
  stats: [{ name: "Haste", value: 20 }]
};

const report = optimizer.createOptimizationReport({
  character: {
    ...optimizer.createCharacterProfile(),
    className: "Warrior",
    specialization: "Protection",
    goal: "Mythic+",
    equipment: { "Ring 1": currentRing },
    simulation: {
      source: "SimulationCraft",
      method: "scale-factors",
      specialization: "Protection Warrior",
      scaleFactors: simWeights
    }
  },
  availableItems: [currentRing, critRing, hasteRing],
  dataset: { items: [currentRing, critRing, hasteRing], optimizationProfiles: {} }
});

assert.strictEqual(report.topUpgrades.length, 1);
assert.strictEqual(report.topUpgrades[0].slot, "Ring 1");
assert.strictEqual(report.topUpgrades[0].recommendedItem.name, "Critical Strike Ring");
assert.ok(report.topUpgrades[0].improvement > 0);

console.log("Step 20 equipped gear comparison and item stat normalization passed.");
