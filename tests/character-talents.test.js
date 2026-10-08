const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("server/blizzard-character.js", "utf8"), context);
const { normalizeCharacterTalents } = context.module.exports;
const result = normalizeCharacterTalents({
  specializations: [{
    active: true,
    talents: [
      { id: 101, name: { en_US: "Example Talent" }, rank: 1 },
      { id: 102, name: { en_US: "Second Talent" }, rank: 2 }
    ]
  }]
});
if (result.length !== 2) throw new Error("Expected two talents");
if (result[0].name !== "Example Talent" || result[0].rank !== 1) throw new Error("Talent normalization failed");
console.log("Character talent normalization tests passed.");
