const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const catalogItems = [
  { id: 193765, name: "Blazebound Lieutenant's Helm", inventoryType: { name: "Head" }, level: 400, stats: [{ type: { name: "intellect" }, value: 100 }] },
  { id: 193764, name: "Invader's Firestorm Chestguard", inventoryType: { name: "Chest" }, level: 400, stats: [{ type: { name: "agility" }, value: 100 }] },
  { id: 193763, name: "Fireproof Drape", inventoryType: { name: "Back" }, level: 400, stats: [{ type: { name: "stamina" }, value: 100 }] },
  { id: 10, name: "Verified ring", inventoryType: { name: "Finger" }, level: 400, stats: [{ type: { name: "haste" }, value: 50 }] },
  { id: 11, name: "Verified trinket", inventoryType: { name: "Trinket" }, level: 400, stats: [{ type: { name: "mastery" }, value: 50 }] }
];

const result = optimizer.optimizeEquipment({ items: catalogItems });
assert.equal(result.equipment.Head.id, 193765, "catalog Head inventory type should map to Head slot");
assert.equal(result.equipment.Chest.id, 193764, "catalog Chest inventory type should map to Chest slot");
assert.equal(result.equipment.Back.id, 193763, "catalog Back inventory type should map to Back slot");
assert.ok(result.equipment["Ring 1"] || result.equipment["Ring 2"], "Finger items should map to a ring slot");
assert.ok(result.equipment["Trinket 1"] || result.equipment["Trinket 2"], "Trinket inventory type should map to a trinket slot");
assert.equal(optimizer.scoreItemStats(catalogItems[0], { Intellect: 1 }), 100, "Blizzard type.name stats should be scored");
console.log("Catalog inventory-type slot mapping tests passed.");
