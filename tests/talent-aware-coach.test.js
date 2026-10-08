const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("coach.js", "utf8"), context);
const { createCharacterCoach } = context.module.exports;

const coach = createCharacterCoach({
  character: {
    characterName: "Talent Test",
    className: "Warrior",
    specialization: "Fury",
    talents: [{ id: 123, name: "Example Talent", rank: 1 }],
    equipment: {}
  },
  goal: "Mythic+",
  report: {}
});
if (!coach.gameplay.talentAware) throw new Error("Talent-aware state was not detected");
if (!coach.gameplay.talentSummary.includes("1 selected talent")) throw new Error("Talent summary is wrong");
if (!Array.isArray(coach.gameplay.talentAdjustments)) throw new Error("Talent adjustments missing");

const noTalents = createCharacterCoach({
  character: { className: "Warrior", specialization: "Fury", talents: [], equipment: {} },
  report: {}
});
if (noTalents.gameplay.talentAware) throw new Error("Empty talents should not be marked talent-aware");
console.log("Talent-aware coach tests passed.");
