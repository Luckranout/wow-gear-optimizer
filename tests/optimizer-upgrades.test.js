const fs = require("fs");
const vm = require("vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const o = context.window.WoWOptimizer;

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
