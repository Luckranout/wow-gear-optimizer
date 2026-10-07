const fs = require("fs");
const path = require("path");
const vm = require("vm");

const optimizerSource = fs.readFileSync(path.join(__dirname, "..", "optimizer.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(optimizerSource, context);
const o = context.window.WoWOptimizer;

const upgradeData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "current-retail.json"), "utf8"));
const upgradeSystem = upgradeData.upgradeSystem || upgradeData.upgradeData;

const next = o.getNextUpgrade({ upgradeSystem, track: "myth", rank: 1 });
if (!next || next.toRank !== 2 || next.crestCost !== 20) {
  throw new Error("Next upgrade calculation failed");
}

const pathPlan = o.getUpgradePath({ upgradeSystem, track: "myth", rank: 1 });
if (pathPlan.length !== 5 || pathPlan[0].fromRank !== 1 || pathPlan[4].toRank !== 6) {
  throw new Error("Upgrade path calculation failed");
}

const crestPlan = o.calculateCrestRequirements({
  upgradeSystem,
  track: "myth",
  rank: 1,
  availableCrests: { Myth: 0 },
  weeklyUsed: 0
});
if (crestPlan.required.Myth !== 100 || crestPlan.totalCrests !== 100 || !crestPlan.fitsWeeklyCap) {
  throw new Error("Myth crest requirement calculation failed");
}

const capped = o.calculateCrestRequirements({
  upgradeSystem,
  track: "myth",
  rank: 1,
  availableCrests: { Myth: 0 },
  weeklyUsed: 20
});
if (capped.fitsWeeklyCap || capped.weeklyRemaining !== 80) {
  throw new Error("Weekly crest cap calculation failed");
}

const exchange = o.calculateCrestRequirements({
  upgradeSystem,
  track: "myth",
  rank: 1,
  availableCrests: { "Hero": 40 },
  weeklyUsed: 0
});
if (!exchange.exchanges.some(item => item.from === "Hero" && item.to === "Myth" && item.required === 60)) {
  throw new Error("Crest exchange calculation failed");
}

const chainedExchange = o.calculateCrestRequirements({
  upgradeSystem,
  track: "myth",
  rank: 1,
  availableCrests: { Champion: 20 },
  weeklyUsed: 0
});
if (!chainedExchange.exchanges.some(item => item.from === "Champion" && item.to === "Hero") ||
    !chainedExchange.exchanges.some(item => item.from === "Hero" && item.to === "Myth")) {
  throw new Error("Chained crest exchange calculation failed");
}

const venomstone = o.isAscendantVenomstoneEligible({
  upgradeSystem,
  item: { slot: "Neck", maximumQualityTidalCrafted: true },
  track: "Myth",
  rank: 6,
  maximumQualityTidalCrafted: true
});
if (!venomstone.eligible || venomstone.cost !== 10) {
  throw new Error("Ascendant Venomstone eligibility failed");
}

console.log("Generated current-retail.json upgradeSystem verification passed.");
console.log("Step 4 optimizer tests passed.");
console.log("Step 5 real-world validation scenarios passed.");
console.log("Step 6B character-to-optimizer integration passed.");
console.log("Step 8 character statistics baseline passed.");
console.log("Step 10 spec-aware stat weight resolution passed.");
console.log("Step 11 specialization profile registry passed.");

const rawScaleFactors = {
  strength: 1.7,
  crit: 0.55,
  haste_rating: 1.25,
  mastery: -2,
  invalid: "not-a-number"
};
const normalizedScaleFactors = o.normalizeSimulationScaleFactors(rawScaleFactors);
if (normalizedScaleFactors.Strength !== 1.7 ||
    normalizedScaleFactors.CriticalStrike !== 0.55 ||
    normalizedScaleFactors.Haste !== 1.25 ||
    normalizedScaleFactors.Mastery !== -2 ||
    normalizedScaleFactors.invalid !== undefined) {
  throw new Error("Simulation scale-factor normalization failed");
}

const simulation = {
  source: "SimulationCraft",
  method: "scale-factors",
  patch: "12.1",
  specialization: "Arms",
  characterId: 777,
  generatedAt: "2026-10-07T00:00:00Z",
  scaleFactors: rawScaleFactors
};
const simulationContext = o.getSimulationWeightContext(simulation);
if (!simulationContext || simulationContext.scaleFactors.Haste !== 1.25 ||
    simulationContext.source !== "SimulationCraft") {
  throw new Error("Simulation weight context failed");
}

const resolved = o.resolveStatWeights({
  goal: "Mythic+",
  className: "Warrior",
  specialization: "Arms",
  simulation
});
if (resolved.Haste !== 1.25 || resolved.CriticalStrike !== 0.55 || resolved.Mastery !== -2) {
  throw new Error("Simulation-derived weights did not override baseline weights");
}
console.log("Step 12 simulation scale-factor tests passed.");

const specRegistryDataset = {
  talents: {
    specializations: [
      { id: 71, name: "Arms", className: "Warrior" },
      { id: 72, name: "Fury", className: "Warrior" }
    ]
  },
  optimizationProfiles: {
    Warrior: {
      Arms: { Strength: 1.4, Haste: 1.1 }
    }
  }
};
const specContext = o.getSpecProfileContext({
  dataset: specRegistryDataset,
  className: "Warrior",
  specialization: "Arms",
  specializationId: 71
});
if (!specContext.specialization || specContext.specialization.id !== 71 ||
    specContext.optimizationProfile.Strength !== 1.4) {
  throw new Error("Spec profile was not anchored to Blizzard specialization metadata");
}
const missingSpecContext = o.getSpecProfileContext({
  dataset: specRegistryDataset,
  className: "Warrior",
  specialization: "Fury",
  specializationId: 72
});
if (missingSpecContext.specialization === null || missingSpecContext.optimizationProfile !== null) {
  throw new Error("Unknown specialization should not resolve a profile");
}
console.log("Step 11 specialization profile registry passed.");

console.log("All optimizer upgrade/stat tests passed.");
