const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const slotCandidates = require("../api/slot-candidates.js");

test("slot candidates retain an eligible item when only a verified variant has usable stats", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slot-candidates-"));
  const item = {
    id: 987654,
    name: "Variant-only stats test trinket",
    isEquippable: true,
    seasonScope: "Midnight Season 2+",
    inventoryType: { name: "Trinket" },
    stats: [],
    variants: [{
      variantKey: "wowhead:test-variant",
      itemLevel: 340,
      stats: [{ type: { name: "haste" }, value: 147 }]
    }]
  };
  fs.writeFileSync(path.join(directory, "trinkets.json"), JSON.stringify({
    complete: true,
    items: [item]
  }));

  slotCandidates._test.setSectionDir(directory);
  const res = slotCandidates._test.createResponse();
  try {
    await slotCandidates({ method: "GET", query: { slot: "Trinket 1", class: "mage" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.items[0].id, item.id);
    assert.equal(res.body.items[0].variants[0].itemLevel, 340);
  } finally {
    slotCandidates._test.setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("slot candidates reject items without combat-stat evidence to avoid transmog-only recommendations", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slot-candidates-"));
  fs.writeFileSync(path.join(directory, "trinkets.json"), JSON.stringify({
    complete: true,
    items: [{
      id: 987655,
      name: "No stats test trinket",
      isEquippable: true,
      seasonScope: "Midnight Season 2+",
      inventoryType: { name: "Trinket" },
      stats: [],
      variants: [{ variantKey: "empty", itemLevel: 340, stats: [] }]
    }]
  }));

  slotCandidates._test.setSectionDir(directory);
  const res = slotCandidates._test.createResponse();
  try {
    await slotCandidates({ method: "GET", query: { slot: "Trinket 1", class: "mage" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 0, "Blizzard equippable metadata and empty stats alone must not admit a cosmetic/transmog-only item");
    assert.deepEqual(res.body.pendingStatVerification.map(candidate => candidate.id), [987655],
      "statless record is only queued for external verification and is not a scoring candidate");
  } finally {
    slotCandidates._test.setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


test("armor and weapon variants missing their primary stat are queued, not scored", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "primary-stat-queue-"));
  const incompleteBelt = {
    id: 251144,
    name: "Autumn's Boon Belt",
    slot: "Waist",
    inventoryType: { name: "Waist" },
    itemClass: { name: "Armor" },
    itemSubclass: { name: "Plate" },
    isEquippable: true,
    seasonScope: "Midnight Season 2+",
    stats: [{ type: { name: "strength" }, value: 50 }, { type: { name: "stamina" }, value: 500 }],
    variants: [{
      itemLevel: 334,
      stats: [
        { type: { name: "armor" }, value: 245 },
        { type: { name: "stamina" }, value: 2932 },
        { type: { name: "versatility" }, value: 59 },
        { type: { name: "mastery" }, value: 91 }
      ]
    }]
  };
  const incompleteWeapon = {
    id: 987656,
    name: "Incomplete Two-Hand Sword",
    slot: "Main Hand",
    inventoryType: { name: "Two-Hand" },
    itemClass: { name: "Weapon" },
    itemSubclass: { name: "Sword" },
    isEquippable: true,
    seasonScope: "Midnight Season 2+",
    stats: [{ type: { name: "strength" }, value: 50 }, { type: { name: "stamina" }, value: 500 }],
    variants: [{
      itemLevel: 334,
      stats: [{ type: { name: "stamina" }, value: 2932 }, { type: { name: "haste" }, value: 90 }]
    }]
  };
  fs.writeFileSync(path.join(directory, "waist.json"), JSON.stringify({ complete: true, items: [incompleteBelt] }));
  fs.writeFileSync(path.join(directory, "main-hand.json"), JSON.stringify({ complete: true, items: [incompleteWeapon] }));

  slotCandidates._test.setSectionDir(directory);
  slotCandidates._test.setDiscoveryProvider(async () => []);
  const beltRes = slotCandidates._test.createResponse();
  const weaponRes = slotCandidates._test.createResponse();
  try {
    await slotCandidates({ method: "GET", query: { slot: "Waist", class: "Warrior", specialization: "Protection" } }, beltRes);
    await slotCandidates({ method: "GET", query: { slot: "Main Hand", class: "Warrior", specialization: "Protection" } }, weaponRes);

    assert.equal(beltRes.statusCode, 200);
    assert.equal(beltRes.body.items.some(item => item.id === incompleteBelt.id), false,
      "placeholder Strength on the base belt must not make its incomplete upgraded variant scoreable");
    assert.ok(beltRes.body.pendingStatVerification.some(item => item.id === incompleteBelt.id),
      "the belt must be sent to pre-score Wowhead verification");

    assert.equal(weaponRes.statusCode, 200);
    assert.equal(weaponRes.body.items.some(item => item.id === incompleteWeapon.id), false,
      "placeholder Strength on the base weapon must not make its incomplete upgraded variant scoreable");
    assert.ok(weaponRes.body.pendingStatVerification.some(item => item.id === incompleteWeapon.id),
      "the weapon must be sent to pre-score Wowhead verification");
  } finally {
    slotCandidates._test.setDiscoveryProvider(null);
    slotCandidates._test.setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
