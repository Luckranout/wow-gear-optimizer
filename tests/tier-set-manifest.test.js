// Regression checks for the verified Midnight Season 2 tier-piece manifest.
// Run with: node --test tests/tier-set-manifest.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/tier-set-item-ids.json"), "utf8"));
const sectionNames = [
  "back", "chest", "feet", "hands", "head", "legs", "main-hand",
  "necklaces", "off-hand", "rings", "shoulders", "trinkets", "waist", "wrists"
];
const sections = sectionNames.map(name => JSON.parse(
  fs.readFileSync(path.join(root, "data/equipment-sections", name + ".json"), "utf8")
));
const allItems = sections.flatMap(section => section.items || []);
const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

test("tier manifest has 13 verified class sets with five unique armor slots", () => {
  assert.equal(manifest.sets.length, 13);
  const classes = new Set();
  for (const set of manifest.sets) {
    assert.equal(set.mappingStatus, "verified", set.className);
    assert.ok(!classes.has(set.className), "duplicate class set: " + set.className);
    classes.add(set.className);
    assert.equal(set.pieces.length, 5, set.className);
    assert.deepEqual(
      [...set.pieces].map(piece => piece.slot).sort(),
      ["Chest", "Hands", "Head", "Legs", "Shoulders"].sort(),
      set.className + " tier slots"
    );
    assert.equal(new Set(set.pieces.map(piece => String(piece.itemId))).size, 5, set.className + " item IDs");
  }
});

test("manifest piece IDs resolve to catalog entries in the expected slots", () => {
  const missing = [];
  const wrongSlot = [];
  for (const set of manifest.sets) {
    for (const piece of set.pieces) {
      const matches = allItems.filter(item => String(item.id ?? item.itemId) === String(piece.itemId));
      if (!matches.length) {
        missing.push(set.className + ": " + piece.itemId + " (" + piece.name + ")");
        continue;
      }
      if (!matches.some(item => item.slot === piece.slot ||
        normalize(item.slot) === normalize(piece.slot) ||
        (Array.isArray(item.slots) && item.slots.includes(piece.slot)))) {
        wrongSlot.push(set.className + ": " + piece.itemId + " expected " + piece.slot +
          ", catalog slots " + matches.map(item => item.slot).join(", "));
      }
    }
  }
  assert.deepEqual(missing, [], "tier IDs absent from downloaded equipment sections");
  assert.deepEqual(wrongSlot, [], "tier IDs present but assigned to the wrong slot");
});

test("catalog sections are correctly named and have unique section-local IDs", () => {
  assert.equal(sections.length, 14);
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    assert.equal(section.section, sectionNames[i]);
    assert.ok(Array.isArray(section.items), sectionNames[i] + " items array");
    const ids = section.items.map(item => String(item.id ?? item.itemId));
    assert.equal(new Set(ids).size, ids.length, sectionNames[i] + " duplicate item IDs");
  }
});

test("text-only tier bonus descriptions are never treated as numeric scoring", () => {
  for (const set of manifest.sets) {
    for (const bonus of set.bonuses || []) {
      assert.equal(bonus.scoring, "unmodeled", set.className + " " + bonus.pieces + "-piece");
    }
  }
});


test("every incomplete catalog upgrade variant is rejected by the optimizer guard", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "optimizer.js"), "utf8"),
    sandbox,
    { filename: "optimizer.js" }
  );
  const complete = sandbox.window.WoWOptimizer.hasCompleteVariantStats;
  assert.equal(typeof complete, "function");
  let incompleteCount = 0;

  for (const section of sections) {
    for (const item of section.items || []) {
      for (const variant of item.variants || []) {
        if (complete(item, variant)) continue;
        incompleteCount++;
        assert.equal(
          complete(item, variant),
          false,
          item.id + " " + item.name + " variant " + (variant.itemLevel ?? variant.level)
        );
      }
    }
  }
  assert.ok(incompleteCount > 0, "the current catalog should exercise the incomplete-variant guard");
});

test("optimizer guard requires every primary and secondary stat present on the base item", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "optimizer.js"), "utf8"),
    sandbox,
    { filename: "optimizer.js" }
  );
  const complete = sandbox.window.WoWOptimizer.hasCompleteVariantStats;
  const base = {
    stats: [
      { type: { name: "agility" }, value: 65 },
      { type: { name: "stamina" }, value: 1005 },
      { type: { name: "criticalStrike" }, value: 73 },
      { type: { name: "mastery" }, value: 34 }
    ]
  };
  assert.equal(complete(base, { stats: [
    { type: { name: "armor" }, value: 217 },
    { type: { name: "agility" }, value: 130 },
    { type: { name: "stamina" }, value: 3910 },
    { type: { name: "criticalStrike" }, value: 136 },
    { type: { name: "mastery" }, value: 64 }
  ] }), true);
  assert.equal(complete(base, { stats: [
    { type: { name: "armor" }, value: 217 },
    { type: { name: "stamina" }, value: 3910 },
    { type: { name: "criticalStrike" }, value: 136 },
    { type: { name: "mastery" }, value: 64 }
  ] }), false, "missing primary stat must be rejected");
  assert.equal(complete(base, { stats: [
    { type: { name: "agility" }, value: 130 },
    { type: { name: "stamina" }, value: 3910 },
    { type: { name: "criticalStrike" }, value: 136 }
  ] }), false, "missing secondary stat must be rejected");
});
