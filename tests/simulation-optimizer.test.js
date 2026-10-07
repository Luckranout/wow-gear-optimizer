const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("optimizer.js", "utf8");
const context = { window: {} };
vm.runInNewContext(source, context);

const optimizer = context.window.WoWOptimizer;

const weights = optimizer.normalizeSimulationScaleFactors({
  Str: 0.5241146953001533,
  Sta: 0.001302633849309427,
  AP: 0.5185370226240442,
  Crit: 0.08993453542203045,
  Haste: 0.08913253576780998,
  Mastery: 0.08082691429506685,
  Vers: 0.07343150499695836,
  Armor: -0.0010908238520395478,
  BonusArmor: -0.00023382356484331738,
  Wdps: 3.1226708231236839
});

if (weights.Strength !== 0.5241146953001533 ||
    weights.Stamina !== 0.001302633849309427 ||
    weights.AttackPower !== 0.5185370226240442 ||
    weights.CriticalStrike !== 0.08993453542203045 ||
    weights.Haste !== 0.08913253576780998 ||
    weights.Mastery !== 0.08082691429506685 ||
    weights.Versatility !== 0.07343150499695836 ||
    weights.Armor !== -0.0010908238520395478 ||
    weights.BonusArmor !== -0.00023382356484331738 ||
    weights.WeaponDPS !== 3.1226708231236839) {
  throw new Error("SimulationCraft stat alias normalization failed");
}

const contextResult = optimizer.getSimulationWeightContext({
  source: "SimulationCraft",
  method: "scale-factors",
  patch: "12.1.0.69933",
  specialization: "Protection Warrior",
  generatedAt: "2026-10-07T03:46:43.000Z",
  scaleFactors: { Str: 0.5, Crit: 0.1 }
});

if (contextResult.scaleFactors.Strength !== 0.5 ||
    contextResult.scaleFactors.CriticalStrike !== 0.1) {
  throw new Error("SimulationCraft context did not normalize stat aliases");
}

const resolved = optimizer.resolveStatWeights({
  goal: "Mythic+",
  className: "Warrior",
  specialization: "Protection",
  simulation: contextResult
});

if (resolved.Strength !== 0.5 || resolved.CriticalStrike !== 0.1) {
  throw new Error("Simulation-derived weights did not override baseline weights");
}

console.log("Step 17 SimulationCraft optimizer mapping passed.");


const simWeights = {
  Strength: 0.1,
  CriticalStrike: 2.0,
  Haste: 0.2,
  Mastery: 0.2,
  Versatility: 0.2
};

const gearCandidates = [
  { id: 1001, name: "Crit Ring", slot: "Ring 1", itemLevel: 318, stats: { CriticalStrike: 20 } },
  { id: 1002, name: "Strength Ring", slot: "Ring 1", itemLevel: 318, stats: { Strength: 20 } }
];

const ranked = optimizer.rankItems(gearCandidates, "Mythic+", simWeights);
if (ranked[0]?.item?.name !== "Crit Ring" || ranked[1]?.item?.name !== "Strength Ring") {
  throw new Error("Simulation-derived weights did not control item ranking");
}

const currentEquipment = {
  "Ring 1": gearCandidates[1]
};
const upgradeResults = optimizer.findUpgradeOpportunities({
  currentEquipment,
  availableItems: gearCandidates,
  goal: "Mythic+",
  statWeights: simWeights,
  limit: 5
});
if (upgradeResults.length !== 1 ||
    upgradeResults[0].recommendedItem.name !== "Crit Ring" ||
    upgradeResults[0].improvement <= 0) {
  throw new Error("Simulation-derived weights did not control upgrade recommendations");
}

console.log("Step 19 SimulationCraft weighted gear ranking passed.");
