const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
for (const id of ["coachTalentSummary", "coachTalentAdjustments"]) {
  if (!html.includes('id="' + id + '"')) throw new Error("Missing " + id);
}
if (!app.includes("coach.gameplay.talentSummary")) throw new Error("Talent summary is not rendered");
if (!app.includes("coach.gameplay.talentAdjustments")) throw new Error("Talent adjustments are not rendered");
console.log("Talent-aware UI tests passed.");
