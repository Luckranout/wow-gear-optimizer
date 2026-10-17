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

test("Death Knight source-checked tier versions preserve observed stats without becoming optimizer candidates", () => {
  const deathKnight = catalogue.sets.find(set => set.class === "Death Knight");
  const observations = deathKnight.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(deathKnight.variantObservationsStatus, "partial");
  assert.match(deathKnight.variantObservationsNote, /not optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Death Knight");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const chest = observations.find(piece => piece.itemId === 271477);
  assert.equal(chest.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(chest.stats.map(stat => [stat.type.name, stat.value])),
    { strength: 189, stamina: 3910, criticalStrike: 59, mastery: 142 }
  );
  const shoulders = observations.find(piece => piece.itemId === 271472);
  assert.equal(shoulders.itemLevel, 308);
  assert.deepEqual(
    Object.fromEntries(shoulders.stats.map(stat => [stat.type.name, stat.value])),
    { strength: 111, stamina: 2172, haste: 44, versatility: 90 }
  );
  assert.equal(deathKnight.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Paladin observed tier variants are source-backed and remain evidence-only", () => {
  const paladin = catalogue.sets.find(set => set.class === "Paladin");
  const observations = paladin.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(paladin.variantObservationsStatus, "partial");
  assert.match(paladin.variantObservationsNote, /not optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Paladin");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const chest = observations.find(piece => piece.itemId === 271468);
  assert.equal(chest.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(chest.stats.map(stat => [stat.type.name, stat.value])),
    { strength: 189, stamina: 3910, haste: 64, mastery: 137 }
  );
  assert.equal(paladin.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Demon Hunter source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const demonHunter = catalogue.sets.find(set => set.class === "Demon Hunter");
  const observations = demonHunter.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(demonHunter.variantObservationsStatus, "partial");
  assert.match(demonHunter.variantObservationsNote, /not a verified upgraded variant/i);
  const manifestSet = manifest.sets.find(set => set.className === "Demon Hunter");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const chest = observations.find(piece => piece.itemId === 271540);
  assert.equal(chest.itemLevel, 321);
  assert.deepEqual(
    Object.fromEntries(chest.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 167, stamina: 3369, haste: 130, versatility: 60 }
  );
  const head = observations.find(piece => piece.itemId === 271537);
  assert.equal(head.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 189, stamina: 3910, criticalStrike: 135, mastery: 66 }
  );
  const gloves = observations.find(piece => piece.itemId === 271538);
  assert.equal(gloves.itemLevel, 219,
    "the known base version must be explicitly recorded as base-only evidence");
  assert.equal(demonHunter.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Druid source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const druid = catalogue.sets.find(set => set.class === "Druid");
  const observations = druid.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(druid.variantObservationsStatus, "partial");
  assert.match(druid.variantObservationsNote, /all observations remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Druid");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const gloves = observations.find(piece => piece.itemId === 271529);
  assert.equal(gloves.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(gloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 141, stamina: 2932, versatility: 106, mastery: 44 }
  );
  const head = observations.find(piece => piece.itemId === 271528);
  assert.equal(head.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 189, stamina: 3910, haste: 142, versatility: 59 }
  );
  const legs = observations.find(piece => piece.itemId === 271527);
  assert.equal(legs.itemLevel, 219,
    "the known base version must be explicitly recorded as base-only evidence");
  assert.equal(druid.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Evoker source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const evoker = catalogue.sets.find(set => set.class === "Evoker");
  const observations = evoker.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(evoker.variantObservationsStatus, "partial");
  assert.match(evoker.variantObservationsNote, /remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Evoker");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 3);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const head = observations.find(piece => piece.itemId === 271501);
  assert.equal(head.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 189, intellect: 189, stamina: 3910, haste: 135, versatility: 66 }
  );
  const gloves = observations.find(piece => piece.itemId === 271502);
  assert.equal(gloves.itemLevel, 321);
  assert.equal(evoker.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Hunter source-checked tier versions remain evidence-only and match exact Wowhead stats", () => {
  const hunter = catalogue.sets.find(set => set.class === "Hunter");
  const observations = hunter.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(hunter.variantObservationsStatus, "partial");
  assert.match(hunter.variantObservationsNote, /remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Hunter");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const chest = observations.find(piece => piece.itemId === 271495);
  assert.equal(chest.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(chest.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 189, stamina: 3910, haste: 64, mastery: 137 }
  );
  const gloves = observations.find(piece => piece.itemId === 271493);
  assert.deepEqual(
    Object.fromEntries(gloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 125, stamina: 2527, haste: 94, versatility: 49 }
  );
  const head = observations.find(piece => piece.itemId === 271492);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 189, stamina: 3910, haste: 143, mastery: 58 }
  );
  const legs = observations.find(piece => piece.itemId === 271491);
  assert.equal(legs.itemLevel, 219,
    "the known base version must be explicitly recorded as base-only evidence");
  assert.deepEqual(
    Object.fromEntries(legs.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 65, stamina: 1005, haste: 38, mastery: 69 }
  );
  const shoulders = observations.find(piece => piece.itemId === 271490);
  assert.deepEqual(
    Object.fromEntries(shoulders.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 141, stamina: 2932, criticalStrike: 52, haste: 98 }
  );
  assert.equal(hunter.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});



test("optimizer coverage distinguishes verified base-piece IDs from unverified variants", () => {
  // optimizer.js attaches its browser API to window at load time.
  global.window = global.window || {};
  require("../optimizer");
  const { getTierSetCoverageStatus } = global.window.WoWOptimizer;
  const deathKnight = getTierSetCoverageStatus(catalogue, "Death Knight", "Blood");
  assert.equal(deathKnight.catalogueStatus, "partial");
  assert.equal(deathKnight.itemMappingVerified, true);
  assert.equal(deathKnight.baseItemMappingVerified, true);
  assert.equal(deathKnight.variantMappingVerified, false);
  assert.equal(deathKnight.verifiedPieceCount, 5);
  assert.equal(deathKnight.expectedPieceCount, 5);
  assert.equal(deathKnight.verifiedClassCount, 1,
    "only Shaman has fully verified variant mappings");
  assert.equal(deathKnight.baseMappingVerifiedClassCount, 13);
  assert.equal(deathKnight.numericScoringAvailable, false);
  assert.ok(deathKnight.limitations.some(note => /base tier-piece IDs are verified/i.test(note)));
  assert.ok(!deathKnight.limitations.some(note => /base tier-piece item mapping is not verified/i.test(note)));

  const shaman = getTierSetCoverageStatus(catalogue, "Shaman", "Enhancement");
  assert.equal(shaman.itemMappingVerified, true);
  assert.equal(shaman.variantMappingVerified, true);
  assert.equal(shaman.verifiedPieceCount, 5);
  assert.equal(shaman.numericScoringAvailable, false);
});


test("tier thresholds can be reported descriptively without inventing numeric bonus scores", () => {
  global.window = global.window || {};
  require("../optimizer");
  const { getSetBonusStatus, scoreSetBonuses } = global.window.WoWOptimizer;
  const setBonuses = [{
    setId: "test-tier-set",
    name: "Test tier set",
    pieces: [
      { itemId: 1001, name: "Test Head" },
      { itemId: 1002, name: "Test Shoulders" },
      { itemId: 1003, name: "Test Chest" },
      { itemId: 1004, name: "Test Hands" },
      { itemId: 1005, name: "Test Legs" }
    ],
    thresholds: [
      { pieces: 2, description: "Descriptive two-piece effect" },
      { pieces: 4, description: "Descriptive four-piece effect" }
    ]
  }];
  const twoPieces = {
    Head: { id: 1001, name: "Test Head" },
    Chest: { id: 1003, name: "Test Chest" }
  };
  const twoPieceStatus = getSetBonusStatus(twoPieces, setBonuses);
  assert.equal(twoPieceStatus.counts["test-tier-set"], 2);
  assert.equal(twoPieceStatus.bonuses.find(bonus => bonus.requiredPieces === 2).active, true);
  assert.equal(twoPieceStatus.bonuses.find(bonus => bonus.requiredPieces === 4).active, false);
  assert.equal(twoPieceStatus.bonuses.find(bonus => bonus.requiredPieces === 2).scoreValue, null);
  assert.equal(scoreSetBonuses(twoPieces, setBonuses).score, 0,
    "descriptive effects must not add score without an explicit verified scoreValue");

  const fourPieces = {
    Head: { id: 1001, name: "Test Head" },
    Shoulders: { id: 1002, name: "Test Shoulders" },
    Chest: { id: 1003, name: "Test Chest" },
    Hands: { id: 1004, name: "Test Hands" }
  };
  const fourPieceStatus = getSetBonusStatus(fourPieces, setBonuses);
  assert.equal(fourPieceStatus.bonuses.find(bonus => bonus.requiredPieces === 2).active, true);
  assert.equal(fourPieceStatus.bonuses.find(bonus => bonus.requiredPieces === 4).active, true);
  assert.equal(scoreSetBonuses(fourPieces, setBonuses).score, 0);
});


test("Rogue source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const rogue = catalogue.sets.find(set => set.class === "Rogue");
  const observations = rogue.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(rogue.variantObservationsStatus, "partial");
  assert.match(rogue.variantObservationsNote, /remain unverified/i);
  const manifestSet = manifest.sets.find(set => set.className === "Rogue");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
      "source URL must pin the exact observed item level");
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const chest = observations.find(piece => piece.itemId === 271513);
  assert.equal(chest.itemLevel, 305);
  assert.deepEqual(
    Object.fromEntries(chest.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 144, intellect: 144, stamina: 2794, haste: 116, versatility: 61 }
  );
  const hands = observations.find(piece => piece.itemId === 271511);
  assert.deepEqual(
    Object.fromEntries(hands.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 125, intellect: 125, stamina: 2527, criticalStrike: 95, mastery: 48 }
  );
  const head = observations.find(piece => piece.itemId === 271510);
  assert.equal(head.itemLevel, 295);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 131, intellect: 131, stamina: 2492, criticalStrike: 56, mastery: 113 }
  );
  const legs = observations.find(piece => piece.itemId === 271509);
  assert.equal(legs.itemLevel, 219,
    "the legs entry is base-only evidence; it must not imply an upgraded version is verified");
  assert.deepEqual(
    Object.fromEntries(legs.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 65, stamina: 1005, criticalStrike: 38, haste: 69 }
  );
  const shoulders = observations.find(piece => piece.itemId === 271508);
  assert.equal(shoulders.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(shoulders.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 141, stamina: 2932, haste: 43, versatility: 107 }
  );
  assert.equal(rogue.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("Mage source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const mage = catalogue.sets.find(set => set.class === "Mage");
  const observations = mage.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(mage.variantObservationsStatus, "partial");
  assert.match(mage.variantObservationsNote, /do not establish coverage/i);
  const manifestSet = manifest.sets.find(set => set.className === "Mage");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.equal(piece.itemLevel, 334);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel);
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    271567: { intellect: 189, stamina: 3910, criticalStrike: 130, haste: 71 },
    271565: { intellect: 141, stamina: 2932, haste: 50, mastery: 101 },
    271564: { intellect: 189, stamina: 3910, haste: 137, mastery: 63 },
    271563: { intellect: 189, stamina: 3910, criticalStrike: 62, versatility: 139 },
    271562: { intellect: 141, stamina: 2932, haste: 107, versatility: 44 }
  };
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[piece.itemId]
    );
  }
  assert.equal(mage.itemIdsVerified, false,
    "observed Mythic versions must not promote the complete class variant map");
});


test("Priest source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const priest = catalogue.sets.find(set => set.class === "Priest");
  const observations = priest.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(priest.variantObservationsStatus, "partial");
  assert.match(priest.variantObservationsNote, /does not establish coverage/i);
  const manifestSet = manifest.sets.find(set => set.className === "Priest");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel);
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    271558: { intellect: 189, stamina: 3910, criticalStrike: 62, mastery: 139 },
    271556: { intellect: 108, stamina: 2096, criticalStrike: 47, mastery: 87 },
    271555: { intellect: 189, stamina: 3910, criticalStrike: 141, mastery: 60 },
    271554: { intellect: 189, stamina: 3910, haste: 143, versatility: 58 },
    271553: { intellect: 141, stamina: 2932, criticalStrike: 101, haste: 49 }
  };
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[piece.itemId]
    );
  }
  assert.equal(observations.find(piece => piece.itemId === 271556).itemLevel, 305);
  assert.equal(priest.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("Warlock source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const warlock = catalogue.sets.find(set => set.class === "Warlock");
  const observations = warlock.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(warlock.variantObservationsStatus, "partial");
  assert.match(warlock.variantObservationsNote, /head is observed only at base item level 219/i);
  const manifestSet = manifest.sets.find(set => set.className === "Warlock");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    const sourceLevel = new URL(piece.sourceUrl).searchParams.get("ilvl");
    if (sourceLevel) assert.equal(Number(sourceLevel), piece.itemLevel);
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    271549: { intellect: 189, stamina: 3910, haste: 141, mastery: 60 },
    271547: { intellect: 138, stamina: 2832, criticalStrike: 44, haste: 105 },
    271546: { intellect: 65, stamina: 1005, versatility: 34, mastery: 73 },
    271545: { intellect: 189, stamina: 3910, haste: 141, mastery: 60 },
    271544: { intellect: 141, stamina: 2932, haste: 50, versatility: 101 }
  };
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[piece.itemId]
    );
  }
  assert.equal(observations.find(piece => piece.itemId === 271546).itemLevel, 219);
  assert.equal(warlock.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("Monk source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const monk = catalogue.sets.find(set => set.class === "Monk");
  const observations = monk.verifiedVariantObservations || [];
  assert.equal(observations.length, 5);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(monk.variantObservationsStatus, "partial");
  assert.match(monk.variantObservationsNote, /legs are observed at Heroic 3\/6 item level 311/i);
  const manifestSet = manifest.sets.find(set => set.className === "Monk");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    const sourceLevel = new URL(piece.sourceUrl).searchParams.get("ilvl");
    if (sourceLevel) assert.equal(Number(sourceLevel), piece.itemLevel);
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    271522: { agility: 189, intellect: 189, stamina: 3910, haste: 62, mastery: 139 },
    271520: { agility: 141, intellect: 141, stamina: 2932, haste: 106, versatility: 45 },
    271519: { agility: 189, intellect: 189, stamina: 3910, criticalStrike: 58, mastery: 142 },
    271518: { agility: 152, intellect: 152, stamina: 3002, criticalStrike: 118, versatility: 65 },
    271517: { agility: 141, intellect: 141, stamina: 2932, haste: 103, mastery: 47 }
  };
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[piece.itemId]
    );
  }
  assert.equal(observations.find(piece => piece.itemId === 271518).itemLevel, 311);
  assert.equal(monk.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("all-class observed tier variants stay separate from eligible optimizer candidates", () => {
  for (const set of catalogue.sets) {
    if (set.class === "Shaman") {
      assert.equal(set.itemIdsVerified, true);
      assert.equal(set.pieces.length, 30);
      assert.equal(set.pieces.filter(piece => piece.candidate === true).length, 20,
        "only the four PvE difficulty variants per slot have verified numeric stats");
      assert.equal(set.pieces.filter(piece => piece.candidate !== true).length, 10,
        "PvP appearance records without verified numeric stats must stay ineligible");
      continue;
    }
    const observations = set.verifiedVariantObservations || [];
    if (observations.length === 0) continue;
    assert.equal(set.itemIdsVerified, false, set.class + " must not imply complete variant mapping");
    assert.equal(set.variantObservationsStatus, "partial", set.class + " must report partial variant coverage");
    assert.deepEqual(
      [...new Set(observations.map(piece => piece.slot))].sort(),
      [...EXPECTED_SLOTS].sort(),
      set.class + " observed versions should span the five tier slots"
    );
    for (const piece of observations) {
      assert.equal(piece.candidate, false, set.class + " observed version leaked into candidates");
      assert.equal(piece.verificationScope, "observed-version-only");
      assert.ok(Number.isInteger(piece.itemLevel) && piece.itemLevel > 0);
      assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
      assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
      assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    }
  }
});
