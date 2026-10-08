const assert=require("assert");
const fs=require("fs");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
for(const id of ["coachSituationIncoming","coachSituationHealth","coachSituationMovement","coachSituationTarget","coachSituationAoE","coachSituationCooldown","coachSituationResource","coachSituationRange","coachSituationInterrupt","coachSituationNote"]){
 assert.ok(index.includes(`id="${id}"`),`missing ${id}`);
 assert.ok(app.includes(id),`app missing ${id}`);
}
assert.ok(app.includes("coach.situations"));
console.log("Situational gameplay UI tests passed.");
