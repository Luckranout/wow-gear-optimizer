const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const importHelpers = require("../character-import.js");
const stats = importHelpers.formatCharacterStatistics({
  Strength: 1200,
  CriticalStrike: 450,
  Armor: 9000,
  Dodge: 25,
  Leech: 10,
  Avoidance: 14,
  Versatility: "not-a-number"
});
assert(stats.some(stat => stat.label === "Strength" && stat.value === 1200));
assert(stats.some(stat => stat.label === "Armor" && stat.value === 9000));
assert(stats.some(stat => stat.label === "Dodge" && stat.value === 25));
assert(stats.some(stat => stat.label === "Leech" && stat.value === 10));
assert(stats.some(stat => stat.label === "Avoidance" && stat.value === 14));
assert(!stats.some(stat => stat.key === "Versatility"), "non-numeric imported values must not be shown");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve("../optimizer.js"), "utf8"), sandbox);
const optimizer = sandbox.window.WoWOptimizer;
const unverified = { id: 1, name: "Unknown-stat item", slot: "Head", itemLevel: 999, stats: [] };
const verified = { id: 2, name: "Verified-stat item", slot: "Head", itemLevel: 100, stats: { Strength: 10 } };
assert.strictEqual(optimizer.hasUsableItemStats(unverified), false);
assert.strictEqual(optimizer.scoreItem(unverified), 0, "item level alone must not produce an optimizer score");
assert.strictEqual(optimizer.findBestItemForSlot([unverified], "Head", optimizer.goals.general), null);
assert.strictEqual(optimizer.findBestItemForSlot([unverified, verified], "Head", optimizer.goals.general).item.id, 2);
assert.deepStrictEqual(optimizer.rankItems([unverified]).length, 0);
const heuristicReport = optimizer.createOptimizationReport({
  character: {
    ...optimizer.createCharacterProfile(),
    className: "Mage",
    specialization: "Frost",
    goal: optimizer.goals.mythicPlus
  },
  availableItems: [verified],
  dataset: { optimizationProfiles: {} }
});
assert.strictEqual(
  heuristicReport.recommendationStatus,
  "heuristic-ranking-not-simulation-validated",
  "fallback ranking must be labelled as a heuristic"
);
assert.strictEqual(heuristicReport.numericProjectionAvailable, false);
assert.strictEqual(
  heuristicReport.optimizationContext.source,
  "Static goal heuristic (not spec-specific simulation)"
);
assert(
  heuristicReport.recommendationLimitations.some(text => text.includes("not specialization-specific")),
  "report must disclose that fallback weights are not specialization-specific"
);

const simulatedReport = optimizer.createOptimizationReport({
  character: {
    ...optimizer.createCharacterProfile(),
    className: "Mage",
    specialization: "Frost",
    simulation: {
      source: "SimulationCraft import",
      method: "scale-factors",
      patch: "test-patch",
      specialization: "Frost Mage",
      generatedAt: "2026-10-10T00:00:00.000Z",
      scaleFactors: { Intellect: 1, Haste: 0.5 }
    }
  },
  availableItems: [verified],
  dataset: {}
});
assert.strictEqual(
  simulatedReport.recommendationStatus,
  "simulation-weighted-ranking-not-full-stat-projection"
);
assert.strictEqual(simulatedReport.numericProjectionAvailable, false);

console.log("Verified stats and fail-closed recommendation tests passed.");
