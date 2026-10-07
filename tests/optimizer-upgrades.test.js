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
if (exchange.totalCrests !== 20 || exchange.exchanges[0].required !== 60) throw new Error("Crest exchange calculation failed");

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
