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

const importedProfile = optimizer.createCharacterProfileFromImport({
  importedCharacter: {
    id: 42,
    name: "SimulationIntegration",
    level: 90,
    class: { name: "Warrior" },
    activeSpec: { id: 73, name: "Protection" },
    equipment: [],
    talents: [{ id: 12345, name: "Test talent" }]
  },
  goal: "Mythic+"
});
importedProfile.simulation = contextResult;
const report = optimizer.createOptimizationReport({
  character: importedProfile,
  availableItems: gearCandidates,
  dataset: { optimizationProfiles: {} }
});
if (report.optimizationContext?.source !== "SimulationCraft" ||
    report.statWeights?.Strength !== 0.5 ||
    report.statWeights?.CriticalStrike !== 0.1) {
  throw new Error("Imported character optimization report did not retain and use its attached simulation weights");
}
if (report.character.talents?.[0]?.id !== 12345) {
  throw new Error("Imported character optimization profile did not preserve its selected talent metadata");
}

const appSource = fs.readFileSync("app.js", "utf8");
const htmlSource = fs.readFileSync("index.html", "utf8");
if (!appSource.includes("character.simulation = importedSimulation;") ||
    !appSource.includes("parseSimulationResultJson") ||
    !htmlSource.includes('id="simulationJsonInput"') ||
    !htmlSource.includes('src="simulation-import.js"')) {
  throw new Error("UI simulation import must parse user weights and attach them for imported-character optimization");
}


const noProfileCharacter = optimizer.createCharacterProfileFromImport({
  importedCharacter: {
    id: 43,
    name: "NoProfile",
    level: 90,
    class: { name: "Warrior" },
    activeSpec: { id: 73, name: "Protection" },
    equipment: []
  },
  goal: "Mythic+"
});
const noProfileReport = optimizer.createOptimizationReport({
  character: noProfileCharacter,
  availableItems: gearCandidates,
  dataset: { optimizationProfiles: {} }
});
if (noProfileReport.optimizationProfileStatus !== "missing-specialization-profile" ||
    noProfileReport.recommendationStatus !== "generic-fallback-not-specialization-specific" ||
    !noProfileReport.recommendationLimitations.some(note => note.includes("No verified specialization profile"))) {
  throw new Error("Missing specialization profiles must be reported instead of presented as spec-specific scoring");
}
const caseInsensitiveContext = optimizer.getSpecProfileContext({
  dataset: { optimizationProfiles: { warrior: { protection: { Strength: 1.7 } } } },
  className: "Warrior",
  specialization: "Protection"
});
if (caseInsensitiveContext.optimizationProfile?.Strength !== 1.7) {
  throw new Error("Specialization profile lookup should be case-insensitive");
}
if (!appSource.includes("WARNING: no verified") || !appSource.includes("generic fallback weights used")) {
  throw new Error("UI must clearly warn when generic fallback weights replace missing specialization profiles");
}


const primaryStatEligibility = [
  {
    item: { id: 9101, name: "Agility Sword", slot: "Main Hand", itemLevel: 350, stats: { Agility: 120, Haste: 40 } },
    slot: "Main Hand", className: "Warrior", specialization: "Protection", expected: false
  },
  {
    item: { id: 9102, name: "Intellect Shield", slot: "Off Hand", itemLevel: 350, stats: { Intellect: 120, Mastery: 40 } },
    slot: "Off Hand", className: "Warrior", specialization: "Protection", expected: false
  },
  {
    item: { id: 9103, name: "Strength Shield", slot: "Off Hand", itemLevel: 350, stats: { Strength: 120, Haste: 40 } },
    slot: "Off Hand", className: "Warrior", specialization: "Protection", expected: true
  },
  {
    item: { id: 9104, name: "Agility Axe", slot: "Main Hand", itemLevel: 350, stats: { Agility: 120, Haste: 40 } },
    slot: "Main Hand", className: "Shaman", specialization: "Enhancement", expected: true
  },
  {
    item: { id: 9105, name: "Unknown Primary Stat", slot: "Main Hand", itemLevel: 350, stats: { Haste: 40, Mastery: 40 } },
    slot: "Main Hand", className: "Warrior", specialization: "Protection", expected: true
  }
];
for (const test of primaryStatEligibility) {
  const actual = optimizer.itemAllowedForSpecialization(test.item, test.slot, test.className, test.specialization);
  if (actual !== test.expected) {
    throw new Error(`Primary-stat eligibility failed for ${test.item.name}: expected ${test.expected}, got ${actual}`);
  }
}

const importedWithBuild = optimizer.createCharacterProfileFromImport({
  importedCharacter: {
    id: 77, name: "Testwarrior", realm: { name: "Area 52" },
    class: { name: "Warrior", id: 1 }, activeSpec: { name: "Protection", id: 73 },
    talents: [{ id: 201, name: "Defensive Talent", rank: 1 }],
    talentBuild: {
      source: "Blizzard WoW Profile API", verified: true,
      specializationName: "Protection", selectedNodes: [{ id: 201, rawNodeId: 9001, rank: 1 }],
      selectedNodeCount: 1, loadoutName: "Test build"
    },
    equipment: []
  }
});
if (!importedWithBuild.talentBuild?.verified ||
    importedWithBuild.talentBuild.selectedNodes?.[0]?.rawNodeId !== 9001) {
  throw new Error("Imported active talent build was not passed into the optimizer character profile");
}
console.log("Automatic talent context and primary-stat eligibility tests passed.");


// Regression: an upgraded variant must be expanded before comparing item level.
// Both plate tanks share this path; a low-level base record must not hide its
// verified high-level Mythic+ variant.
for (const tank of [
  { className: "Warrior", specialization: "Protection" },
  { className: "Paladin", specialization: "Protection" }
]) {
  const currentPlateItem = {
    id: 9200, name: "Equipped Plate Helm", slot: "Head", itemLevel: 305,
    stats: { Strength: 80, Haste: 20 }
  };
  const catalogBase = {
    id: 9201, name: "Upgradable Plate Helm", slot: "Head", itemLevel: 219,
    stats: { Strength: 20, Haste: 5 },
    variants: [{
      itemLevel: 340,
      slot: "Head",
      stats: { Strength: 180, Haste: 45, Mastery: 30 }
    }]
  };
  const best = optimizer.findBestItemForSlot(
    [catalogBase], "Head", "Mythic+", null, tank.className, currentPlateItem, tank.specialization
  );
  if (!best || best.item?.itemLevel !== 340) {
    throw new Error(
      `Verified upgraded variant was rejected for Protection ${tank.className}: expected ilvl 340, got ${best?.item?.itemLevel ?? "no candidate"}`
    );
  }
}
console.log("Protection Warrior/Paladin upgraded-variant regression tests passed.");
