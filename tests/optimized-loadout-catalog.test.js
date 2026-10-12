// Diagnostic regression test: evaluate real catalog coverage after normalization.
// Run with: node tests/optimized-loadout-catalog.test.js
const fs = require("node:fs");
const vm = require("node:vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("wow-data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);

const raw = JSON.parse(fs.readFileSync("data/current-retail.json", "utf8"));
const data = context.window.WoWData.normalizeRetailDataset(raw);
const optimizer = context.window.WoWOptimizer;
const slots = optimizer.slots;
const eligible = data.items.filter(item => optimizer.hasUsableItemStats(item));
const counts = Object.fromEntries(slots.map(slot => [
  slot, eligible.filter(item => item.slot === slot).length
]));
const emptySlots = slots.filter(slot => counts[slot] === 0);

console.log("Raw catalog items:", raw.items?.length ?? 0);
console.log("Normalized gear records:", data.items.length);
console.log("Items with usable numerical stats:", eligible.length);
console.log("Eligible candidates by slot:", JSON.stringify(counts, null, 2));
console.log("Slots with no eligible candidates:", emptySlots.length ? emptySlots.join(", ") : "none");

if (!eligible.length) {
  throw new Error("The catalog contains no optimizer-eligible items with usable numerical stats.");
}
if (eligible.some(item => !slots.includes(item.slot))) {
  throw new Error("At least one eligible catalog item has an unsupported normalized equipment slot.");
}
