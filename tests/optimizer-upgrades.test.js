const fs = require("fs");
const vm = require("vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const o = context.window.WoWOptimizer;

const sharedRing = {
  id: 990001, name: "Slot mapping regression ring", slot: "Ring 1",
  compatibleSlots: ["Ring 1", "Ring 2"], itemLevel: 300
};
if (o.findBestItemForSlot([sharedRing], "Ring 2", o.goals.general)?.item?.id !== sharedRing.id) {
  throw new Error("A compatible ring must be eligible for both ring slots.");
}
const sharedTrinket = {
  id: 990002, name: "Slot mapping regression trinket", slot: "Trinket 1",
  compatibleSlots: ["Trinket 1", "Trinket 2"], itemLevel: 300
};
if (o.findBestItemForSlot([sharedTrinket], "Trinket 2", o.goals.general)?.item?.id !== sharedTrinket.id) {
  throw new Error("A compatible trinket must be eligible for both trinket slots.");
}
const ring2Upgrade = o.findUpgradeOpportunities({
  currentEquipment: { "Ring 2": { id: 990003, name: "Older Ring", slot: "Ring 2", itemLevel: 100 } },
  availableItems: [sharedRing],
  goal: o.goals.general,
});
const ring2Recommendation = ring2Upgrade.find(upgrade => upgrade.slot === "Ring 2");
if (ring2Recommendation?.recommendedItem?.id !== sharedRing.id) {
  throw new Error("Compatible ring candidates must be considered for upgrade opportunities in both ring slots.");
}

const system = {
  tracks: [
    { id: "hero", name: "Hero", crest: "Hero Mistcrest", maxRank: 6,
      rankItemLevels: [305,308,311,315,318,321].map((itemLevel, i) => ({rank:i+1,itemLevel})),
      crestCostPerUpgrade: 20, weeklyCrestCap: 100 },
    { id: "myth", name: "Myth", crest: "Myth Mistcrest", maxRank: 6,
      rankItemLevels: [318,321,324,328,331,334].map((itemLevel, i) => ({rank:i+1,itemLevel})),
      crestCostPerUpgrade: 20, weeklyCrestCap: 100 }
  ],
  crests: [
    {name:"Hero Mistcrest",track:"Hero"}, {name:"Myth Mistcrest",track:"Myth"}
  ],
  exchangeRules: [{from:"Hero Mistcrest",to:"Myth Mistcrest",ratio:"3:1",requirement:"Hero of the Mist"}],
  ascendantVenomstone: {
    name:"Ascendant Venomstone", cost:10,
    eligibleSlots:["Neck","Trinket 1","Trinket 2","Main Hand","Off Hand"],
    eligibleTracks:["Hero","Myth"], requiresFullyUpgradedTrack:true,
    requiresMaximumQualityTidalCrafted:true
  }
};

let next = o.getNextUpgrade({upgradeSystem:system, track:"Hero", rank:5});
if (next.toRank !== 6 || next.toItemLevel !== 321 || next.crestCost !== 20) throw new Error("Next-upgrade calculation failed");

let path = o.getUpgradePath({upgradeSystem:system, track:"Hero", rank:4});
if (path.length !== 2 || path[0].toItemLevel !== 318 || path[1].toItemLevel !== 321) throw new Error("Upgrade-path calculation failed");

let crest = o.calculateCrestRequirements({upgradeSystem:system, track:"Hero", rank:4, availableCrests:{"Hero Mistcrest":0}, weeklyUsed:60});
if (crest.totalCrests !== 40 || crest.weeklyRemaining !== 40 || !crest.fitsWeeklyCap) throw new Error("Crest calculation failed");

const uncappedSystem = { ...system, weeklyCrestCap: null, tracks: system.tracks.map(track => ({ ...track, weeklyCrestCap: null })) };
const uncapped = o.calculateCrestRequirements({upgradeSystem:uncappedSystem, track:"Hero", rank:4, availableCrests:{"Hero Mistcrest":0}, weeklyUsed:999});
if (uncapped.weeklyCap !== null || uncapped.weeklyRemaining !== null || !uncapped.fitsWeeklyCap) throw new Error("Lifted crest-cap calculation failed");

let exchange = o.calculateCrestRequirements({upgradeSystem:system, track:"Myth", rank:5, availableCrests:{"Myth Mistcrest":0,"Hero Mistcrest":20}});
if (exchange.totalCrests !== 20 || exchange.exchanges[0].required !== 40) throw new Error("Crest exchange calculation failed");

let eligible = o.isAscendantVenomstoneEligible({
  upgradeSystem:system, item:{slot:"Neck"}, track:"Hero", rank:6, maximumQualityTidalCrafted:true
});
if (!eligible.eligible || eligible.cost !== 10) throw new Error("Venomstone eligibility failed");

let ineligible = o.isAscendantVenomstoneEligible({
  upgradeSystem:system, item:{slot:"Head"}, track:"Hero", rank:6, maximumQualityTidalCrafted:true
});
if (ineligible.eligible) throw new Error("Ineligible Venomstone case failed");

const dataset = JSON.parse(fs.readFileSync("data/current-retail.json", "utf8"));
const realSystem = o.getUpgradeSystem(dataset);
if (realSystem.tracks.length !== 5) throw new Error("Generated dataset must contain 5 upgrade tracks");
if (realSystem.crests.length !== 5) throw new Error("Generated dataset must contain 5 crest types");
if (realSystem.exchangeRules.length !== 4) throw new Error("Generated dataset must contain 4 crest exchange rules");
if (!realSystem.ascendantVenomstone || realSystem.ascendantVenomstone.name !== "Ascendant Venomstone") throw new Error("Generated dataset is missing Ascendant Venomstone");
if (!realSystem.tracks.every(track => track.rankItemLevels?.length === 6)) throw new Error("Every upgrade track must contain 6 ranks");
if (!dataset.talents || !Array.isArray(dataset.talents.specializations)) {
  throw new Error("Generated dataset must contain specialization metadata");
}
console.log("Generated current-retail.json upgradeSystem verification passed.");

console.log("Step 4 optimizer tests passed.");


// Step 5: real-world recommendation validation.
const realHero = realSystem.tracks.find(t => t.id === "hero");
const realMyth = realSystem.tracks.find(t => t.id === "myth");
if (!realHero || !realMyth) throw new Error("Real dataset is missing Hero or Myth tracks");

const realHeroPlan = o.recommendUpgradePlan({
  currentItem: { id: 900001, name: "Validation Hero Ring", slot: "Ring 1", track: "Hero", rank: 4 },
  upgradeSystem: realSystem,
  availableCrests: { "Hero Mistcrest": 40 },
  weeklyUsed: 60
});
if (realHeroPlan.nextUpgrade.toRank !== 5 || realHeroPlan.nextUpgrade.toItemLevel !== 318) {
  throw new Error("Real Hero upgrade recommendation is incorrect");
}
if (realHeroPlan.crestPlan.totalCrests !== 40 || !realHeroPlan.crestPlan.fitsWeeklyCap) {
  throw new Error("Real Hero crest plan is incorrect");
}

const realMythPlan = o.recommendUpgradePlan({
  currentItem: { id: 900002, name: "Validation Myth Neck", slot: "Neck", track: "Myth", rank: 6 },
  upgradeSystem: realSystem,
  availableCrests: { "Myth Mistcrest": 0 },
  weeklyUsed: 100,
  maximumQualityTidalCrafted: true
});
if (realMythPlan.nextUpgrade !== null) throw new Error("Max-rank Myth item should have no next upgrade");
if (!realMythPlan.ascendantVenomstone.eligible) throw new Error("Eligible real Myth Venomstone case failed");
if (realMythPlan.crestPlan.totalCrests !== 0 || !realMythPlan.crestPlan.fitsWeeklyCap) throw new Error("Max-rank Myth crest plan should require no crest spend");

const cappedMythPlan = o.recommendUpgradePlan({
  currentItem: { id: 900005, name: "Validation Myth Pending Upgrade", slot: "Neck", track: "Myth", rank: 5 },
  upgradeSystem: realSystem,
  availableCrests: { "Myth Mistcrest": 0 },
  weeklyUsed: 100,
  maximumQualityTidalCrafted: true
});
if (cappedMythPlan.crestPlan.fitsWeeklyCap) throw new Error("Weekly cap should block an additional crest spend at 100 used");

const cappedPlan = o.recommendUpgradePlan({
  currentItem: { id: 900003, name: "Validation Hero Chest", slot: "Chest", track: "Hero", rank: 5 },
  upgradeSystem: realSystem,
  availableCrests: { "Hero Mistcrest": 20 },
  weeklyUsed: 100
});
if (cappedPlan.crestPlan.fitsWeeklyCap) throw new Error("Weekly cap edge case failed");

const invalidVenomstone = o.isAscendantVenomstoneEligible({
  upgradeSystem: realSystem,
  item: { slot: "Head" },
  track: "Hero",
  rank: 6,
  maximumQualityTidalCrafted: true
});
if (invalidVenomstone.eligible || !invalidVenomstone.reasons.includes("Slot is not eligible.")) {
  throw new Error("Real Venomstone invalid-slot validation failed");
}

const exchangedPlan = o.recommendUpgradePlan({
  currentItem: { id: 900004, name: "Validation Myth Weapon", slot: "Main Hand", track: "Myth", rank: 5 },
  upgradeSystem: realSystem,
  availableCrests: { "Myth Mistcrest": 0, "Hero Mistcrest": 20, "Champion Mistcrest": 120 },
  weeklyUsed: 0,
  maximumQualityTidalCrafted: true
});
if (exchangedPlan.crestPlan.exchanges.length !== 1 ||
    exchangedPlan.crestPlan.exchanges[0].from !== "Hero Mistcrest" ||
    exchangedPlan.crestPlan.exchanges[0].to !== "Myth Mistcrest" ||
    exchangedPlan.crestPlan.exchanges[0].required !== 40) {
  throw new Error("Real 3:1 Hero-to-Myth exchange calculation failed");
}

console.log("Step 5 real-world validation scenarios passed.");


// Step 6B: imported character -> optimizer equipment mapping.
const importedCharacter = {
  id: 777,
  name: "IntegrationTest",
  level: 90,
  class: { id: 1, name: "Warrior" },
  activeSpec: { id: 71, name: "Arms" },
  realm: { id: 1, name: "Area 52", slug: "area-52" },
  source: "Blizzard WoW Profile API",
  equipment: [
    { id: 1, name: "Test Helm", slot: "Head", slotType: "HEAD", itemLevel: 318 },
    { id: 2, name: "Test Ring A", slot: "Finger", slotType: "FINGER", itemLevel: 318 },
    { id: 3, name: "Test Ring B", slot: "Finger", slotType: "FINGER", itemLevel: 321 },
    { id: 4, name: "Test Trinket A", slot: "Trinket", slotType: "TRINKET", itemLevel: 318 },
    { id: 5, name: "Test Trinket B", slot: "Trinket", slotType: "TRINKET", itemLevel: 321 },
    { id: 6, name: "Test Weapon", slot: "Main Hand", slotType: "MAIN_HAND", itemLevel: 321 }
  ]
};

const importedProfile = o.createCharacterProfileFromImport({
  importedCharacter,
  goal: o.goals.mythicPlus
});
if (importedProfile.characterName !== "IntegrationTest" ||
    importedProfile.className !== "Warrior" ||
    importedProfile.specialization !== "Arms") {
  throw new Error("Imported character identity mapping failed");
}
if (importedProfile.equipment["Head"]?.name !== "Test Helm") {
  throw new Error("Imported head equipment mapping failed");
}
if (importedProfile.equipment["Ring 1"]?.name !== "Test Ring A" ||
    importedProfile.equipment["Ring 2"]?.name !== "Test Ring B") {
  throw new Error("Imported ring slot mapping failed");
}
if (importedProfile.equipment["Trinket 1"]?.name !== "Test Trinket A" ||
    importedProfile.equipment["Trinket 2"]?.name !== "Test Trinket B") {
  throw new Error("Imported trinket slot mapping failed");
}
if (importedProfile.equipment["Main Hand"]?.name !== "Test Weapon") {
  throw new Error("Imported weapon slot mapping failed");
}
const importedReport = o.createOptimizationReport({
  character: importedProfile,
  availableItems: [],
  dataset
});
if (importedReport.character.characterId !== 777 ||
    importedReport.equipmentSlots !== 16) {
  throw new Error("Imported character optimizer integration failed");
}
console.log("Step 6B character-to-optimizer integration passed.");

// Step 8: character statistics baseline.
const rawStats = {
  strength: 1200,
  agility: 300,
  haste: 25.5,
  critical_strike: 40,
  mastery: 50,
  versatility: 20,
  unknown_stat: 999
};
const normalizedStats = o.normalizeCharacterStatistics(rawStats);
if (normalizedStats.Strength !== 1200 ||
    normalizedStats.Agility !== 300 ||
    normalizedStats.Haste !== 25.5 ||
    normalizedStats.CriticalStrike !== 40 ||
    normalizedStats.Mastery !== 50 ||
    normalizedStats.Versatility !== 20 ||
    normalizedStats.unknown_stat !== 999) {
  throw new Error("Character statistic normalization failed");
}
const statSummary = o.getCharacterStatSummary(rawStats);
if (statSummary.trackedStats.Strength !== 1200 ||
    statSummary.trackedStats.Haste !== 25.5 ||
    statSummary.weightedScore <= 0) {
  throw new Error("Character statistic summary failed");
}

const statsCharacter = {
  ...importedCharacter,
  statistics: rawStats
};
const statsProfile = o.createCharacterProfileFromImport({
  importedCharacter: statsCharacter,
  goal: o.goals.mythicPlus
});
if (statsProfile.statistics.CriticalStrike !== 40) {
  throw new Error("Imported character statistics mapping failed");
}
const statsReport = o.createOptimizationReport({
  character: statsProfile,
  availableItems: [],
  dataset
});
if (statsReport.currentStats.trackedStats.Haste !== 25.5 ||
    statsReport.currentStats.weightedScore <= 0) {
  throw new Error("Optimization report character statistics baseline failed");
}
console.log("Step 8 character statistics baseline passed.");
 
// Step 10: spec-aware stat weight resolution.
// Profiles are supplied as data; the optimizer must never invent a profile when one is absent.
const specProfiles = {
  Warrior: {
    Arms: {
      Strength: 1.4,
      CriticalStrike: 0.6,
      Haste: 1.1,
      Mastery: 0.9,
      Versatility: 0.7
    }
  }
};
const resolvedArmsWeights = o.resolveStatWeights({
  goal: o.goals.mythicPlus,
  className: "Warrior",
  specialization: "Arms",
  statProfiles: specProfiles
});
if (resolvedArmsWeights.Strength !== 1.4 ||
    resolvedArmsWeights.Haste !== 1.1 ||
    resolvedArmsWeights.CriticalStrike !== 0.6) {
  throw new Error("Spec-specific stat weights were not applied");
}

const fallbackWeights = o.resolveStatWeights({
  goal: o.goals.mythicPlus,
  className: "Warrior",
  specialization: "Fury",
  statProfiles: specProfiles
});
const expectedFallback = o.getGoalWeights(o.goals.mythicPlus);
if (fallbackWeights.Haste !== expectedFallback.Haste ||
    fallbackWeights.CriticalStrike !== expectedFallback.CriticalStrike) {
  throw new Error("Missing spec profile did not safely fall back to goal weights");
}

const specCharacter = {
  ...importedProfile,
  className: "Warrior",
  specialization: "Arms",
  goal: o.goals.mythicPlus,
  statistics: { Strength: 100, Haste: 50, CriticalStrike: 25 }
};
const specDataset = {
  ...dataset,
  optimizationProfiles: specProfiles
};
const specReport = o.createOptimizationReport({
  character: specCharacter,
  availableItems: [],
  dataset: specDataset
});
if (specReport.currentStats.weightedScore <= 0) {
  throw new Error("Spec-aware optimization report did not use resolved weights");
}

const specItems = [
  { id: 910001, name: "Strength Ring", slot: "Ring 1", itemLevel: 318, stats: { Strength: 10 } },
  { id: 910002, name: "Haste Ring", slot: "Ring 1", itemLevel: 318, stats: { Haste: 10 } }
];
const bestSpecItem = o.findBestItemForSlot(
  specItems,
  "Ring 1",
  o.goals.mythicPlus,
  resolvedArmsWeights
);
if (bestSpecItem?.item?.name !== "Strength Ring") {
  throw new Error("Spec-specific weights did not affect item selection");
}
console.log("Step 10 spec-aware stat weight resolution passed.");


// Step 11: Blizzard specialization metadata anchors spec profiles.
const specRegistryDataset = {
  talents: {
    specializations: [
      { id: 71, name: "Arms", role: "DAMAGE", primaryStatType: "STRENGTH",
        playableClass: { id: 1, name: "Warrior" }, heroTalentTrees: [{ id: 1001, name: "Slayer" }] }
    ]
  },
  optimizationProfiles: {
    Warrior: {
      Arms: { Strength: 1.4, Haste: 1.1, source: "verified-test-profile" }
    }
  }
};
const specRecord = o.findBlizzardSpecialization(specRegistryDataset, 71, "Arms");
if (!specRecord || specRecord.name !== "Arms" || specRecord.primaryStatType !== "STRENGTH") {
  throw new Error("Blizzard specialization lookup failed");
}
const specContext = o.getSpecProfileContext({
  dataset: specRegistryDataset,
  className: "Warrior",
  specialization: "Arms",
  specializationId: 71
});
if (!specContext.specialization || !specContext.optimizationProfile ||
    specContext.optimizationProfile.Strength !== 1.4) {
  throw new Error("Spec profile was not anchored to Blizzard specialization metadata");
}
const missingSpecContext = o.getSpecProfileContext({
  dataset: specRegistryDataset,
  className: "Warrior",
  specialization: "Fury",
  specializationId: 72
});
if (missingSpecContext.specialization !== null || missingSpecContext.optimizationProfile !== null) {
  throw new Error("Unknown specialization should not resolve a profile");
}
console.log("Step 11 specialization profile registry passed.");


// Step 12: simulation-derived scale factors override static goal/spec weights.
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

const simulationWeights = o.resolveStatWeights({
  goal: o.goals.mythicPlus,
  className: "Warrior",
  specialization: "Arms",
  statProfiles: { Warrior: { Arms: { Strength: 1.4, Haste: 0.4 } } },
  simulation
});
if (simulationWeights.Strength !== 1.7 || simulationWeights.Haste !== 1.25) {
  throw new Error("Simulation-derived weights did not override static profiles");
}

const simulationCharacter = {
  ...importedProfile,
  statistics: { Strength: 100, Haste: 50, CriticalStrike: 20 },
  simulation
};
const simulationReport = o.createOptimizationReport({
  character: simulationCharacter,
  availableItems: [],
  dataset: specDataset
});
if (simulationReport.optimizationContext.source !== "SimulationCraft" ||
    simulationReport.optimizationContext.method !== "scale-factors" ||
    simulationReport.currentStats.weightedScore <= 0) {
  throw new Error("Simulation-derived optimization report context failed");
}
console.log("Step 12 simulation scale-factor support passed.");

const auditedDataset = {
  ...specDataset,
  game: "World of Warcraft",
  mode: "Retail",
  expansion: "Midnight",
  season: 2,
  schemaVersion: "1.0.0",
  source: "Blizzard Game Data API",
  status: "validated",
  updatedAt: "2026-10-08T00:00:00Z",
  items: [
    { id: 8001, name: "Audit Helm", slot: "Head", compatibleSlots: ["Head"], itemLevel: 300 },
    { id: 8002, name: "Audit Helm Alternative", slot: "Head", compatibleSlots: ["Head"], itemLevel: 290 }
  ]
};
const auditReport = o.createOptimizationReport({
  character: { ...o.createCharacterProfile(), className: "Warrior", specialization: "Arms", goal: o.goals.raid },
  availableItems: auditedDataset.items,
  dataset: auditedDataset
});
if (auditReport.verification?.status !== "warnings" ||
    auditReport.verification.dataScope.source !== "Blizzard Game Data API" ||
    auditReport.verification.dataScope.updatedAt !== auditedDataset.updatedAt ||
    auditReport.verification.candidateCountsBySlot.Head !== 2 ||
    auditReport.verification.selectedItemIdsBySlot.Head !== 8001 ||
    !auditReport.verification.warnings.some(warning => warning.includes("heuristic static weights"))) {
  throw new Error("Optimizer verification record must expose source, timestamp, candidate count, selected item, and heuristic limitation.");
}
const repeatAuditReport = o.createOptimizationReport({
  character: { ...o.createCharacterProfile(), className: "Warrior", specialization: "Arms", goal: o.goals.raid },
  availableItems: auditedDataset.items,
  dataset: auditedDataset
});
if (JSON.stringify(auditReport.verification.selectedItemIdsBySlot) !==
    JSON.stringify(repeatAuditReport.verification.selectedItemIdsBySlot) ||
    JSON.stringify(auditReport.verification.candidateCountsBySlot) !==
    JSON.stringify(repeatAuditReport.verification.candidateCountsBySlot)) {
  throw new Error("Identical inputs and dataset must produce the same auditable selections.");
}
const missingMetadataReport = o.createOptimizationReport({
  character: o.createCharacterProfile(),
  availableItems: [],
  dataset: null
});
if (missingMetadataReport.verification.status !== "warnings" ||
    !missingMetadataReport.verification.warnings.some(warning => warning.includes("No dataset metadata"))) {
  throw new Error("Missing dataset metadata must be disclosed, not treated as verified.");
}
console.log("Optimizer verification record tests passed.");
