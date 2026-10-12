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
assert.equal(optimizer.scoreItem(catalogItems[0], { Intellect: 1 }), 900, "Blizzard type.name stats should contribute to item score");

const armorCandidates = [
  { id: 21, name: "Mail Headpiece", slot: "Head", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, level: 500, stats: [{ type: { name: "strength" }, value: 1000 }] },
  { id: 22, name: "Plate Helm", slot: "Head", itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }, level: 400, stats: [{ type: { name: "strength" }, value: 10 }] },
  { id: 23, name: "Mail Chest", slot: "Chest", inventoryType: { name: "Chest" }, itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, level: 500, stats: [{ type: { name: "strength" }, value: 1000 }] },
  { id: 24, name: "Plate Chest", slot: "Chest", inventoryType: { name: "Chest" }, itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }, level: 400, stats: [{ type: { name: "strength" }, value: 10 }] }
];
const warriorResult = optimizer.optimizeEquipment({
  items: armorCandidates,
  character: { className: "Warrior", equipment: {} }
});
assert.equal(warriorResult.equipment.Head.id, 22, "plate wearer must not be recommended mail head armor, even if mail scores higher");
assert.equal(warriorResult.equipment.Chest.id, 24, "plate wearer must not be recommended mail chest armor, even if mail scores higher");

const hunterResult = optimizer.optimizeEquipment({
  items: armorCandidates,
  character: { className: "Hunter", equipment: {} }
});
assert.equal(hunterResult.equipment.Head.id, 21, "mail wearer should still be eligible for mail armor");

console.log("Catalog inventory-type slot mapping and class armor eligibility tests passed.");
