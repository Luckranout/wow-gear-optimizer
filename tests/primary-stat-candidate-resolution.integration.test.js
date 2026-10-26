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
const sectionRoot = path.join(__dirname, "..", "data", "equipment-sections");

function readCatalogItem(section, id) {
  const payload = JSON.parse(fs.readFileSync(path.join(sectionRoot, section + ".json"), "utf8"));
  const item = payload.items.find(candidate => Number(candidate.id) === id);
  assert.ok(item, "real " + section + " catalog contains item " + id);
  return JSON.parse(JSON.stringify(item));
}

function writeSection(directory, section, item) {
  fs.writeFileSync(path.join(directory, section + ".json"), JSON.stringify({ complete: true, items: [item] }));
}

async function verifyCandidate(directory, scenario) {
  const response = slotCandidates._test.createResponse();
  await slotCandidates({
    method: "GET",
    query: { slot: scenario.slot, class: "Warrior", specialization: "Protection" },
    headers: {}
  }, response);

  assert.equal(response.statusCode, 200, scenario.slot + " candidate request succeeds");
  let candidate;
  if (scenario.requiresLookup) {
    assert.equal(response.body.items.some(item => item.id === scenario.item.id), false,
      scenario.item.name + " must not be scored with incomplete upgraded stats");
    const pending = response.body.pendingStatVerification.find(item => item.id === scenario.item.id);
    assert.ok(pending, scenario.item.name + " is queued for pre-score Wowhead verification");

    const itemLevel = Number(scenario.item.variants?.[0]?.itemLevel);
    const tooltip = {
      tooltip: {
        html: "Item Level " + itemLevel +
          "<br>+189 Strength<br>+2,932 Stamina<br>+59 Versatility<br>+91 Mastery"
      }
    };
    const parsed = itemLookup._test.parseTooltip(tooltip, scenario.item.id, 6);
    assert.ok(parsed, scenario.slot + " Wowhead tooltip parses");
    assert.equal(parsed.itemLevel, itemLevel);
    assert.equal(parsed.stats.Strength, 189,
      scenario.slot + " verified tooltip supplies the missing Strength");
    const variants = verification.filterVerifiedVariants(pending, [parsed]);
    assert.equal(variants.length, 1, scenario.slot + " accepts the complete primary-stat variant");
    candidate = {
      ...pending,
      variants: variants.map(variant => ({
        ...variant,
        id: scenario.item.id,
        name: scenario.item.name,
        slot: scenario.slot,
        inventoryType: scenario.item.inventoryType,
        itemClass: scenario.item.itemClass,
        itemSubclass: scenario.item.itemSubclass,
        isEquippable: true
      }))
    };
  } else {
    candidate = response.body.items.find(item => item.id === scenario.item.id);
    assert.ok(candidate, scenario.item.name + " is returned as a valid candidate without requiring a primary stat");
    assert.ok(candidate.variants?.some(variant => Number(variant.itemLevel) > scenario.currentLevel),
      scenario.item.name + " includes an item-level upgrade above the equipped item");
  }

  const currentStats = scenario.slot === "Back"
    ? { Haste: 10, Mastery: 10, Stamina: 1000 }
    : { Strength: 100, Stamina: 1000, Haste: 10, Mastery: 10, Versatility: 10 };
  const current = {
    id: scenario.item.id + 100000,
    name: "Lower-level equipped " + scenario.slot,
    slot: scenario.slot,
    itemLevel: scenario.currentLevel,
    level: scenario.currentLevel,
    inventoryType: scenario.item.inventoryType,
    itemClass: scenario.item.itemClass,
    itemSubclass: scenario.item.itemSubclass,
    stats: currentStats
  };
  const upgrades = optimizer.findUpgradeOpportunities({
    currentEquipment: { [scenario.slot]: current },
    availableItems: [candidate],
    className: "Warrior",
    specialization: "Protection",
    statWeights: scenario.weights,
    limit: 10
  });
  const selected = upgrades.find(entry => entry.slot === scenario.slot && entry.recommendedItem?.id === scenario.item.id);
  assert.ok(selected, scenario.slot + " optimizer selects the candidate after the required verification");
  const expectedLevel = scenario.requiresLookup
    ? Number(scenario.item.variants[0].itemLevel)
    : Math.max(...candidate.variants.map(variant => Number(variant.itemLevel)));
  assert.equal(Number(selected.recommendedItem.itemLevel ?? selected.recommendedItem.level), expectedLevel,
    scenario.slot + " optimizer uses the verified upgraded item level");
}

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "primary-stat-resolution-"));
  const scenarios = [
    {
      slot: "Feet", section: "feet", id: 268260, currentLevel: 334, requiresLookup: true,
      weights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 }
    },
    {
      slot: "Wrists", section: "wrists", id: 251133, currentLevel: 331, requiresLookup: true,
      weights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 }
    },
    {
      slot: "Waist", section: "waist", id: 251144, currentLevel: 318, requiresLookup: true,
      weights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 }
    },
    {
      slot: "Main Hand", section: "main-hand", id: 268209, currentLevel: 318, requiresLookup: true,
      weights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 }
    },
    {
      slot: "Back", section: "back", id: 268253, currentLevel: 331, requiresLookup: false,
      weights: { Strength: 0, Stamina: 0, Haste: 1, Mastery: 1, Versatility: 0 }
    },
    {
      slot: "Off Hand", section: "off-hand", id: 268196, currentLevel: 318, requiresLookup: false,
      weights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 }
    }
  ].map(scenario => ({ ...scenario, item: readCatalogItem(scenario.section, scenario.id) }));

  for (const scenario of scenarios) writeSection(directory, scenario.section, scenario.item);
  slotCandidates._test.setSectionDir(directory);
  slotCandidates._test.setDiscoveryProvider(async () => []);
  try {
    for (const scenario of scenarios) await verifyCandidate(directory, scenario);
  } finally {
    slotCandidates._test.setDiscoveryProvider(null);
    slotCandidates._test.setSectionDir(path.join(process.cwd(), "data", "equipment-sections"));
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log("Protection Warrior non-tier candidate resolution passed for Feet, Wrists, Waist, Back, Main Hand, and Off Hand.");
})().catch(error => { console.error(error); process.exitCode = 1; });
