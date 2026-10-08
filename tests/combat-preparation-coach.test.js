const assert = require("assert");
const { createCombatPreparation, createCharacterCoach } = require("../coach");

const prep = createCombatPreparation({
  character: {
    equipment: {
      "Trinket 1": { name: "Example Trinket" },
      "Trinket 2": null
    },
    consumables: { food: "food", flaskOrPhial: "flask", potions: ["potion"] },
    enchants: ["enchant"]
  },
  goal: "Mythic+"
});

assert.ok(prep.food.includes("present"));
assert.ok(prep.flask.includes("present"));
assert.ok(prep.potions.includes("present"));
assert.ok(prep.trinkets.includes("equipped trinkets"));
assert.ok(prep.enchants.includes("present"));
assert.ok(prep.racials.length > 10);
assert.ok(prep.professions.length > 10);

const coach = createCharacterCoach({
  character: { className: "Warrior", specialization: "Fury", equipment: {} },
  report: {},
  goal: "Raid"
});
assert.strictEqual(coach.preparation.content, "Raid");
console.log("Combat preparation coach tests passed.");
