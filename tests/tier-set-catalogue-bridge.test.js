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
    assert.ok(["www.wowhead.com", "warcraft.wiki.gg"].includes(new URL(piece.sourceUrl).hostname));
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
  assert.equal(observations.length, 17);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(deathKnight.variantObservationsStatus, "partial");
  assert.match(deathKnight.variantObservationsNote, /remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Death Knight");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/") || piece.sourceUrl.startsWith("https://warcraft.wiki.gg/"));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (piece.sourceUrl.startsWith("https://warcraft.wiki.gg/")) {
      assert.ok(piece.stats.every(stat => stat.source.includes(`item level ${piece.itemLevel}`)));
    }
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
  const headLevels = observations.filter(piece => piece.itemId === 271474).map(piece => piece.itemLevel).sort((a, b) => a - b);
  assert.deepEqual(headLevels, [285, 298, 305, 308, 311, 321, 324, 334],
    "Head must retain each independently sourced item-level observation");
  const shoulderLevels = observations.filter(piece => piece.itemId === 271472).map(piece => piece.itemLevel).sort((a, b) => a - b);
  assert.deepEqual(shoulderLevels, [282, 295, 308, 318, 321],
    "Shoulders must retain each independently sourced item-level observation");
  for (const [itemId, itemLevel, expected] of [
    [271474, 285, { strength: 119, stamina: 2219, criticalStrike: 112, mastery: 49 }],
    [271474, 298, { strength: 135, stamina: 2579, criticalStrike: 119, mastery: 53 }],
    [271474, 324, { strength: 172, stamina: 3487, criticalStrike: 134, mastery: 59 }],
    [271472, 282, { strength: 87, stamina: 1606, haste: 39, versatility: 80 }],
    [271472, 321, { strength: 125, stamina: 2527, haste: 47, versatility: 96 }]
  ]) {
    const piece = observations.find(entry => entry.itemId === itemId && entry.itemLevel === itemLevel);
    assert.ok(piece, `expected source-checked Death Knight tier variant at item level ${itemLevel}`);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expected);
  }
  const legs = observations.find(piece => piece.itemId === 271473 && piece.itemLevel === 324);
  assert.equal(legs.variant, "Mythic 3/6 observed");
  assert.deepEqual(
    Object.fromEntries(legs.stats.map(stat => [stat.type.name, stat.value])),
    { strength: 172, stamina: 3487, criticalStrike: 57, mastery: 136 }
  );
  assert.equal(legs.candidate, false);
  assert.equal(deathKnight.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Paladin observed tier variants are source-backed and remain evidence-only", () => {
  const paladin = catalogue.sets.find(set => set.class === "Paladin");
  const observations = paladin.verifiedVariantObservations || [];
  assert.equal(observations.length, 12);
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
  const handsByLevel = new Map(observations.filter(piece => piece.itemId === 271466).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...handsByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321]);
  const expectedHands = {
    282: { strength: 87, stamina: 1606, criticalStrike: 39, mastery: 80 },
    295: { strength: 98, stamina: 1869, criticalStrike: 42, mastery: 86 },
    308: { strength: 111, stamina: 2172, criticalStrike: 44, mastery: 91 },
    321: { strength: 125, stamina: 2527, criticalStrike: 47, mastery: 96 }
  };
  for (const [level, piece] of handsByLevel) {
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expectedHands[level]);
  }
  const shouldersByLevel = new Map(observations.filter(piece => piece.itemId === 271463).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...shouldersByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321, 334]);
  const expectedShoulders = {
    282: { strength: 87, intellect: 87, stamina: 1606, criticalStrike: 83, mastery: 36 },
    295: { strength: 98, intellect: 98, stamina: 1869, criticalStrike: 89, mastery: 38 },
    308: { strength: 111, intellect: 111, stamina: 2172, criticalStrike: 94, mastery: 41 },
    321: { strength: 125, intellect: 125, stamina: 2527, criticalStrike: 100, mastery: 43 },
    334: { strength: 141, stamina: 2932, haste: 95, mastery: 56 }
  };
  for (const [level, piece] of shouldersByLevel) {
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expectedShoulders[level]);
  }
  assert.equal(paladin.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Demon Hunter source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const demonHunter = catalogue.sets.find(set => set.class === "Demon Hunter");
  const observations = demonHunter.verifiedVariantObservations || [];
  assert.equal(observations.length, 16);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(demonHunter.variantObservationsStatus, "partial");
  assert.match(demonHunter.variantObservationsNote, /Hands at base item level 219, Veteran 2\/6 item level 282, Champion 2\/6 item level 295, Hero 1\/6 item level 305, Hero 2\/6 item level 308, and Myth 2\/6 item level 321/i);
  assert.match(demonHunter.variantObservationsNote, /Legs are observed at item levels 285, 295, 298, 311, 318, and 324/i);
  const manifestSet = manifest.sets.find(set => set.className === "Demon Hunter");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    const sourceUrl = new URL(piece.sourceUrl);
    assert.ok(
      sourceUrl.hostname === "www.wowhead.com" || sourceUrl.hostname === "warcraft.wiki.gg",
      "source URL must point to a trusted item reference"
    );
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (sourceUrl.hostname === "www.wowhead.com") {
      assert.equal(Number(sourceUrl.searchParams.get("ilvl")), piece.itemLevel,
        "Wowhead source URL must pin the exact observed item level");
    } else {
      assert.ok(piece.stats.every(stat => stat.source.includes(String(piece.itemLevel))),
        "Warcraft Wiki observations must label the exact observed item level in every stat source");
    }
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const raidFinderGloves = observations.find(piece => piece.itemId === 271538 && piece.itemLevel === 282);
  assert.equal(raidFinderGloves.variant, "Veteran 2/6 observed");
  assert.equal(raidFinderGloves.candidate, false);
  assert.deepEqual(
    Object.fromEntries(raidFinderGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 87, stamina: 1606, criticalStrike: 82, mastery: 37 }
  );
  for (const expected of [
    { level: 285, stats: { agility: 119, stamina: 2219, criticalStrike: 50, mastery: 111 } },
    { level: 298, stats: { agility: 135, stamina: 2579, criticalStrike: 53, mastery: 119 } },
    { level: 324, stats: { agility: 172, stamina: 3487, criticalStrike: 60, mastery: 133 } },
  ]) {
    const item = observations.find(piece => piece.slot === "Legs" && piece.itemLevel === expected.level);
    assert.ok(item, `missing Demon Hunter leg observation at item level ${expected.level}`);
    assert.equal(item.candidate, false);
    assert.equal(item.verificationScope, "observed-version-only");
    assert.match(item.sourceUrl, /warcraft\.wiki\.gg/);
    assert.deepEqual(
      Object.fromEntries(item.stats.map(stat => [stat.type.name, stat.value])),
      expected.stats
    );
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
  const veteranHead = observations.find(piece => piece.itemId === 271537 && piece.itemLevel === 285);
  assert.equal(veteranHead.variant, "Veteran 3/6 observed");
  assert.equal(veteranHead.candidate, false);
  assert.equal(veteranHead.verificationScope, "observed-version-only");
  assert.match(veteranHead.sourceUrl, /warcraft\.wiki\.gg/);
  assert.deepEqual(
    Object.fromEntries(veteranHead.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 119, stamina: 2219, criticalStrike: 108, mastery: 53 }
  );
  const gloves = observations.find(piece => piece.itemId === 271538);
  assert.equal(gloves.itemLevel, 219,
    "the known base version must be explicitly recorded as base-only evidence");
  const upgradedGloves = observations.find(piece => piece.itemId === 271538 && piece.itemLevel === 305);
  assert.deepEqual(
    Object.fromEntries(upgradedGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 108, stamina: 2096, criticalStrike: 92, mastery: 42 }
  );
  const heroicGloves = observations.find(piece => piece.itemId === 271538 && piece.itemLevel === 308);
  assert.deepEqual(
    Object.fromEntries(heroicGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 111, stamina: 2172, criticalStrike: 93, mastery: 42 }
  );
  const mythicGloves = observations.find(piece => piece.itemId === 271538 && piece.itemLevel === 321);
  const championGloves = observations.find(piece => piece.itemId === 271538 && piece.itemLevel === 295);
  assert.deepEqual(
    Object.fromEntries(mythicGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 125, stamina: 2527, criticalStrike: 98, mastery: 45 }
  );
  assert.equal(championGloves.variant, "Champion 2/6 observed");
  assert.equal(championGloves.candidate, false);
  assert.deepEqual(Object.fromEntries(championGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 98, stamina: 1869, criticalStrike: 87, mastery: 40 });
  const legs = observations.filter(piece => piece.itemId === 271536).sort((a, b) => a.itemLevel - b.itemLevel);
  assert.deepEqual(legs.map(piece => piece.itemLevel), [285, 295, 298, 311, 318, 324]);
  assert.deepEqual(
    Object.fromEntries(legs.find(piece => piece.itemLevel === 318).stats.map(stat => [stat.type.name, stat.value])),
    { agility: 162, stamina: 3254, criticalStrike: 58, mastery: 130 }
  );
  assert.equal(demonHunter.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Druid source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const druid = catalogue.sets.find(set => set.class === "Druid");
  const observations = druid.verifiedVariantObservations || [];
  assert.equal(observations.length, 14);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(druid.variantObservationsStatus, "partial");
  assert.match(druid.variantObservationsNote, /all observations remain ineligible as optimizer candidates/i);
  const legsByLevel = new Map(observations.filter(piece => piece.slot === "Legs").map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...legsByLevel.keys()].sort((a, b) => a - b), [219, 285, 298, 311, 324]);
  for (const [level, expected] of [
    [285, { agility: 119, stamina: 2219, criticalStrike: 54, haste: 108 }],
    [298, { agility: 135, stamina: 2579, criticalStrike: 57, haste: 115 }],
    [311, { agility: 152, stamina: 3002, criticalStrike: 61, haste: 122 }],
    [324, { agility: 172, stamina: 3487, criticalStrike: 64, haste: 129 }]
  ]) {
    const piece = legsByLevel.get(level);
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expected);
  }
  const manifestSet = manifest.sets.find(set => set.className === "Druid");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    const sourceUrl = new URL(piece.sourceUrl);
    assert.ok(
      sourceUrl.hostname === "www.wowhead.com" || sourceUrl.hostname === "warcraft.wiki.gg",
      "source URL must point to a trusted item reference"
    );
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (sourceUrl.hostname === "www.wowhead.com") {
      assert.equal(Number(sourceUrl.searchParams.get("ilvl")), piece.itemLevel,
        "Wowhead source URL must pin the exact observed item level");
    } else {
      assert.ok(piece.stats.every(stat => stat.source.includes(String(piece.itemLevel))),
        "Warcraft Wiki observations must label the exact observed item level in every stat source");
    }
    assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    assert.ok(piece.stats.every(stat => typeof stat.source === "string" && stat.source.length > 0));
  }
  const championGloves = observations.find(piece => piece.itemId === 271529 && piece.itemLevel === 295);
  assert.equal(championGloves.variant, "Champion 2/6");
  assert.equal(Number(new URL(championGloves.sourceUrl).searchParams.get("ilvl")), 295);
  assert.deepEqual(
    Object.fromEntries(championGloves.stats.map(stat => [stat.type.name, stat.value])),
    { intellect: 98, agility: 98, stamina: 1869, versatility: 90, mastery: 37 }
  );
  const heroGloves = observations.find(piece => piece.itemId === 271529 && piece.itemLevel === 321);
  assert.equal(heroGloves.variant, "Hero 6/6");
  assert.equal(Number(new URL(heroGloves.sourceUrl).searchParams.get("ilvl")), 321);
  assert.deepEqual(
    Object.fromEntries(heroGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 125, intellect: 125, stamina: 2527, versatility: 101, mastery: 42 }
  );
  const gloves = observations.find(piece => piece.itemId === 271529);
  assert.equal(gloves.itemLevel, 334);
  assert.deepEqual(
    Object.fromEntries(gloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 141, stamina: 2932, versatility: 106, mastery: 44 }
  );
  const headVariants = new Map(observations.filter(piece => piece.itemId === 271528).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...headVariants.keys()].sort((a, b) => a - b), [285, 298, 311, 324, 334]);
  for (const [level, expected] of [
    [285, { agility: 119, stamina: 2219, haste: 114, versatility: 47 }],
    [298, { agility: 135, stamina: 2579, haste: 121, versatility: 51 }],
    [311, { agility: 152, stamina: 3002, haste: 129, versatility: 54 }],
    [324, { agility: 172, stamina: 3487, haste: 136, versatility: 57 }],
    [334, { agility: 189, stamina: 3910, haste: 142, versatility: 59 }]
  ]) {
    const piece = headVariants.get(level);
    assert.ok(piece, `missing Druid head observation at item level ${level}`);
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expected);
  }
  const legs = observations.find(piece => piece.itemId === 271527);
  assert.equal(legs.itemLevel, 219,
    "the known base version must be explicitly recorded as base-only evidence");
  assert.equal(druid.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Evoker source-checked tier versions remain evidence-only and preserve observed stats", () => {
  const evoker = catalogue.sets.find(set => set.class === "Evoker");
  const observations = evoker.verifiedVariantObservations || [];
  assert.equal(observations.length, 12);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(evoker.variantObservationsStatus, "partial");
  assert.match(evoker.variantObservationsNote, /remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Evoker");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    const sourceUrl = new URL(piece.sourceUrl);
    assert.ok(
      sourceUrl.hostname === "www.wowhead.com" || sourceUrl.hostname === "warcraft.wiki.gg",
      "source URL must point to a trusted item reference"
    );
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (sourceUrl.hostname === "www.wowhead.com") {
      assert.equal(Number(sourceUrl.searchParams.get("ilvl")), piece.itemLevel,
        "Wowhead source URL must pin the exact observed item level");
    } else {
      assert.ok(piece.stats.every(stat => stat.source.includes(String(piece.itemLevel))),
        "Warcraft Wiki observations must label the exact observed item level in every stat source");
    }
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
  const glovesByLevel = new Map(observations.filter(piece => piece.itemId === 271502).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...glovesByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321]);
  const expectedGloves = {
    282: { intellect: 87, stamina: 1606, haste: 77, mastery: 42 },
    295: { intellect: 98, stamina: 1869, haste: 82, mastery: 45 },
    308: { intellect: 111, stamina: 2172, haste: 87, mastery: 48 },
    321: { agility: 125, intellect: 125, stamina: 2527, haste: 92, mastery: 51 }
  };
  for (const [level, piece] of glovesByLevel) {
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expectedGloves[level]);
  }
  const shouldersByLevel = new Map(observations.filter(piece => piece.itemId === 271499).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...shouldersByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321, 334]);
  const expectedShoulders = {
    282: { intellect: 87, stamina: 1606, criticalStrike: 82, versatility: 37 },
    295: { intellect: 98, stamina: 1869, criticalStrike: 88, versatility: 39 },
    308: { intellect: 111, stamina: 2172, criticalStrike: 93, versatility: 42 },
    321: { intellect: 125, stamina: 2527, criticalStrike: 99, versatility: 44 },
    334: { agility: 141, intellect: 141, stamina: 2932, criticalStrike: 104, versatility: 46 }
  };
  for (const [level, piece] of shouldersByLevel) {
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expectedShoulders[level]);
  }
  assert.equal(evoker.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});

test("Hunter source-checked tier versions remain evidence-only and match exact Wowhead stats", () => {
  const hunter = catalogue.sets.find(set => set.class === "Hunter");
  const observations = hunter.verifiedVariantObservations || [];
  assert.equal(observations.length, 13);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(hunter.variantObservationsStatus, "partial");
  assert.match(hunter.variantObservationsNote, /remain ineligible as optimizer candidates/i);
  const manifestSet = manifest.sets.find(set => set.className === "Hunter");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(["www.wowhead.com", "warcraft.wiki.gg"].includes(new URL(piece.sourceUrl).hostname));
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (new URL(piece.sourceUrl).hostname === "www.wowhead.com") {
      assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
        "Wowhead source URL must pin the exact observed item level");
    } else {
      assert.ok(piece.stats.every(stat => stat.source.includes(String(piece.itemLevel))),
        "Warcraft Wiki observations must label the exact observed item level in every stat source");
    }
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
  const championGloves = observations.find(piece => piece.itemId === 271493 && piece.itemLevel === 295);
  assert.equal(championGloves.variant, "Champion item level observed");
  assert.deepEqual(
    Object.fromEntries(championGloves.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 98, intellect: 98, stamina: 1869, haste: 83, versatility: 44 }
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
  const lfrLegs = observations.find(piece => piece.itemId === 271491 && piece.itemLevel === 285);
  assert.equal(lfrLegs.variant, "Veteran 3/6 observed");
  assert.deepEqual(
    Object.fromEntries(lfrLegs.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 119, stamina: 2219, haste: 57, mastery: 105 }
  );
  const normalLegs = observations.find(piece => piece.itemId === 271491 && piece.itemLevel === 298);
  assert.equal(normalLegs.variant, "Champion 3/6 observed");
  assert.deepEqual(
    Object.fromEntries(normalLegs.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 135, stamina: 2579, haste: 60, mastery: 112 }
  );
  const upgradedLegs = observations.find(piece => piece.itemId === 271491 && piece.itemLevel === 308);
  assert.equal(upgradedLegs.variant, "Heroic item level observed");
  assert.deepEqual(
    Object.fromEntries(upgradedLegs.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 148, intellect: 148, stamina: 2896, haste: 63, mastery: 117 }
  );
  const legs = observations.find(piece => piece.itemId === 271491 && piece.itemLevel === 219);
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
  assert.deepEqual(deathKnight.verifiedCandidateSlots, []);
  assert.deepEqual(deathKnight.missingVerifiedCandidateSlots, [
    "Head", "Shoulders", "Chest", "Hands", "Legs"
  ]);
  assert.deepEqual(deathKnight.observedOnlySlots, [
    "Head", "Shoulders", "Chest", "Hands", "Legs"
  ]);
  assert.ok(deathKnight.slotVariantCoverage.every(slot => Array.isArray(slot.observedOnlyItemLevels)));
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
  assert.deepEqual(shaman.verifiedCandidateSlots, [
    "Head", "Shoulders", "Chest", "Hands", "Legs"
  ]);
  assert.deepEqual(shaman.missingVerifiedCandidateSlots, []);
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
  assert.equal(observations.length, 12);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(rogue.variantObservationsStatus, "partial");
  assert.match(rogue.variantObservationsNote, /remain unverified/i);
  const manifestSet = manifest.sets.find(set => set.className === "Rogue");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/") || piece.sourceUrl === "https://warcraft.wiki.gg/wiki/Chosen_Bloodslayer%27s_Hexweave");
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    if (piece.sourceUrl.startsWith("https://www.wowhead.com/")) {
      assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel,
        "Wowhead source URL must pin the exact observed item level");
    } else {
      assert.ok(piece.stats.every(stat => stat.source.includes(`item level ${piece.itemLevel}`)),
        "Warcraft Wiki observations must identify the exact item level in each stat source");
    }
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
  const veteranHands = observations.find(piece => piece.itemId === 271511 && piece.itemLevel === 282);
  assert.equal(veteranHands.variant, "Veteran 2/6 observed");
  assert.deepEqual(
    Object.fromEntries(veteranHands.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 87, stamina: 1606, criticalStrike: 79, mastery: 40 }
  );
  assert.equal(veteranHands.candidate, false);
  const head = observations.find(piece => piece.itemId === 271510);
  assert.equal(head.itemLevel, 295);
  assert.deepEqual(
    Object.fromEntries(head.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 131, intellect: 131, stamina: 2492, criticalStrike: 56, mastery: 113 }
  );
  const legs315 = observations.find(piece => piece.itemId === 271509 && piece.itemLevel === 315);
  assert.equal(legs315.variant, "Heroic 4/6 observed");
  assert.deepEqual(Object.fromEntries(legs315.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 158, intellect: 158, stamina: 3143, criticalStrike: 66, haste: 120 });
  const legs321 = observations.find(piece => piece.itemId === 271509 && piece.itemLevel === 321);
  assert.equal(legs321.variant, "Heroic 6/6 observed");
  assert.deepEqual(Object.fromEntries(legs321.stats.map(stat => [stat.type.name, stat.value])),
    { agility: 167, intellect: 167, stamina: 3369, criticalStrike: 67, haste: 123 });
  for (const [level, expected] of [
    [285, { agility: 119, stamina: 2219, criticalStrike: 57, haste: 104 }],
    [298, { agility: 135, stamina: 2579, criticalStrike: 61, haste: 111 }],
    [311, { agility: 152, stamina: 3002, criticalStrike: 64, haste: 118 }],
    [324, { agility: 172, stamina: 3487, criticalStrike: 68, haste: 125 }]
  ]) {
    const piece = observations.find(entry => entry.itemId === 271509 && entry.itemLevel === level);
    assert.ok(piece, `expected source-checked Rogue legs at item level ${level}`);
    assert.equal(piece.candidate, false);
    assert.deepEqual(Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])), expected);
  }
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
  assert.equal(observations.length, 9);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(mage.variantObservationsStatus, "partial");
  assert.match(mage.variantObservationsNote, /do not establish coverage/i);
  const manifestSet = manifest.sets.find(set => set.className === "Mage");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.itemLevel > 0);
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/"));
    assert.equal(Number(new URL(piece.sourceUrl).searchParams.get("ilvl")), piece.itemLevel);
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    "271567:334": { intellect: 189, stamina: 3910, criticalStrike: 130, haste: 71 },
    "271565:282": { intellect: 87, stamina: 1606, haste: 39, mastery: 80 },
    "271565:295": { intellect: 98, stamina: 1869, haste: 42, mastery: 85 },
    "271565:308": { intellect: 111, stamina: 2172, haste: 45, mastery: 90 },
    "271565:321": { intellect: 125, stamina: 2527, haste: 47, mastery: 96 },
    "271565:334": { intellect: 141, stamina: 2932, haste: 50, mastery: 101 },
    "271564:334": { intellect: 189, stamina: 3910, haste: 137, mastery: 63 },
    "271563:334": { intellect: 189, stamina: 3910, criticalStrike: 62, versatility: 139 },
    "271562:334": { intellect: 141, stamina: 2932, haste: 107, versatility: 44 }
  };
  const handsByLevel = new Map(observations.filter(piece => piece.itemId === 271565).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...handsByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321, 334]);
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[`${piece.itemId}:${piece.itemLevel}`]
    );
  }
  assert.equal(mage.itemIdsVerified, false,
    "observed variants must not promote the complete class variant map");
});


test("Priest source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const priest = catalogue.sets.find(set => set.class === "Priest");
  const observations = priest.verifiedVariantObservations || [];
  assert.equal(observations.length, 9);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(priest.variantObservationsStatus, "partial");
  const handsByLevel = new Map(observations.filter(piece => piece.itemId === 271556).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...handsByLevel.keys()].sort((a, b) => a - b), [282, 295, 305, 308, 321]);
  assert.equal(handsByLevel.get(282).variant, "Veteran 2/6 observed");
  assert.equal(handsByLevel.get(295).variant, "Champion 2/6 observed");
  assert.equal(handsByLevel.get(308).variant, "Hero 2/6 observed");
  assert.equal(handsByLevel.get(321).variant, "Myth 2/6 observed");
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
    "271558:334": { intellect: 189, stamina: 3910, criticalStrike: 62, mastery: 139 },
    "271556:305": { intellect: 108, stamina: 2096, criticalStrike: 47, mastery: 87 },
    "271556:282": { intellect: 87, stamina: 1606, criticalStrike: 42, mastery: 77 },
    "271556:295": { intellect: 98, stamina: 1869, criticalStrike: 44, mastery: 83 },
    "271556:308": { intellect: 111, stamina: 2172, criticalStrike: 47, mastery: 88 },
    "271556:321": { intellect: 125, stamina: 2527, criticalStrike: 50, mastery: 93 },
    "271555:334": { intellect: 189, stamina: 3910, criticalStrike: 141, mastery: 60 },
    "271554:334": { intellect: 189, stamina: 3910, haste: 143, versatility: 58 },
    "271553:334": { intellect: 141, stamina: 2932, criticalStrike: 101, haste: 49 }
  };
  for (const piece of observations) {
    const key = `${piece.itemId}:${piece.itemLevel}`;
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[key]
    );
  }
  assert.equal(observations.find(piece => piece.itemId === 271556).itemLevel, 305);
  assert.equal(priest.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("Warlock source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const warlock = catalogue.sets.find(set => set.class === "Warlock");
  const observations = warlock.verifiedVariantObservations || [];
  assert.equal(observations.length, 14);
  assert.deepEqual([...new Set(observations.map(piece => piece.slot))].sort(), [...EXPECTED_SLOTS].sort());
  assert.equal(warlock.variantObservationsStatus, "partial");
  assert.match(warlock.variantObservationsNote, /Head is observed at item levels 219, 285 .* 298 .* 305, 308 .* 311 .* 315, 318, 321, and 324/i);
  assert.match(warlock.variantObservationsNote, /other difficulty and upgrade variants remain unverified/i);
  const manifestSet = manifest.sets.find(set => set.className === "Warlock");
  const slotsById = new Map(manifestSet.pieces.map(piece => [Number(piece.itemId), piece.slot]));
  for (const piece of observations) {
    assert.equal(piece.candidate, false);
    assert.equal(piece.verificationScope, "observed-version-only");
    assert.ok(piece.sourceUrl.startsWith("https://www.wowhead.com/") || piece.sourceUrl === "https://warcraft.wiki.gg/wiki/Skull_of_the_Damned_Necrolyte");
    const sourceLevel = new URL(piece.sourceUrl).searchParams.get("ilvl");
    if (sourceLevel) assert.equal(Number(sourceLevel), piece.itemLevel);
    if (piece.sourceUrl.startsWith("https://warcraft.wiki.gg/")) {
      assert.ok(piece.stats.every(stat => stat.source.includes(`item level ${piece.itemLevel}`)));
    }
    assert.equal(slotsById.get(Number(piece.itemId)), piece.slot);
    assert.ok(piece.stats.length >= 4);
    assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
  }
  const expected = {
    271549: { intellect: 189, stamina: 3910, haste: 141, mastery: 60 },
    271547: { intellect: 138, stamina: 2832, criticalStrike: 44, haste: 105 },
    "271546:219": { intellect: 65, stamina: 1005, versatility: 34, mastery: 73 },
    "271546:305": { intellect: 144, stamina: 2794, versatility: 57, mastery: 120 },
    "271546:308": { intellect: 148, stamina: 2896, versatility: 58, mastery: 122 },
    "271546:315": { intellect: 158, stamina: 3143, versatility: 60, mastery: 126 },
    "271546:318": { intellect: 162, stamina: 3254, versatility: 61, mastery: 127 },
    "271546:285": { intellect: 119, stamina: 2219, versatility: 52, mastery: 109 },
    "271546:298": { intellect: 135, stamina: 2579, versatility: 55, mastery: 116 },
    "271546:311": { intellect: 152, stamina: 3002, versatility: 59, mastery: 124 },
    "271546:321": { intellect: 167, stamina: 3369, versatility: 61, mastery: 129 },
    "271546:324": { intellect: 172, stamina: 3487, versatility: 62, mastery: 131 },
    271545: { intellect: 189, stamina: 3910, haste: 141, mastery: 60 },
    271544: { intellect: 141, stamina: 2932, haste: 50, versatility: 101 }
  };
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[piece.itemId === 271546 ? `271546:${piece.itemLevel}` : piece.itemId]
    );
  }
  assert.deepEqual(
    observations.filter(piece => piece.itemId === 271546).map(piece => piece.itemLevel).sort((a, b) => a - b),
    [219, 285, 298, 305, 308, 311, 315, 318, 321, 324]
  );
  assert.equal(observations.find(piece => piece.itemId === 271546 && piece.itemLevel === 308).variant, "Hero 2/6 observed");
  assert.equal(observations.find(piece => piece.itemId === 271546 && piece.itemLevel === 318).variant, "Myth 1/6 observed");
  assert.equal(observations.find(piece => piece.itemId === 271546 && piece.itemLevel === 321).variant, "Item level 321 observed");
  assert.equal(warlock.itemIdsVerified, false,
    "partial observed versions must not promote the complete class variant map");
});


test("Monk source-backed tier item versions remain evidence-only and match Wowhead stats", () => {
  const monk = catalogue.sets.find(set => set.class === "Monk");
  const observations = monk.verifiedVariantObservations || [];
  assert.equal(observations.length, 9);
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
    "271522:334": { agility: 189, intellect: 189, stamina: 3910, haste: 62, mastery: 139 },
    "271520:334": { agility: 141, intellect: 141, stamina: 2932, haste: 106, versatility: 45 },
    "271519:334": { agility: 189, intellect: 189, stamina: 3910, criticalStrike: 58, mastery: 142 },
    "271518:311": { agility: 152, intellect: 152, stamina: 3002, criticalStrike: 118, versatility: 65 },
    "271517:282": { agility: 87, intellect: 87, stamina: 1606, haste: 82, mastery: 37 },
    "271517:295": { agility: 98, intellect: 98, stamina: 1869, haste: 87, mastery: 40 },
    "271517:308": { agility: 111, intellect: 111, stamina: 2172, haste: 93, mastery: 42 },
    "271517:321": { agility: 125, intellect: 125, stamina: 2527, haste: 98, mastery: 45 },
    "271517:334": { agility: 141, intellect: 141, stamina: 2932, haste: 103, mastery: 47 }
  };
  const shouldersByLevel = new Map(observations.filter(piece => piece.itemId === 271517).map(piece => [piece.itemLevel, piece]));
  assert.deepEqual([...shouldersByLevel.keys()].sort((a, b) => a - b), [282, 295, 308, 321, 334]);
  for (const piece of observations) {
    assert.deepEqual(
      Object.fromEntries(piece.stats.map(stat => [stat.type.name, stat.value])),
      expected[`${piece.itemId}:${piece.itemLevel}`]
    );
  }
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
      const sourceHost = new URL(piece.sourceUrl).hostname;
      assert.ok(
        sourceHost === "www.wowhead.com" || sourceHost === "warcraft.wiki.gg",
        set.class + " source URL must point to a trusted item reference"
      );
      assert.ok(Array.isArray(piece.stats) && piece.stats.length >= 4);
      assert.ok(piece.stats.every(stat => Number.isFinite(stat.value) && stat.value > 0));
    }
  }
});
