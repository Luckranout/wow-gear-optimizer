// Regression checks for the verified Midnight Season 2 tier-piece manifest.
// Run with: node --test tests/tier-set-manifest.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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


test("upgrade variants are not silently accepted when stat coverage is incomplete", () => {
  const primaryAndSecondary = new Set([
    "strength", "agility", "intellect", "criticalstrike", "haste", "mastery", "versatility"
  ]);
  const incomplete = [];
  for (const section of sections) {
    for (const item of section.items || []) {
      const baseStats = new Set((item.stats || [])
        .map(stat => normalize(stat.type?.name))
        .filter(name => primaryAndSecondary.has(name)));
      for (const variant of item.variants || []) {
        const variantStats = new Set((variant.stats || [])
          .map(stat => normalize(stat.type?.name))
          .filter(name => primaryAndSecondary.has(name)));
        const missing = [...baseStats].filter(name => !variantStats.has(name));
        if (missing.length) {
          incomplete.push({
            itemId: item.id,
            name: item.name,
            variantLevel: variant.itemLevel ?? variant.level ?? null,
            missingStats: missing
          });
        }
      }
    }
  }
  assert.deepEqual(
    incomplete,
    [],
    "upgrade variants with incomplete primary/secondary stats must be completed from a verified source or explicitly excluded from scoring"
  );
});
