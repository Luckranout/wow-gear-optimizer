const assert=require("assert");
const fs=require("fs");
const index=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("app.js","utf8");
for(const id of ["coachSpendNext","coachSpendSteps","coachSpendRule"]) assert.ok(index.includes(`id="${id}"`),`missing ${id}`);
assert.ok(app.includes("coach.spending"));
console.log("Upgrade spending UI tests passed.");
