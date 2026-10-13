const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
if (!app.includes("renderOptimizedLoadout") || !app.includes("report.optimizedEquipment")) {
  throw new Error("Complete loadout renderer is not wired to the optimization report");
}
if (!html.includes('id="loadoutResults"') || !html.includes("Optimized complete loadout")) {
  throw new Error("Complete loadout UI panel is missing");
}
console.log("Step 21 complete loadout UI contract passed.");

if (!app.includes("Recommended target") ||
    !app.includes("Currently equipped") ||
    !app.includes("No verified candidate available")) {
  throw new Error("Optimized loadout must distinguish target gear from current gear and disclose missing candidates");
}
if (!app.includes('renderOptimizedLoadout(report.optimizedEquipment, report.totalScore, WoWOptimizer.normalizeImportedEquipment(importedCharacter?.equipment || []))')) {
  throw new Error("Optimized loadout must compare recommendations against imported current equipment");
}
if (!html.includes("Recommended target gear for your selected class")) {
  throw new Error("Optimized loadout description must explain its target-build purpose");
}
console.log("Target gear loadout UI regression checks passed.");


for (const required of [
  "renderLoadoutItemCard(item, \"Recommended target\"",
  "renderLoadoutItemCard(current, \"Currently equipped\"",
  "Stat changes if equipped",
  "getLoadoutUpgradeReason(item, current, sameItem)",
  "Why this recommendation?",
  "data-item-icon-id",
  "renderLoadoutStatRows(item, current)"
]) {
  if (!app.includes(required)) throw new Error("Loadout comparison missing: " + required);
}
for (const required of [".loadout-compare-pair", ".compare-icon", ".loadout-stat-delta", "@media(max-width:640px)"]) {
  if (!css.includes(required)) throw new Error("Loadout comparison styling missing: " + required);
}
console.log("Side-by-side loadout comparison UI checks passed.");


for (const required of [
  "function normalizeLoadoutStatName(rawName)",
  'criticalstrike: "Critical Strike"',
  "Object.entries(rawStats)",
  "stat?.type?.name"
]) {
  if (!app.includes(required)) throw new Error("Loadout stat normalization missing: " + required);
}
console.log("Loadout stat-name and data-shape normalization checks passed.");


// Execute the actual comparison helpers against Blizzard-array and catalog-object shapes.
const vm = require("node:vm");
const helperStart = app.indexOf("function normalizeLoadoutStatName(rawName)");
const helperEnd = app.indexOf("\nfunction renderLoadoutItemCard", helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error("Could not isolate loadout comparison helpers for runtime tests");
const helperSource = app.slice(helperStart, helperEnd);
const helperContext = { Object, Number, String, Array, escapeSlotText: value => String(value) };
vm.runInNewContext(helperSource + "\nthis.normalizeLoadoutStatName = normalizeLoadoutStatName; this.getLoadoutItemStats = getLoadoutItemStats; this.renderLoadoutStatRows = renderLoadoutStatRows;", helperContext);
if (helperContext.normalizeLoadoutStatName("CriticalStrike") !== "Critical Strike") throw new Error("CriticalStrike must normalize to Critical Strike");
if (helperContext.normalizeLoadoutStatName("critical_strike") !== "Critical Strike") throw new Error("critical_strike must normalize to Critical Strike");
const arrayStats = helperContext.getLoadoutItemStats({stats:[{type:{name:"CriticalStrike"},value:120},{type:{name:"Haste"},value:50}]});
const objectStats = helperContext.getLoadoutItemStats({stats:{"Critical Strike":100,Haste:{value:40}}});
if (arrayStats["Critical Strike"] !== 120 || objectStats["Critical Strike"] !== 100 || arrayStats.Haste !== 50 || objectStats.Haste !== 40) throw new Error("Array/object stat shapes must normalize into comparable values");
const deltaHtml = helperContext.renderLoadoutStatRows({stats:[{type:{name:"CriticalStrike"},value:120}]},{stats:{"Critical Strike":100}});
if (!deltaHtml.includes("+20") || deltaHtml.includes("Comparison incomplete")) throw new Error("Equivalent stat labels must produce numeric target-minus-current delta");
console.log("Loadout comparison runtime regression checks passed.");
