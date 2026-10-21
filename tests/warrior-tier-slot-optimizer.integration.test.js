// End-to-end regression for Warrior tier variants:
// real catalogue -> slot-candidates handler response -> optimizer upgrade selection.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const handler = require("../api/slot-candidates");
const { createResponse, setSectionDir, setDiscoveryProvider, setTierSetCandidateProvider } = handler._test;
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "optimizer.js"), "utf8"), context);
const optimizer = context.window.WoWOptimizer;
const catalogue = JSON.parse(fs.readFileSync(path.join(root, "data/tier-sets-midnight-season-2.json"), "utf8"));
const warrior = catalogue.sets.find(set => set.class === "Warrior");
assert.ok(warrior, "real catalogue includes Warrior");
const expectedBySlot = new Map(warrior.basePieces.map(piece => [piece.slot, piece]));

function writeSection(dir, section) {
  fs.writeFileSync(path.join(dir, section + ".json"), JSON.stringify({ complete: true, items: [] }));
}
async function requestCandidates(slot) {
  const res = createResponse();
  await handler({ method: "GET", query: { slot, class: "Warrior", specialization: "Arms" }, headers: {} }, res);
  assert.equal(res.statusCode, 200, slot + " slot API request succeeds");
  return res.body;
}

(async () => {
  const sectionDir = fs.mkdtempSync(path.join(os.tmpdir(), "warrior-tier-e2e-"));
  const sectionFiles = {
    Head: "head", Shoulders: "shoulders", Chest: "chest", Hands: "hands", Legs: "legs"
  };
  setSectionDir(sectionDir);
  setDiscoveryProvider(async () => []);
  setTierSetCandidateProvider(null);

  try {
    for (const [slot, section] of Object.entries(sectionFiles)) {
      writeSection(sectionDir, section);
      const payload = await requestCandidates(slot);
      const expectedPiece = expectedBySlot.get(slot);
      assert.ok(expectedPiece, "Warrior base mapping includes " + slot);

      const expectedLevels = [...(warrior.pieces || []), ...(warrior.upgradeRankCandidates || [])]
        .filter(piece => piece.candidate === true && piece.slot === slot)
        .map(piece => Number(piece.itemLevel))
        .filter(Number.isFinite);
      const apiLevels = payload.items
        .filter(item => item.name === expectedPiece.name)
        .flatMap(item => item.variants || [])
        .map(variant => Number(variant.itemLevel))
        .filter(Number.isFinite);
      assert.deepEqual(
        [...new Set(apiLevels)].sort((a, b) => a - b),
        [...new Set(expectedLevels)].sort((a, b) => a - b),
        slot + " API exposes every exact candidate level from the real Warrior catalogue"
      );

      const current = {
        id: 900000 + Object.keys(sectionFiles).indexOf(slot),
        name: "Lower-level equipped " + slot,
        slot,
        itemLevel: 300,
        itemClass: { name: "Armor" },
        itemSubclass: { name: "Plate" },
        inventoryType: { name: slot === "Hands" ? "Hands" : slot },
        stats: { Strength: 1 }
      };
      const upgrades = optimizer.findUpgradeOpportunities({
        currentEquipment: { [slot]: current },
        availableItems: payload.items,
        className: "Warrior",
        specialization: "Arms",
        statWeights: { Strength: 1, Stamina: 0, CriticalStrike: 0, Haste: 0, Mastery: 0, Versatility: 0 },
        limit: 10
      });
      const selected = upgrades.find(entry => entry.slot === slot);
      assert.ok(selected, slot + " optimizer finds an upgrade from the real API response");
      assert.equal(selected.recommendedItem.name, expectedPiece.name, slot + " optimizer selects the mapped tier piece");
      assert.equal(
        Number(selected.recommendedItem.itemLevel ?? selected.recommendedItem.level),
        Math.max(...expectedLevels),
        slot + " optimizer selects that tier piece's highest verified candidate level"
      );
    }
  } finally {
    setDiscoveryProvider(null);
    setTierSetCandidateProvider(null);
    setSectionDir(path.join(root, "data", "equipment-sections"));
    fs.rmSync(sectionDir, { recursive: true, force: true });
  }
  console.log("Warrior tier catalogue -> slot API -> optimizer integration passed for all five tier slots.");
})().catch(error => { console.error(error); process.exitCode = 1; });
