const assert=require("assert");
const {createBuildSynthesis}=require("../coach");
const x=createBuildSynthesis({
 character:{talents:[{id:1,name:"Example"}]},
 report:{optimizationContext:{source:"SimulationCraft"},currentStats:{trackedStats:{Haste:100,CriticalStrike:90}},topUpgrades:[{slot:"Head"}]}
});
assert.ok(x.headline.length>10);
assert.ok(x.talentLine.includes("selected talents"));
assert.ok(x.statLine.includes("SimulationCraft"));
assert.ok(x.statSnapshot.includes("Haste"));
assert.ok(x.gearLine.includes("direct gear upgrades"));
assert.ok(x.next.includes("talent"));
console.log("Build synthesis tests passed.");
