const fs = require("node:fs");
const vm = require("node:vm");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

for (const scenario of [
  { className: "Monk", specialization: "Windwalker", armor: "leather", primary: "Agility" },
  { className: "Warrior", specialization: "Arms", armor: "plate", primary: "Strength" },
  { className: "Shaman", specialization: "Enhancement", armor: "mail", primary: "Agility" }
]) {
  const candidate = {
    id: 268240, name: "Restless Spirit Shackles", slot: "Wrists",
    itemLevel: 219, level: 219,
    inventoryType: { name: "Wrist" }, itemClass: { name: "Armor" },
    itemSubclass: { name: scenario.armor }, seasonScope: "Midnight Season 2+",
    stats: [{ type: { name: scenario.primary }, value: 10 }, { type: { name: "Haste" }, value: 5 }],
    variants: [{
      variantKey: "wowhead:upgd6:ilvl334", itemLevel: 334, level: 334,
      upgradeRank: 6, stats: { [scenario.primary]: 36, Stamina: 565, CriticalStrike: 40, Haste: 21 },
      statsSource: "Wowhead live tooltip", variantSource: "Wowhead live tooltip explicitly resolved upgrade rank 6",
      lookupStatus: "verified"
    }]
  };
  const current = {
    id: 99999, name: "Currently Equipped Wrists", slot: "Wrists", itemLevel: 305,
    inventoryType: { name: "Wrist" }, itemClass: { name: "Armor" },
    itemSubclass: { name: scenario.armor },
    stats: { [scenario.primary]: 25, Haste: 10, CriticalStrike: 10, Stamina: 100 }
  };
  const upgrades = optimizer.findUpgradeOpportunities({
    currentEquipment: { Wrists: current },
    availableItems: [candidate], goal: "General / All-around",
    className: scenario.className, specialization: scenario.specialization, limit: 10
  });
  const selected = upgrades.find(entry => entry.recommendedItem?.id === 268240);
  if (!selected) throw new Error(scenario.className + ": verified upgraded variant was not selected");
  if (Number(selected.recommendedItem.itemLevel ?? selected.recommendedItem.level) !== 334) {
    throw new Error(scenario.className + ": scorer used base item level instead of Wowhead level 334");
  }
  if (selected.recommendedItem.statsSource !== "Wowhead live tooltip") {
    throw new Error(scenario.className + ": selected item lost Wowhead provenance");
  }
}
console.log("Wowhead upgraded item scoring integration passed for Monk, Warrior, and Shaman.");
