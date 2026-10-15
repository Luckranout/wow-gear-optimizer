const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const profile = {
  source: "verified test fixture",
  verified: true,
  statWeights: { Intellect: 1, Haste: 1, Mastery: 2 },
  softTargets: { Haste: 100 },
  softTargetMultipliers: { Haste: 0 },
  hardCaps: { Intellect: 100 },
  diminishingReturns: {
    Haste: {
      verified: true,
      source: "verified test fixture",
      ratingPerPercent: 10,
      thresholds: [
        { upToPercent: 3, multiplier: 1 },
        { upToPercent: 4, multiplier: 0.9 },
        { upToPercent: 5, multiplier: 0.8 }
      ],
      hardCapPercent: 6
    }
  }
};

assert.equal(optimizer.scoreStatRating("Haste", 50, 1, optimizer.getOptimizationProfileRules(profile)), 47,
  "rating scoring should apply each diminishing-return band");
assert.equal(optimizer.scoreStatRating("Haste", 70, 1, optimizer.getOptimizationProfileRules(profile)), 55,
  "verified hard cap in DR rules should discard rating beyond the cap");
assert.equal(optimizer.scoreStatRating("Intellect", 150, 1, optimizer.getOptimizationProfileRules(profile)), 100,
  "hard caps should exclude rating beyond the profile cap");
const defaultCurve = optimizer.getOptimizationProfileRules({
  source: "verified test profile", verified: true,
  diminishingReturns: {
    Haste: { verified: true, source: "verified rating conversion fixture", ratingPerPercent: 10 }
  }
});
assert.equal(optimizer.scoreStatRating("Haste", 50, 1, defaultCurve), 46.6,
  "verified rating conversions should use the versioned 12.1 secondary-stat DR curve when no custom thresholds are supplied");
const softTargetOnly = optimizer.getOptimizationProfileRules({
  source: "verified test fixture", verified: true,
  softTargets: { Haste: 100 }, softTargetMultipliers: { Haste: 0 }
});
assert.equal(optimizer.scoreStatRating("Haste", 150, 1, softTargetOnly), 100,
  "soft target multiplier should suppress rating value beyond the target");

const character = {
  className: "Mage", specialization: "Fire", goal: "Raid",
  equipment: Object.fromEntries(optimizer.slots.map(slot => [slot, null]))
};
const items = [
  { id: 1, name: "Over-target Haste Helm", slot: "Head", itemLevel: 490, stats: { Haste: 1000 } },
  { id: 2, name: "Balanced Helm", slot: "Head", itemLevel: 500, stats: { Haste: 100 } }
];
const optimized = optimizer.optimizeEquipment({
  items, character, goal: "Raid", statWeights: { Haste: 1 }, optimizationProfile: profile
});
assert.equal(optimized.equipment.Head.id, 2,
  "profile-driven soft targets should change the recommended item when excess Haste has no marginal value");

const dataset = {
  optimizationProfiles: {
    mage: {
      fire: {
        source: "verified fixture profile",
        verified: true,
        statWeights: { Intellect: 1, Mastery: 2 },
        specializationMasteryWeight: 2,
        softTargets: { Mastery: 50 },
        hardCaps: { Intellect: 100 }
      }
    }
  },
  simulation: { source: "SimulationCraft", specialization: "Frost", scaleFactors: { Haste: 100 } },
  items,
  setBonuses: [],
  consumables: {
    food: [
      { id: "active-food", name: "Already Active Food", effectVerified: true, source: "fixture source", stats: { Haste: 50 } },
      { id: "new-food", name: "Better Food", effectVerified: true, source: "fixture source", stats: { Haste: 80 } },
      { id: "unknown-food", name: "Unverified Food", source: "tooltip only", stats: { Haste: 10000 } }
    ],
    flaskOrPhial: [], potions: [], other: []
  },
  buffs: [
    { id: "active-buff", name: "Active Raid Buff", effectVerified: true, source: "fixture source", stats: { Mastery: 10 } },
    { id: "unverified-buff", name: "Unverified Buff", source: "tooltip only", stats: { Mastery: 10000 } }
  ]
};
const report = optimizer.createOptimizationReport({
  character: {
    ...character,
    consumables: { food: "active-food", flaskOrPhial: null, potions: [], other: [] },
    buffs: ["active-buff"]
  },
  availableItems: items,
  dataset
});
assert.equal(report.statOptimization.profileAvailable, true, "case-insensitive class/spec profile lookup should work");
assert.equal(report.statOptimization.specializationMasteryWeight, 2, "spec profile should expose its Mastery weight");
assert.equal(report.optimizationContext.method, "specialization-profile",
  "a simulation for another spec must not be reported as the active weight source");
assert.notEqual(report.statWeights?.Haste, 100, "a mismatched specialization simulation must not override the profile");
const food = report.combatEnhancements.categories.find(group => group.category === "food");
assert.equal(food.activeOption.name, "Already Active Food", "active consumables should be identified");
assert.equal(food.recommendation.name, "Better Food", "already-active food should not be recommended again");
assert.equal(food.verifiedOptions, 2, "unverified tooltip effects must not enter enhancement scoring");
assert.equal(report.combatEnhancements.buffs.length, 1, "unverified buff effects must not enter scoring");
assert.equal(report.combatEnhancements.scoreAddedToGear, false, "consumable effects must not be double-counted in gear score");
assert.ok(report.statOptimization.note.includes("Profile-supplied"), "profile rule disclosure should be explicit");

const noProfile = optimizer.createOptimizationReport({
  character, availableItems: items, dataset: { items, setBonuses: [] }
});
assert.equal(noProfile.statOptimization.applied, false, "no profile should not fabricate caps or DR conversions");
assert.ok(noProfile.statOptimization.note.includes("does not invent"), "missing profile rules should fail closed");

console.log("PvE optimizer profile tests passed.");
