const assert=require("assert");
const fs=require("fs");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
for(const id of ["encounterSelect","coachEncounterTitle","coachEncounterSummary","coachEncounterMechanics"]) assert.ok(index.includes(`id="${id}"`),`missing ${id}`);
assert.ok(app.includes("retailDataset.encounters"));
assert.ok(app.includes("coach.encounter"));
console.log("Encounter-aware UI tests passed.");
