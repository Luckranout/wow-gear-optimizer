const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("coach.js", "utf8"), context);
const { createCharacterCoach } = context.module.exports;
const coach = createCharacterCoach({
  character: { characterName: "Testchar", className: "Warrior", specialization: "Protection", level: 90, realm: "Test Realm", equipment: { Head: { name: "Helm" }, Chest: { name: "Old Chest" } } },
  goal: "Mythic+",
  report: { equipmentSlots: 16, topUpgrades: [{ slot: "Chest", currentItem: { name: "Old Chest" }, recommendedItem: { name: "Better Chest" }, improvement: 12.5 }],
    upgradePlans: [{ slot: "Chest", item: { name: "Old Chest" }, nextUpgrade: { track: "Hero", fromRank: 3, toRank: 4, toItemLevel: 315 }, crestPlan: { required: { "Gilded Mistcrest": 20 }, fitsWeeklyCap: true } }],
    currentStats: { trackedStats: { Strength: 100, Haste: 50 } }, optimizationContext: { source: "Goal/spec baseline" } }
});
if (coach.summary.nextAction !== "Start with Chest: compare your current item with Better Chest.") throw new Error("next action");
if (coach.gearPlan.length !== 1 || coach.gearPlan[0].title !== "Better Chest") throw new Error("gear plan");
if (coach.upgradePlan.length !== 1 || !coach.upgradePlan[0].title.includes("rank 4")) throw new Error("upgrade plan");
if (!coach.strengths.length || !coach.attention.length) throw new Error("assessment");
if (!coach.gameplay.supported || coach.gameplay.priorities.length !== 3) throw new Error("gameplay");
console.log("Personal Action Plan tests passed.");