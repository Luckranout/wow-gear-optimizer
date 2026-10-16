const fs = require("fs");
const vm = require("vm");
const context = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync("server/blizzard-character.js", "utf8"), context);
const { normalizeCharacterTalents, normalizeCharacterTalentBuild } = context.module.exports;
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

const build = normalizeCharacterTalentBuild({
  specializations: [{
    active: true,
    specialization: { id: 73, name: { en_US: "Protection" } },
    loadout_name: "Mythic+ Tank",
    talents: [
      { id: 201, name: { en_US: "Defensive Talent" }, rank: 1, node_id: 9001 },
      { id: 202, name: { en_US: "Utility Talent" }, rank: 2, node_id: 9002 }
    ]
  }]
});
if (!build.verified || build.specializationName !== "Protection") {
  throw new Error("Active specialization was not preserved in talent build context");
}
if (build.loadoutName !== "Mythic+ Tank" || build.selectedNodeCount !== 2) {
  throw new Error("Active talent loadout metadata was not preserved");
}
if (build.selectedNodes[0].rawNodeId !== 9001 || build.selectedNodes[1].rank !== 2) {
  throw new Error("Selected talent node information was not preserved");
}
console.log("Active talent build context tests passed.");
