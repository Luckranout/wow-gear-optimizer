// Validate the season tier catalogue is bridged to the verified item-ID manifest.
// Run with: node tests/tier-set-catalogue-bridge.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/tier-set-item-ids.json"), "utf8"));
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data/tier-sets-midnight-season-2.json"), "utf8"));

test("all 13 classes have five manifest-matched tier piece IDs in the season catalogue", () => {
  assert.equal(manifest.sets.length, 13);
  assert.equal(catalogue.sets.length, 13);
  for (const manifestSet of manifest.sets) {
    const catalogueSet = catalogue.sets.find(set => set.class === manifestSet.className);
    assert.ok(catalogueSet, `missing catalogue entry for ${manifestSet.className}`);
    const expected = manifestSet.pieces.map(piece => Number(piece.itemId)).sort((a, b) => a - b);
    const actual = catalogueSet.pieces.map(piece => Number(piece.itemId)).filter(Number.isFinite).sort((a, b) => a - b);
    if (manifestSet.className === "Shaman") {
      assert.equal(catalogueSet.itemIdsVerified, true);
      assert.deepEqual([...new Set(actual)], expected);
    } else {
      assert.equal(catalogueSet.itemIdsVerified, true, `${manifestSet.className} mapping not marked verified`);
      assert.deepEqual(actual, expected, `${manifestSet.className} item IDs differ from the manifest`);
      assert.ok(catalogueSet.pieces.every(piece => piece.candidate === false && !Array.isArray(piece.stats)),
        `${manifestSet.className} metadata-only pieces must not become optimizer candidates without verified stats`);
    }
  }
});

test("catalogue reports ID mapping separately from variant stats and numeric bonus scoring", () => {
  assert.equal(catalogue.itemMatching.status, "partial");
  assert.equal(catalogue.itemMatching.verifiedClasses.length, 13);
  assert.deepEqual(catalogue.itemMatching.statsVerifiedClasses, ["Shaman"]);
  assert.equal(catalogue.sets.every(set => set.numericScoringAvailable !== true), true);
  assert.match(catalogue.scoringPolicy, /Do not assign numeric optimization weights/i);
});
