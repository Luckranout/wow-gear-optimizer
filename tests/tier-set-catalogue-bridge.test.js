// Validate the season tier catalogue is bridged to the verified item-ID manifest.
// Run with: node tests/tier-set-catalogue-bridge.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/tier-set-item-ids.json"), "utf8"));
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data/tier-sets-midnight-season-2.json"), "utf8"));
const STAT_PROFILE_SOURCE = "https://www.method.gg/guides/wow-midnight-season-2-tier-set-stats";
const EXPECTED_SLOTS = ["Head", "Shoulders", "Chest", "Hands", "Legs"];

test("all 13 classes have five manifest-matched tier piece IDs in the season catalogue", () => {
  assert.equal(manifest.sets.length, 13);
  assert.equal(catalogue.sets.length, 13);
  for (const manifestSet of manifest.sets) {
    const catalogueSet = catalogue.sets.find(set => set.class === manifestSet.className);
    assert.ok(catalogueSet, `missing catalogue entry for ${manifestSet.className}`);
    const expected = manifestSet.pieces.map(piece => Number(piece.itemId)).sort((a, b) => a - b);
    const actual = (catalogueSet.pieces || []).map(piece => Number(piece.itemId)).filter(Number.isFinite).sort((a, b) => a - b);
    const baseActual = (catalogueSet.basePieces || []).map(piece => Number(piece.itemId)).filter(Number.isFinite).sort((a, b) => a - b);
    if (manifestSet.className === "Shaman") {
      assert.equal(catalogueSet.itemIdsVerified, true);
      assert.deepEqual([...new Set(actual)], expected);
    } else {
      assert.equal(catalogueSet.itemIdsVerified, false, `${manifestSet.className} variants must remain unverified`);
      assert.equal(catalogueSet.baseItemIdsVerified, true, `${manifestSet.className} base mapping not marked verified`);
      assert.deepEqual(baseActual, expected, `${manifestSet.className} base item IDs differ from the manifest`);
      assert.deepEqual(actual, [], `${manifestSet.className} base-only records must not be treated as verified variants`);
    }
  }
});

test("catalogue reports ID mapping separately from variant stats and numeric bonus scoring", () => {
  assert.equal(catalogue.itemMatching.status, "partial");
  assert.deepEqual(catalogue.itemMatching.verifiedClasses, ["Shaman"]);
  assert.equal(catalogue.itemMatching.baseItemIdsVerifiedClasses.length, 13);
  assert.deepEqual(catalogue.itemMatching.statsVerifiedClasses, ["Shaman"]);
  assert.equal(catalogue.sets.every(set => set.numericScoringAvailable !== true), true);
  assert.match(catalogue.scoringPolicy, /Do not assign numeric optimization weights/i);
});

test("all 13 classes have source-backed secondary-stat profiles without pretending numeric stats are verified", () => {
  assert.deepEqual(catalogue.itemMatching.secondaryStatsProfileVerifiedClasses, manifest.sets.map(set => set.className));
  for (const set of catalogue.sets) {
    const records = set.class === "Shaman" ? set.pieces : set.basePieces;
    assert.equal(records.length, set.class === "Shaman" ? 30 : 5, set.class + " profile record count");
    for (const slot of EXPECTED_SLOTS) {
      const piece = records.find(record => record.slot === slot);
      assert.ok(piece, set.class + " missing " + slot + " stat profile");
      assert.equal(piece.secondaryStatsVerified, true, set.class + " " + slot);
      assert.equal(piece.secondaryStatsSourceUrl, STAT_PROFILE_SOURCE);
      assert.equal(piece.secondaryStats.length, 2);
      assert.ok(piece.secondaryStats.every(stat => ["Critical Strike", "Haste", "Mastery", "Versatility"].includes(stat)));
    }
    if (set.class !== "Shaman") {
      assert.equal(set.itemIdsVerified, false, set.class + " variant mapping must remain unverified");
      assert.ok(records.every(piece => !("itemLevel" in piece) && !("stats" in piece)),
        set.class + " profile metadata must not invent numeric item stats");
    }
  }
});


test("Warrior source-checked variant observations remain evidence-only and preserve same-level stat variants", () => {
  const warrior = catalogue.sets.find(set => set.class === "Warrior");
  const observations = warrior.verifiedVariantObservations || [];
  assert.equal(observations.length, 8);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(warrior.variantObservationsStatus, "partial");
  assert.match(warrior.variantObservationsNote, /not eligible optimizer candidates/i);
  const manifestWarrior = manifest.sets.find(set => set.className === "Warrior");
  const manifestSlotsById = new Map(manifestWarrior.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(manifestSlotsById.get(Number(piece.itemId)), piece.slot,
      "observed item ID must match the manifest slot");
    const levelInUrl = new URL(piece.sourceUrl).searchParams.get("ilvl");
    assert.equal(Number(levelInUrl), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0),
      "each observed stat must retain provenance");
  }
  const gloves = observations.filter(piece => piece.itemId === 271457 && piece.itemLevel === 321);
  assert.equal(gloves.length, 2);
  assert.equal(gloves[0].itemLevel, gloves[1].itemLevel);
  assert.notDeepEqual(
    gloves[0].stats.map(stat => [stat.type.name, stat.value]).sort(),
    gloves[1].stats.map(stat => [stat.type.name, stat.value]).sort()
  );
  assert.equal(warrior.itemIdsVerified, false, "observations must not promote the full class variant map to verified");
});
