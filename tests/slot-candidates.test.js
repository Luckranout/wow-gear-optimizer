const assert = require("node:assert/strict");
const handler = require("../api/slot-candidates");
const { SLOT_SECTION, slotMatches, allowedForClass, normalizeClass } = handler._test;

assert.equal(SLOT_SECTION["Neck"], "necklaces");
assert.equal(SLOT_SECTION["Shoulders"], "shoulders");
assert.equal(SLOT_SECTION["Ring 1"], "rings");
assert.equal(SLOT_SECTION["Trinket 2"], "trinkets");
assert.equal(SLOT_SECTION["Main Hand"], "main-hand");
assert.equal(SLOT_SECTION["Off Hand"], "off-hand");

assert.equal(normalizeClass("Death Knight"), "deathknight");
assert.equal(allowedForClass({
  itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }
}, "Warrior", "Head"), true);
assert.equal(allowedForClass({
  itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" }
}, "Warrior", "Head"), false);
assert.equal(allowedForClass({
  itemClass: { name: "Armor" }, itemSubclass: { name: "Leather" }
}, "Druid", "Chest"), true);
assert.equal(allowedForClass({
  itemClass: { name: "Armor" }, itemSubclass: { name: "Cloth" }
}, "Priest", "Wrists"), true);
assert.equal(allowedForClass({
  itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" }
}, "Mage", "Head"), false);

assert.equal(slotMatches({ inventoryType: { name: "Neck" } }, "Neck"), true);
assert.equal(slotMatches({ inventoryType: { name: "Finger" } }, "Ring 2"), true);
assert.equal(slotMatches({ inventoryType: { name: "Trinket" } }, "Trinket 1"), true);
assert.equal(slotMatches({ slot: "Shoulders" }, "Shoulders"), true);
console.log("On-demand slot candidate API tests passed.");
