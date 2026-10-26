const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const slotCandidates = require("../api/slot-candidates");
const itemLookup = require("../api/item-lookup");
const verification = require("../combat-stat-verification");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "optimizer.js"), "utf8"), context);
const optimizer = context.window.WoWOptimizer;

function writeSection(directory, section, item) {
  fs.writeFileSync(path.join(directory, section + ".json"), JSON.stringify({ complete: true, items: [item] }));
}

async function verifySlotCandidate(directory, slot, section, item, currentLevel) {
  const response = slotCandidates._test.createResponse();
  await slotCandidates({
    method: "GET",
    query: { slot, class: "Warrior", specialization: "Protection" },
    headers: {}
  }, response);

  assert.equal(response.statusCode, 200, slot + " candidate request succeeds");
  assert.equal(response.body.items.some(candidate => candidate.id === item.id), false,
    slot + " variant without Strength must not be scored using the base item's placeholder Strength");
  const pending = response.body.pendingStatVerification.find(candidate => candidate.id === item.id);
  assert.ok(pending, slot + " item is placed in the pre-score Wowhead verification queue");

  const tooltip = {
    tooltip: {
      html: "Item Level 334<br>+189 Strength<br>+2,932 Stamina<br>+59 Versatility<br>+91 Mastery"
    }
  };
  const parsed = itemLookup._test.parseTooltip(tooltip, item.id, 6);
  assert.ok(parsed, slot + " Wowhead tooltip parses");
  assert.equal(parsed.itemLevel, 334);
  assert.equal(parsed.stats.Strength, 189,
    slot + " verified tooltip supplies the missing primary stat");
  const variants = verification.filterVerifiedVariants(pending, [parsed]);
  assert.equal(variants.length, 1, slot + " verified primary-stat variant becomes eligible");

  const resolvedCandidate = {
    ...pending,
    variants: variants.map(variant => ({
      ...variant,
      id: item.id,
      name: item.name,
      slot,
      inventoryType: item.inventoryType,
      itemClass: item.itemClass,
      itemSubclass: item.itemSubclass,
      isEquippable: true
    }))
  };
  const current = {
    id: item.id + 100000,
    name: "Lower-level equipped " + slot,
    slot,
    itemLevel: currentLevel,
    level: currentLevel,
    inventoryType: item.inventoryType,
    itemClass: item.itemClass,
    itemSubclass: item.itemSubclass,
    stats: { Strength: 100, Stamina: 1000, Haste: 10, Mastery: 10, Versatility: 10 }
  };
  const upgrades = optimizer.findUpgradeOpportunities({
    currentEquipment: { [slot]: current },
    availableItems: [resolvedCandidate],
    className: "Warrior",
    specialization: "Protection",
    statWeights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 },
    limit: 10
  });
  const selected = upgrades.find(entry => entry.slot === slot && entry.recommendedItem?.id === item.id);
  assert.ok(selected, slot + " optimizer selects the candidate after verified primary stats are attached");
  assert.equal(Number(selected.recommendedItem.itemLevel ?? selected.recommendedItem.level), 334,
    slot + " optimizer uses the verified item level 334 variant");
}

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "primary-stat-resolution-"));
  const belt = {
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
  const weapon = {
    id: 987657,
    name: "Verified Two-Hand Sword",
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

  writeSection(directory, "waist", belt);
  writeSection(directory, "main-hand", weapon);
  slotCandidates._test.setSectionDir(directory);
  slotCandidates._test.setDiscoveryProvider(async () => []);
  try {
    await verifySlotCandidate(directory, "Waist", "waist", belt, 318);
    await verifySlotCandidate(directory, "Main Hand", "main-hand", weapon, 318);
  } finally {
    slotCandidates._test.setDiscoveryProvider(null);
    slotCandidates._test.setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log("Primary-stat candidate resolution integration passed for Warrior waist and main-hand weapon.");
})().catch(error => { console.error(error); process.exitCode = 1; });
