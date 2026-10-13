const fs = require("fs");
const vm = require("vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const o = context.window.WoWOptimizer;


const fsData = JSON.parse(fs.readFileSync("data/tier-sets-midnight-season-2.json", "utf8"));
const shamanTier = fsData.sets.find(set => set.class === "Shaman");
if (!shamanTier || shamanTier.itemIdsVerified !== true || shamanTier.pieces.length !== 30) {
  throw new Error("Enhancement Shaman tier piece catalogue must verify all five items across six variants");
}
const expectedShamanPieces = [
  [271483, "Head"], [271481, "Shoulders"], [271486, "Chest"],
  [271484, "Hands"], [271482, "Legs"]
];
for (const [itemId, slot] of expectedShamanPieces) {
  const records = shamanTier.pieces.filter(piece => piece.itemId === itemId && piece.slot === slot);
  if (records.length !== 6 || records.some(piece => piece.setId !== shamanTier.id || !piece.sourceUrl)) {
    throw new Error(`Shaman tier item ${itemId} must map to ${slot} across all six variants`);
  }
}
if (fsData.itemMatching.status !== "partial" || !fsData.itemMatching.verifiedClasses.includes("Shaman")) {
  throw new Error("Tier catalogue must report partial verified coverage instead of claiming all classes are complete");
}

const shamanBonusDefinition = {
  id: shamanTier.id,
  setId: shamanTier.id,
  name: shamanTier.setName,
  pieces: shamanTier.pieces,
  thresholds: [
    { pieces: 2, effect: "Enhancement 2-piece verified", scoreValue: null },
    { pieces: 4, effect: "Enhancement 4-piece verified", scoreValue: null }
  ]
};
const equipTierPieces = count => Object.fromEntries(
  expectedShamanPieces.slice(0, count).map(([id, slot]) => [slot, { id, name: shamanTier.pieces.find(p => p.itemId === id).name, slot }])
);
const twoPieceStatus = o.getSetBonusStatus(equipTierPieces(2), [shamanBonusDefinition], "Enhancement");
if (twoPieceStatus.bonuses.find(b => b.requiredPieces === 2)?.active !== true ||
    twoPieceStatus.bonuses.find(b => b.requiredPieces === 4)?.active !== false) {
  throw new Error("Two equipped Shaman tier pieces must activate 2-piece only");
}
const fourPieceStatus = o.getSetBonusStatus(equipTierPieces(4), [shamanBonusDefinition], "Enhancement");
if (fourPieceStatus.bonuses.find(b => b.requiredPieces === 2)?.active !== true ||
    fourPieceStatus.bonuses.find(b => b.requiredPieces === 4)?.active !== true) {
  throw new Error("Four equipped Shaman tier pieces must activate both 2-piece and 4-piece");
}
const fivePieceStatus = o.getSetBonusStatus(equipTierPieces(5), [shamanBonusDefinition], "Enhancement");
if (fivePieceStatus.counts[shamanTier.id] !== 5 ||
    fivePieceStatus.bonuses.find(b => b.requiredPieces === 4)?.active !== true) {
  throw new Error("The fifth Shaman tier piece must remain optional and preserve 4-piece");
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
const expectedSeasonTwoLadders = {
  adventurer: [266, 270, 273, 276, 279, 282],
  veteran: [279, 283, 286, 289, 292, 295],
  champion: [292, 296, 299, 302, 305, 308],
  hero: [305, 309, 312, 315, 318, 321],
  myth: [318, 322, 325, 328, 331, 334]
};
for (const [trackId, expectedLevels] of Object.entries(expectedSeasonTwoLadders)) {
  const track = realSystem.tracks.find(candidate => candidate.id === trackId);
  const actualLevels = track?.rankItemLevels?.map(rank => rank.itemLevel);
  if (JSON.stringify(actualLevels) !== JSON.stringify(expectedLevels)) {
    throw new Error(trackId + " upgrade levels mismatch: " + JSON.stringify(actualLevels));
  }
}
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
// Enhancement Shaman must not fall back to the generic all-stats-equal secondary weights.
const enhancementWeights = o.resolveStatWeights({
  className: "Shaman",
  specialization: "Enhancement",
  goal: "General / All-around"
});
if (!(enhancementWeights.Agility > enhancementWeights.CriticalStrike &&
      enhancementWeights.CriticalStrike === enhancementWeights.Mastery &&
      enhancementWeights.Mastery === enhancementWeights.Haste &&
      enhancementWeights.Haste > enhancementWeights.Versatility)) {
  throw new Error("Enhancement Shaman fallback must prioritize Agility, keep Crit/Mastery/Haste close, and de-prioritize Versatility");
}
const enhancementWithSimulation = o.resolveStatWeights({
  className: "Shaman",
  specialization: "Enhancement",
  simulation: { source: "test simulation", scaleFactors: { Haste: 1.7, Mastery: 1.6 } }
});
if (enhancementWithSimulation.Haste !== 1.7 || enhancementWithSimulation.Mastery !== 1.6) {
  throw new Error("Character-specific simulation weights must override the Enhancement fallback");
}
console.log("Enhancement Shaman stat-priority fallback regression passed.");

console.log("Step 12 simulation scale-factor support passed.");


// Regression: duplicated ring/trinket slot candidates must not recommend the
// same physical item for both copies when distinct alternatives exist.
const pairedItems = [
  { id: 101, name: "Ring Alpha", slot: "Ring 1", itemLevel: 300, stats: { Strength: 10 } },
  { id: 101, name: "Ring Alpha", slot: "Ring 2", itemLevel: 300, stats: { Strength: 10 } },
  { id: 102, name: "Ring Beta", slot: "Ring 1", itemLevel: 290, stats: { Strength: 8 } },
  { id: 102, name: "Ring Beta", slot: "Ring 2", itemLevel: 290, stats: { Strength: 8 } },
  { id: 201, name: "Trinket Alpha", slot: "Trinket 1", itemLevel: 300, stats: { Strength: 10 } },
  { id: 201, name: "Trinket Alpha", slot: "Trinket 2", itemLevel: 300, stats: { Strength: 10 } },
  { id: 202, name: "Trinket Beta", slot: "Trinket 1", itemLevel: 290, stats: { Strength: 8 } },
  { id: 202, name: "Trinket Beta", slot: "Trinket 2", itemLevel: 290, stats: { Strength: 8 } }
];
const pairedResult = o.optimizeEquipment({ items: pairedItems, character: o.createCharacterProfile() }).equipment;
for (const [left, right] of [["Ring 1", "Ring 2"], ["Trinket 1", "Trinket 2"]]) {
  if (!pairedResult[left] || !pairedResult[right] ||
      String(pairedResult[left].id) === String(pairedResult[right].id)) {
    throw new Error(left + " and " + right + " must contain distinct item IDs when alternatives exist");
  }
}
console.log("Distinct paired-slot item regression passed.");

// Regression: live Blizzard stat maps may use lowercase names and nested values.
// Their stats must contribute to the score instead of silently becoming zero.
const lowercaseLiveRing = {
  id: 990001, name: "Live Equipped Ring", slot: "Ring 1", itemLevel: 311,
  stats: { stamina: 1689, haste: 232, versatility: 121 }
};
const lowerRingScore = o.scoreItem(lowercaseLiveRing);
const equivalentCatalogRing = {
  id: 990002, name: "Equivalent Catalog Ring", slot: "Ring 1", itemLevel: 311,
  stats: { Stamina: 1689, Haste: 232, Versatility: 121 }
};
if (Math.abs(lowerRingScore - o.scoreItem(equivalentCatalogRing)) > 0.001) {
  throw new Error("Lowercase imported ring stats must score identically to normalized catalog stats");
}
const lowRing = {
  id: 990003, name: "Low-Level Ring", slot: "Ring 1", itemLevel: 219,
  stats: { stamina: 565, haste: 123, versatility: 35 }
};
const ringReport = o.optimizeEquipment({
  items: [lowRing],
  character: {
    ...o.createCharacterProfile(),
    equipment: { ...o.createCharacterProfile().equipment, "Ring 1": lowercaseLiveRing }
  }
});
if (ringReport.equipment["Ring 1"]?.id !== lowercaseLiveRing.id) {
  throw new Error("Optimizer must not recommend a lower-scoring ilvl 219 ring over the equipped ilvl 311 ring");
}
console.log("Imported stat normalization and lower-level ring regression passed.");

// Regression: the optimizer must retain current equipped gear as a candidate
// when the catalog only offers an unrelated, much lower-item-level target.
const currentHelm = {
  id: 777001, name: "Current High-Level Helm", slot: "Head", itemLevel: 318,
  stats: { Strength: 162, Intellect: 162, Stamina: 3254, CriticalStrike: 116, Mastery: 72 }
};
const lowCatalogHelm = {
  id: 777002, name: "Low-Level Catalog Helm", slot: "Head", itemLevel: 219,
  stats: { Strength: 65, Intellect: 65, Stamina: 1005, CriticalStrike: 32, Haste: 75 }
};
const retainedLoadout = o.optimizeEquipment({
  items: [lowCatalogHelm],
  character: {
    ...o.createCharacterProfile(),
    className: "Warrior",
    specialization: "Protection",
    equipment: { ...o.createCharacterProfile().equipment, Head: currentHelm }
  }
});
if (retainedLoadout.equipment.Head?.id !== currentHelm.id) {
  throw new Error("Optimizer selected an unrelated lower-level catalog item over the equipped helm");
}



// Regression: the catalog's base item record must not replace the character's
// verified upgraded version of that same item in the optimized loadout.
const baseSkullguard = {
  id: 268229, name: "Skullguard of the Risen Sacrifice", slot: "Head",
  itemLevel: 219, itemClass: "Armor", itemSubclass: "Plate",
  stats: { Strength: 100, Stamina: 100 }
};
const equippedSkullguard = {
  id: 268229, name: "Skullguard of the Risen Sacrifice", slot: "Head",
  itemLevel: 334, itemClass: "Armor", itemSubclass: "Plate",
  stats: { Strength: 220, Stamina: 220, CriticalStrike: 120 }
};
const variantReport = o.optimizeEquipment({
  items: [baseSkullguard],
  character: {
    ...o.createCharacterProfile(),
    className: "Warrior",
    specialization: "Protection",
    equipment: { ...o.createCharacterProfile().equipment, Head: equippedSkullguard }
  },
  goal: "mythic+"
});
if (variantReport.equipment.Head?.itemLevel !== 334) {
  throw new Error("Optimizer replaced equipped item variant ilvl 334 with base catalog variant ilvl 219");
}
if (variantReport.equipment.Head?.stats?.CriticalStrike !== 120) {
  throw new Error("Optimizer did not preserve the verified equipped variant's stats");
}


// Regression: set bonuses are counted across the complete loadout and only
// explicitly supplied threshold values affect the optimizer's score.
const tierSetBonuses = [{
  setId: "midnight-tier-test",
  name: "Test Tier Set",
  source: "verified-test-fixture",
  thresholds: [
    { pieces: 2, scoreValue: 80, effect: "Test 2-piece effect" },
    { pieces: 4, scoreValue: 500, effect: "Test 4-piece effect" },
    { pieces: 6, effect: "Unscored test effect must not invent a value" }
  ]
}];
const tierPieces = [
  { id: 920001, name: "Tier Helm", slot: "Head", itemLevel: 300, stats: { Strength: 10 }, set: { id: "midnight-tier-test", name: "Test Tier Set" } },
  { id: 920002, name: "Tier Shoulders", slot: "Shoulders", itemLevel: 300, stats: { Strength: 10 }, set: { id: "midnight-tier-test", name: "Test Tier Set" } },
  { id: 920003, name: "Tier Chest", slot: "Chest", itemLevel: 300, stats: { Strength: 10 }, set: { id: "midnight-tier-test", name: "Test Tier Set" } },
  { id: 920004, name: "Tier Legs", slot: "Legs", itemLevel: 300, stats: { Strength: 10 }, set: { id: "midnight-tier-test", name: "Test Tier Set" } },
  { id: 920005, name: "Higher Item Level Helm", slot: "Head", itemLevel: 400, stats: { Strength: 100 } }
];
const tierStatus = o.getSetBonusStatus({
  Head: tierPieces[0], Shoulders: tierPieces[1], Chest: tierPieces[2], Legs: tierPieces[3]
}, tierSetBonuses);
if (tierStatus.counts["midnight-tier-test"] !== 4 ||
    !tierStatus.bonuses.find(b => b.requiredPieces === 4)?.active ||
    tierStatus.bonuses.find(b => b.requiredPieces === 6)?.scoreValue !== null) {
  throw new Error("Tier set piece counting or unknown-score handling failed");
}
const tierOptimized = o.optimizeEquipment({
  items: tierPieces,
  character: {
    ...o.createCharacterProfile(),
    className: "Warrior",
    specialization: "Arms"
  },
  setBonuses: tierSetBonuses
});
if (tierOptimized.equipment.Head?.name !== "Tier Helm" ||
    !tierOptimized.setBonusStatus.bonuses.find(b => b.requiredPieces === 4)?.active) {
  throw new Error("Optimizer broke a scored 4-piece bonus for an individually higher-scoring helm");
}
if (tierOptimized.setBonusStatus.score !== 580) {
  throw new Error("Tier set score did not sum the explicit active 2-piece and 4-piece values");
}
// Explicit threshold transitions: the fifth eligible piece is optional.
const fifthTierPiece = { id: 920006, name: "Tier Feet", slot: "Feet", itemLevel: 300, stats: { Strength: 10 }, set: { id: "midnight-tier-test", name: "Test Tier Set" } };
const tierLoadouts = [
  { Head: tierPieces[0] },
  { Head: tierPieces[0], Shoulders: tierPieces[1] },
  { Head: tierPieces[0], Shoulders: tierPieces[1], Chest: tierPieces[2] },
  { Head: tierPieces[0], Shoulders: tierPieces[1], Chest: tierPieces[2], Legs: tierPieces[3] },
  { Head: tierPieces[0], Shoulders: tierPieces[1], Chest: tierPieces[2], Legs: tierPieces[3], Feet: fifthTierPiece }
];
const thresholdStates = tierLoadouts.map(loadout => o.getSetBonusStatus(loadout, tierSetBonuses).bonuses);
const isActive = (bonuses, pieces) => bonuses.find(b => b.requiredPieces === pieces)?.active;
if (isActive(thresholdStates[0], 2) !== false || isActive(thresholdStates[0], 4) !== false ||
    isActive(thresholdStates[1], 2) !== true || isActive(thresholdStates[1], 4) !== false ||
    isActive(thresholdStates[2], 2) !== true || isActive(thresholdStates[2], 4) !== false ||
    isActive(thresholdStates[3], 2) !== true || isActive(thresholdStates[3], 4) !== true ||
    isActive(thresholdStates[4], 2) !== true || isActive(thresholdStates[4], 4) !== true) {
  throw new Error("Tier set bonuses must activate at exactly 2 and 4 pieces; the fifth piece must remain optional");
}
console.log("Tier set 1→2, 3→4, and optional fifth-piece threshold regressions passed.");
console.log("Tier set bonus-aware loadout regression passed.");

// Regression: source-backed piece IDs resolve set membership when live item
// records omit their set field; specialization effects remain data-driven and
// no faction/class gate is applied by the counting engine.
const sourceBackedSet = [{
  setId: "all-class-fixture",
  name: "All-class test fixture",
  pieces: [{ itemId: 930001, name: "Piece One" }, { itemId: 930002, name: "Piece Two" }],
  thresholds: [{
    pieces: 2,
    effects: {
      Arms: "Arms-specific test effect",
      Restoration: "Restoration-specific test effect"
    }
  }],
  source: "verified-test-fixture"
}];
const idOnlyLoadout = {
  Head: { id: 930001, name: "Piece One", slot: "Head" },
  Chest: { id: 930002, name: "Piece Two", slot: "Chest" }
};
const armsStatus = o.getSetBonusStatus(idOnlyLoadout, sourceBackedSet, "Arms");
const restoStatus = o.getSetBonusStatus(idOnlyLoadout, sourceBackedSet, "Restoration");
if (armsStatus.counts["all-class-fixture"] !== 2 ||
    armsStatus.bonuses[0]?.active !== true ||
    armsStatus.bonuses[0]?.effect !== "Arms-specific test effect" ||
    restoStatus.bonuses[0]?.effect !== "Restoration-specific test effect") {
  throw new Error("Source-backed set piece IDs or specialization-specific effects failed");
}



// Weapon compatibility regression: Enhancement should not be offered a staff,
// while Elemental may use one. A two-handed mace is a valid main-hand option,
// but must never be paired with an off-hand weapon.
const staff = { id: 910001, name: "Validation Intellect Staff", slot: "Main Hand", inventoryType: "Staff", itemSubclass: "Staff", itemLevel: 219, stats: { Intellect: 288, Stamina: 1005 } };
const oneHandAxe = { id: 910002, name: "Validation One-Hand Axe", slot: "Main Hand", inventoryType: "One-Hand", itemSubclass: "Axe", itemLevel: 295, stats: { Agility: 66, Haste: 53 } };
const offHandAxe = { id: 910003, name: "Validation Off-Hand Axe", slot: "Off Hand", inventoryType: "One-Hand", itemSubclass: "Axe", itemLevel: 295, stats: { Agility: 62, Mastery: 40 } };
const twoHandMace = { id: 910004, name: "Validation Two-Hand Mace", slot: "Main Hand", inventoryType: "Two-Hand", itemSubclass: "Mace", itemLevel: 310, stats: { Agility: 90, Haste: 50 } };
if (o.itemAllowedForSpecialization(staff, "Main Hand", "Shaman", "Enhancement") !== false) {
  throw new Error("Enhancement must not recommend a staff");
}
if (o.itemAllowedForSpecialization(staff, "Main Hand", "Shaman", "Elemental") !== true) {
  throw new Error("Elemental must retain valid staff candidates");
}
if (o.itemAllowedForSpecialization(oneHandAxe, "Main Hand", "Shaman", "Enhancement") !== true ||
    o.itemAllowedForSpecialization(offHandAxe, "Off Hand", "Shaman", "Enhancement") !== true) {
  throw new Error("Enhancement should retain valid one-handed weapon candidates");
}
if (o.itemAllowedForSpecialization(twoHandMace, "Main Hand", "Shaman", "Enhancement") !== true) {
  throw new Error("Enhancement should retain eligible two-handed mace candidates");
}
const enhancementCharacter = o.createCharacterProfile();
enhancementCharacter.className = "Shaman";
enhancementCharacter.specialization = "Enhancement";
enhancementCharacter.equipment["Main Hand"] = { ...oneHandAxe };
enhancementCharacter.equipment["Off Hand"] = { ...offHandAxe };
const weaponResult = o.optimizeEquipment({
  items: [staff, oneHandAxe, offHandAxe, twoHandMace],
  character: enhancementCharacter,
  statWeights: { Agility: 2, Intellect: 0, Stamina: 0, Haste: 1, Mastery: 1 }
});
if (weaponResult.equipment["Main Hand"]?.id === staff.id) {
  throw new Error("Enhancement loadout optimizer selected a staff");
}
if (weaponResult.equipment["Main Hand"]?.id === twoHandMace.id && weaponResult.equipment["Off Hand"]) {
  throw new Error("Optimizer must not combine a two-handed main-hand weapon with an off-hand item");
}


// Class weapon-proficiency regression: class eligibility is independent of spec
// preference. A staff is a Shaman/Mage weapon, but not a Paladin weapon.
const classWeapon = (id, subclass) => ({
  id, name: "Weapon " + subclass, slot: "Main Hand", itemSubclass: subclass,
  inventoryType: subclass === "Staff" ? "Staff" : "One-Hand",
  itemLevel: 300, stats: { Agility: 50, Intellect: 50 }
});
if (!o.itemAllowedForClassWeapon(classWeapon(920001, "Staff"), "Main Hand", "Shaman")) {
  throw new Error("Shaman weapon proficiency should allow staves");
}
if (o.itemAllowedForClassWeapon(classWeapon(920002, "Staff"), "Main Hand", "Paladin")) {
  throw new Error("Paladin weapon proficiency should reject staves");
}
if (!o.itemAllowedForClassWeapon(classWeapon(920003, "Sword"), "Main Hand", "Paladin")) {
  throw new Error("Paladin weapon proficiency should allow swords");
}
if (!o.itemAllowedForClassWeapon(classWeapon(920004, "Warglaive"), "Main Hand", "Demon Hunter")) {
  throw new Error("Demon Hunter weapon proficiency should allow warglaives");
}
if (o.itemAllowedForClassWeapon(classWeapon(920005, "Warglaive"), "Main Hand", "Warrior")) {
  throw new Error("Warrior weapon proficiency should reject warglaives");
}

// Regression: the "Best available gear upgrades" cards must enforce the same
// class/spec weapon rules as the complete-loadout optimizer. The previous
// slot-only scan could surface an Intellect staff for Enhancement Shaman.
const enhancementStaffOnly = {
  id: 980001,
  name: "Venomancer's Winged Channeler",
  slot: "Main Hand",
  inventoryType: "Staff",
  itemSubclass: "Staff",
  itemLevel: 219,
  stats: { Intellect: 288, Stamina: 1005 }
};
const enhancementUpgradeCards = o.findUpgradeOpportunities({
  currentEquipment: {
    "Main Hand": {
      id: 980002, name: "Current Agility Weapon", slot: "Main Hand",
      inventoryType: "One-Hand", itemSubclass: "Axe", itemLevel: 295,
      stats: { Agility: 66, Haste: 53 }
    }
  },
  availableItems: [enhancementStaffOnly],
  goal: o.goals.mythicPlus,
  className: "Shaman",
  specialization: "Enhancement"
});
if (enhancementUpgradeCards.some(upgrade => upgrade.recommendedItem?.id === enhancementStaffOnly.id)) {
  throw new Error("Enhancement upgrade cards must not recommend an Intellect staff");
}
console.log("Class/spec-aware upgrade-card weapon filtering regression passed.");

