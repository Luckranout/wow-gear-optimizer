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
  "renderLoadoutItemCard(sameItem || suppressAsVerifiedUpgrade ? null : item",
  "renderLoadoutItemCard(current, \"Currently equipped\"",
  "Stat changes if equipped",
  "suppressAsVerifiedUpgrade ? \"This comparison is incomplete because verified stats are missing for one or both items. The candidate is not shown as a confirmed upgrade; retain the equipped item until catalog data is repaired.\" : getLoadoutUpgradeReason(item, current, sameItem)",
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

// Live Blizzard character stats may be object maps, unlike catalog stat arrays.
// Ensure the comparison renderer handles both representations.
if (!app.includes('item?.stats && typeof item.stats === "object"') ||
    !app.includes('Object.entries(item.stats)')) {
  throw new Error("Loadout stat comparison must support object-map stats from live character gear");
}
console.log("Live character object-map stat comparison regression passed.");

// The UI should treat a stat absent from one otherwise-valid item as zero,
// so stat tradeoffs are visible instead of mislabeled as incomplete.
const statRowsStart = app.indexOf("function renderLoadoutStatRows");
const statRowsEnd = app.indexOf("function getLoadoutUpgradeReason", statRowsStart);
const statRowsSource = app.slice(statRowsStart, statRowsEnd);
if (!statRowsSource.includes("Object.hasOwn(targetStats, key) ? targetStats[key] : 0") ||
    !statRowsSource.includes("Object.hasOwn(currentStats, key) ? currentStats[key] : 0")) {
  throw new Error("Loadout stat comparison must show zero for a stat absent from one item when both items have stat data");
}
console.log("Missing-item-stat zero-delta comparison regression passed.");



if (!app.includes("Not a verified upgrade: this candidate has a lower displayed item level") ||
    !app.includes("Keep your currently equipped item until a complete, trustworthy comparison is available.")) {
  throw new Error("Lower-level recommendations with incomplete stat comparisons must be marked as unverified");
}
if (!app.includes('critrating: "criticalstrike"') ||
    !app.includes('versatilityrating: "versatility"')) {
  throw new Error("Loadout stat aliases must normalize Blizzard rating keys");
}
console.log("Lower-level safety and stat alias regression checks passed.");
