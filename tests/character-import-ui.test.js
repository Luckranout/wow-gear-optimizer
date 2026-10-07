const assert = require("assert");
const {
  validateImportedCharacter,
  parseImportedCharacterJson,
  formatImportedCharacterSummary,
  formatCharacterStatistics
} = require("../character-import.js");

const valid = {
  id: 123,
  name: "Testchar",
  level: 90,
  realm: { id: 1, name: "Area 52", slug: "area-52" },
  class: { id: 1, name: "Warrior" },
  activeSpec: { id: 71, name: "Arms" },
  statistics: { Strength: 1200, Haste: 25.5, CriticalStrike: 40 },
  equipment: [
    { id: 1, name: "Test Helm", slot: "Head", slotType: "HEAD", itemLevel: 318 }
  ]
};

let result = validateImportedCharacter(valid);
assert.strictEqual(result.valid, true);
assert.strictEqual(result.errors.length, 0);

result = parseImportedCharacterJson(JSON.stringify(valid));
assert.strictEqual(result.valid, true);
assert.strictEqual(result.character.name, "Testchar");

result = parseImportedCharacterJson("{not json}");
assert.strictEqual(result.valid, false);
assert.match(result.errors[0], /valid JSON/);

result = validateImportedCharacter({ ...valid, equipment: {} });
assert.strictEqual(result.valid, false);
assert.match(result.errors[0], /equipment must be an array/);

assert.match(
  formatImportedCharacterSummary(valid),
  /Testchar — Warrior \/ Arms — Area 52 • Level 90 • 1 equipped items/
);

const stats = formatCharacterStatistics(valid.statistics);
assert.deepStrictEqual(stats.map(stat => stat.label), ["Critical Strike", "Haste", "Strength"]);
assert.strictEqual(stats.find(stat => stat.key === "Haste").value, 25.5);

console.log("Step 9 character statistics UI helper tests passed.");
