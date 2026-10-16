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
