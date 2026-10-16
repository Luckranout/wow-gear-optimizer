const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const handler = require("../api/slot-candidates");
const { SLOT_SECTION, slotMatches, allowedForClass, allowedForClassWeapon, allowedForSpecialization, normalizeClass, hasUsableStats, createResponse, setSectionDir } = handler._test;

assert.equal(SLOT_SECTION.Neck, "necklaces");
assert.equal(SLOT_SECTION.Shoulders, "shoulders");
assert.equal(SLOT_SECTION["Ring 1"], "rings");
assert.equal(SLOT_SECTION["Trinket 2"], "trinkets");
assert.equal(SLOT_SECTION["Main Hand"], "main-hand");
assert.equal(SLOT_SECTION["Off Hand"], "off-hand");
assert.equal(normalizeClass("Death Knight"), "deathknight");

assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" } }, "Warrior", "Head"), true);
assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Mail" } }, "Warrior", "Head"), false);
assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Leather" } }, "Druid", "Chest"), true);
assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Cloth" } }, "Priest", "Wrists"), true);
assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" } }, "Mage", "Head"), false);
assert.equal(allowedForClass({ itemClass: { name: "Armor" }, itemSubclass: { name: "Plate" } }, "Unknown", "Head"), false);

assert.equal(slotMatches({ inventoryType: { name: "One-Hand" }, itemClass: { name: "Weapon" } }, "Main Hand"), true, "one-hand weapons belong in Main Hand");
assert.equal(slotMatches({ inventoryType: { name: "One-Hand" }, itemClass: { name: "Armor" } }, "Main Hand"), false, "one-hand armor must not be treated as a weapon");
assert.equal(slotMatches({ inventoryType: { name: "Neck" } }, "Neck"), true);
assert.equal(slotMatches({ inventoryType: { type: "NECK", name: "Neck" }, equipmentCategories: ["necklaces"] }, "Neck"), true, "canonical normalized category matches Neck");
assert.equal(slotMatches({ inventoryType: { type: "NECK", name: "Neck" }, equipmentCategories: ["rings"] }, "Neck"), false, "explicit normalized category prevents contradictory fallback matches");
assert.equal(slotMatches({ inventoryType: { type: "WEAPON", name: "Weapon" }, equipmentCategories: ["main-hand", "off-hand"] }, "Off Hand"), true, "generic Blizzard weapon inventory type can be classified for both hands before weapon eligibility filtering");
assert.equal(slotMatches({ inventoryType: { name: "Finger" } }, "Ring 2"), true);
assert.equal(slotMatches({ inventoryType: { name: "Trinket" } }, "Trinket 1"), true);
assert.equal(slotMatches({ slot: "Shoulders" }, "Shoulders"), true);
assert.equal(slotMatches({ inventoryType: { name: "One-Hand" } }, "Off Hand"), false);
assert.equal(slotMatches({ inventoryType: { name: "Shield" } }, "Off Hand"), true);
assert.equal(hasUsableStats({ stats: [{ value: 12 }] }), true);
assert.equal(hasUsableStats({ stats: [] }), false);
assert.equal(hasUsableStats({}), false);

function mockReq(method, query = {}) { return { method, query, headers: {} }; }
async function call(method, query) {
  const res = createResponse();
  await handler(mockReq(method, query), res);
  return res;
}
function writeSection(dir, name, payload) {
  fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify(payload));
}


assert.equal(allowedForClassWeapon({
  itemSubclass: { name: "Staff" }, inventoryType: { name: "Two-Hand" }
}, "Shaman", "Main Hand"), true, "shamans can use staves generally");
assert.equal(allowedForSpecialization({
  name: "Example Staff", itemSubclass: { name: "Staff" }, inventoryType: { name: "Staff" }
}, "Shaman", "Enhancement", "Main Hand"), false, "Enhancement Shaman must never receive a staff recommendation");
assert.equal(allowedForSpecialization({
  name: "Example Sword", itemSubclass: { name: "Sword" }, inventoryType: { name: "One-Hand" }
}, "Shaman", "Enhancement", "Main Hand"), true, "Enhancement Shaman can use a compatible one-handed weapon");
assert.equal(allowedForSpecialization({
  name: "Example Staff", itemSubclass: { name: "Staff" }, inventoryType: { name: "Staff" }
}, "Shaman", "Restoration", "Main Hand"), true, "specialization-specific staff restriction does not affect other specs");

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "slot-candidates-"));
  setSectionDir(dir);
  try {
    const validShoulders = {
      id: 101, name: "Season 2 Plate Shoulders", slot: "Shoulders",
      inventoryType: { name: "Shoulder" }, isEquippable: true,
      seasonScope: "Midnight Season 2+", itemClass: { name: "Armor" },
      itemSubclass: { name: "Plate" }, stats: [{ name: "strength", value: 20 }]
    };
    const candidates = [
      validShoulders,
      { ...validShoulders, id: 102, name: "Legacy shoulders", seasonScope: "Legacy" },
      { ...validShoulders, id: 103, name: "Mail shoulders", itemSubclass: { name: "Mail" } },
      { ...validShoulders, id: 104, name: "Not equippable", isEquippable: false },
      { ...validShoulders, id: 105, name: "No stats", stats: [] },
      { ...validShoulders, id: 106, name: "Wrong slot", slot: "Chest", inventoryType: { name: "Chest" } }
    ];
    writeSection(dir, "shoulders", { complete: true, items: candidates });
    let res = await call("GET", { slot: "Shoulders", class: "Warrior" });
    assert.equal(res.statusCode, 200, "valid section returns 200");
    assert.deepEqual(res.body.items.map(item => item.id), [101, 105], "filters legacy, wrong class, non-equippable, and wrong-slot items but preserves source-verified records for Wowhead stat recovery");
    assert.equal(res.body.count, 2);
    assert.equal(res.body.missingStatsCount, 1, "reports candidates whose base records need Wowhead stats");
    assert.match(res.body.statsNote, /Wowhead variant resolution/);
    assert.match(res.headers["cache-control"], /s-maxage=900/);

    const oneHandDagger = {
      id: 401, name: "Season One-Hand Dagger", inventoryType: { name: "One-Hand" },
      isEquippable: true, seasonScope: "Midnight Season 2+", itemClass: { name: "Weapon" },
      itemSubclass: { name: "Dagger" }, stats: [{ name: "agility", value: 18 }]
    };
    const oneHandArmor = {
      ...oneHandDagger, id: 402, name: "Invalid One-Hand Armor", itemClass: { name: "Armor" },
      itemSubclass: { name: "Leather" }
    };
    writeSection(dir, "main-hand", { complete: true, items: [oneHandDagger, oneHandArmor] });
    res = await call("GET", { slot: "Main Hand", class: "Rogue" });
    assert.equal(res.statusCode, 200, "main-hand section returns 200");
    assert.deepEqual(res.body.items.map(item => item.id), [401], "API returns compatible one-hand weapons and excludes one-hand armor");
    assert.equal(res.body.count, 1, "main-hand candidate count reflects compatible one-hand weapons");

    res = await call("GET", { slot: "Neck", class: "Mage" });
    assert.equal(res.statusCode, 503, "missing section fails closed");

    writeSection(dir, "necklaces", { complete: false, items: [] });
    res = await call("GET", { slot: "Neck", class: "Mage" });
    assert.equal(res.statusCode, 503, "incomplete section fails closed");

    fs.writeFileSync(path.join(dir, "necklaces.json"), "{not-json");
    res = await call("GET", { slot: "Neck", class: "Mage" });
    assert.equal(res.statusCode, 503, "malformed catalog fails closed");

    res = await call("GET", { slot: "Unknown", class: "Warrior" });
    assert.equal(res.statusCode, 400, "unsupported slot rejected");
    res = await call("GET", { slot: "Shoulders" });
    assert.equal(res.statusCode, 400, "missing class rejected");
    res = await call("POST", { slot: "Shoulders", class: "Warrior" });
    assert.equal(res.statusCode, 405, "non-GET request rejected");

    writeSection(dir, "shoulders", { complete: true, items: [{ ...validShoulders, id: 201, seasonScope: "Legacy" }] });
    res = await call("GET", { slot: "Shoulders", class: "Warrior" });
    assert.equal(res.statusCode, 200, "empty eligible result is valid");
    assert.equal(res.body.count, 0, "returns zero candidates rather than legacy gear");

    writeSection(dir, "off-hand", { complete: true, items: [
      { id: 301, inventoryType: { name: "One-Hand" }, isEquippable: true, seasonScope: "Midnight Season 2+", stats: [{ value: 5 }] },
      { id: 302, inventoryType: { name: "Shield" }, isEquippable: true, seasonScope: "Midnight Season 2+", stats: [{ value: 5 }] }
    ] });
    res = await call("GET", { slot: "Off Hand", class: "Warrior" });
    assert.deepEqual(res.body.items.map(item => item.id), [302], "off-hand does not accept a generic one-hand weapon as an off-hand item");
  } finally {
    setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("On-demand slot candidate API tests passed (handler, responses, fail-closed behavior, filtering, stats, and weapon slots).");
})().catch(error => { console.error(error); process.exitCode = 1; });
