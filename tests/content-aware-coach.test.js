const assert = require("assert");
const { createCharacterCoach, CONTENT_GUIDANCE, getContentGuidance } = require("../coach");

const base = {
  character: { characterName: "Test", className: "Warrior", specialization: "Fury", equipment: {} },
  report: {}
};

for (const goal of ["Mythic+", "Raid", "PvP", "Solo / Open World", "General / All-around"]) {
  const coach = createCharacterCoach({ ...base, goal });
  assert.strictEqual(coach.content.label, goal);
  assert.ok(coach.content.focus.length > 20);
  assert.ok(coach.content.priorities.length >= 3);
  assert.ok(coach.content.defensive.length > 10);
  assert.ok(coach.content.cooldowns.length > 10);
  assert.ok(coach.content.mistakes.length >= 3);
}

assert.notStrictEqual(
  getContentGuidance("Mythic+").focus,
  getContentGuidance("Raid").focus,
  "different PvE goals should produce different content coaching"
);
assert.notStrictEqual(
  getContentGuidance("PvP").focus,
  getContentGuidance("Solo / Open World").focus,
  "PvP and solo coaching should differ"
);
assert.strictEqual(getContentGuidance("unknown").label, "General / All-around");
assert.ok(Object.keys(CONTENT_GUIDANCE).length === 5);

const unsupported = createCharacterCoach({
  character: { characterName: "Test", className: "Mage", specialization: "Frost", equipment: {} },
  report: {},
  goal: "Mythic+"
});
assert.strictEqual(unsupported.gameplay.supported, false);
assert.strictEqual(unsupported.content.label, "Mythic+");
assert.ok(unsupported.content.priorities.length >= 3);

console.log("Content-aware coach tests passed.");
