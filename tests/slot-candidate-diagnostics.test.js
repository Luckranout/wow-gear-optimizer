const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const items = [
  { id: 1, name: "Valid Mail Shoulders", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] },
  { id: 2, name: "Plate Shoulders", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] },
  { id: 3, name: "Shoulders Without Stats", slot: "Shoulders", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [] },
  { id: 4, name: "Valid Mail Helm", slot: "Head", itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }, itemLevel: 344, stats: [{ type: { name: "haste" }, value: 100 }] }
];

const report = optimizer.diagnoseSlotCandidates(items, "Shoulders", "Shaman");
assert.equal(report.catalogCount, 4);
assert.equal(report.slotMatchCount, 3);
assert.equal(report.classEligibleCount, 2);
assert.equal(report.usableStatsCount, 1);
assert.equal(report.candidates[0].name, "Valid Mail Shoulders");
assert.equal(report.excludedByClass[0].name, "Plate Shoulders");
assert.equal(report.excludedByStats[0].name, "Shoulders Without Stats");
assert.equal(typeof optimizer.diagnoseSlotCandidates, "function");

console.log("Slot candidate diagnostics tests passed.");
