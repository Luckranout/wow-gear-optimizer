const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("coach.js", "utf8"), context);
const { createCharacterCoach } = context.module.exports;
const coach = createCharacterCoach({
  character: { characterName: "Testchar", className: "Warrior", specialization: "Protection", level: 90, realm: "Test Realm" },
  goal: "Mythic+",
  report: { topUpgrades: [{ slot: "Chest", currentItem: { name: "Old Chest" }, recommendedItem: { name: "Better Chest" }, improvement: 12.5 }] }
});
if (coach.identity.name !== "Testchar") throw new Error("identity");
if (coach.identity.role !== "Tank") throw new Error("role");
if (coach.priorities[0].recommended !== "Better Chest") throw new Error("upgrade");
if (!coach.gameplay.supported || !coach.gameplay.priorities.length) throw new Error("gameplay");
if (!coach.assessment.loop || !coach.assessment.why) throw new Error("explanation");
console.log("Character Coach tests passed.");
