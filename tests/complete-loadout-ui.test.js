const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
if (!app.includes("renderOptimizedLoadout") || !app.includes("report.optimizedEquipment")) {
  throw new Error("Complete loadout renderer is not wired to the optimization report");
}
if (!html.includes('id="loadoutResults"') || !html.includes("Optimized complete loadout")) {
  throw new Error("Complete loadout UI panel is missing");
}
console.log("Step 21 complete loadout UI contract passed.");
