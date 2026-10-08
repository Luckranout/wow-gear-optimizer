const assert = require("assert");
const fs = require("fs");
const index = fs.readFileSync("index.html","utf8");
const app = fs.readFileSync("app.js","utf8");
for (const id of ["coachPrepFood","coachPrepFlask","coachPrepPotions","coachPrepTrinkets","coachPrepEnchants","coachPrepRacial","coachPrepProfessions"]) {
  assert.ok(index.includes(`id="${id}"`), `missing ${id}`);
  assert.ok(app.includes(id), `app missing ${id}`);
}
assert.ok(app.includes("coach.preparation"));
console.log("Combat preparation UI tests passed.");
