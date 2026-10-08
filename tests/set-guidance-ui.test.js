const assert=require("assert");
const fs=require("fs");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
for(const id of ["coachSetLine","coachBonusLine","coachEmbellishmentLine","coachCraftedLine","coachSetRecommendation"]) assert.ok(index.includes(`id="${id}"`),`missing ${id}`);
assert.ok(app.includes("coach.setCrafted"));
console.log("Set guidance UI tests passed.");
