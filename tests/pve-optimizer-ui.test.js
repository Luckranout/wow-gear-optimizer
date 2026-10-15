const assert = require("node:assert/strict");
const fs = require("node:fs");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
for (const id of [
  "pveOptimizationModel", "statOptimizationSummary", "statOptimizationRules",
  "combatEnhancementSummary", "combatEnhancementResults"
]) {
  assert.ok(index.includes(`id="${id}"`), `missing ${id}`);
}
assert.ok(app.includes("function renderPveOptimizationDetails"), "PvE model renderer should exist");
assert.ok(app.includes("renderPveOptimizationDetails(report)"), "optimizer should render the PvE model report");
assert.ok(app.includes("No verified numeric effect records are available."),
  "unverified consumables must not be presented as scored recommendations");
assert.ok(app.includes("No effects were guessed."), "missing enhancement data should be disclosed");
console.log("PvE optimizer UI tests passed.");
