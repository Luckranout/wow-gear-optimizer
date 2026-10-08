const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("coach.js", "utf8"), context);
const { createCharacterCoach } = context.module.exports;

for (const spec of ["Protection", "Fury", "Arms"]) {
  const coach = createCharacterCoach({
    character: { characterName: "Test", className: "Warrior", specialization: spec, equipment: {} },
    goal: "Mythic+",
    report: {}
  });
  if (!coach.gameplay.supported) throw new Error(spec + " should be supported");
  if (!coach.gameplay.beginnerPriority.length) throw new Error(spec + " missing beginner priority");
  if (!coach.gameplay.abilities.primary.length) throw new Error(spec + " missing core abilities");
  if (!coach.gameplay.cooldownGuidance) throw new Error(spec + " missing cooldown guidance");
  if (!coach.gameplay.commonMistakes.length) throw new Error(spec + " missing common mistakes");
  if (!coach.gameplay.preCombat.length) throw new Error(spec + " missing pre-combat checklist");
}
console.log("Gameplay Coach tests passed.");
