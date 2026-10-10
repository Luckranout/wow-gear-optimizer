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

if (!app.includes("Recommended target") ||
    !app.includes("Currently equipped:") ||
    !app.includes("Target gear • aim to obtain/equip") ||
    !app.includes("No verified candidate available")) {
  throw new Error("Optimized loadout must clearly distinguish target gear from current gear and disclose missing candidates");
}
if (!app.includes('renderOptimizedLoadout(report.optimizedEquipment, report.totalScore, WoWOptimizer.normalizeImportedEquipment(importedCharacter?.equipment || []))')) {
  throw new Error("Optimized loadout must compare recommendations against imported current equipment");
}
if (!html.includes("Recommended target gear for your selected class")) {
  throw new Error("Optimized loadout description must explain its target-build purpose");
}
console.log("Target gear loadout UI regression checks passed.");
