const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const api = require("../api/slot-candidates");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), context);
const optimizer = context.window.WoWOptimizer;

const intellectTrinket = {
  id: 1, name: "Caster Trinket", slot: "Trinket 1",
  stats: [{ type: { name: "intellect" }, value: 593 }]
};
const agilityTrinket = {
  id: 2, name: "Agility Trinket", slot: "Trinket 1",
  stats: [{ type: { name: "agility" }, value: 125 }]
};
const variantIntellectItem = {
  id: 3, name: "Variant Caster Trinket", slot: "Trinket 1",
  stats: [{ type: { name: "haste" }, value: 20 }],
  variants: [{ level: 340, stats: [{ type: { name: "intellect" }, value: 593 }] }]
};

assert.equal(
  api._test.allowedForSpecialization(intellectTrinket, "Shaman", "Enhancement", "Trinket 1"),
  false,
  "candidate API excludes static Intellect trinkets for Enhancement"
);
assert.equal(
  api._test.allowedForSpecialization(agilityTrinket, "Shaman", "Enhancement", "Trinket 1"),
  true,
  "candidate API retains Agility trinkets for Enhancement"
);
assert.equal(
  api._test.allowedForSpecialization(intellectTrinket, "Shaman", "Elemental", "Trinket 1"),
  true,
  "Elemental Shaman remains eligible for Intellect trinkets"
);
assert.equal(
  optimizer.itemAllowedForSpecialization(intellectTrinket, "Trinket 1", "Shaman", "Enhancement"),
  false,
  "optimizer excludes static Intellect trinkets for Enhancement"
);
assert.equal(
  optimizer.itemAllowedForSpecialization(variantIntellectItem, "Trinket 1", "Shaman", "Enhancement"),
  false,
  "optimizer also checks upgraded variant stats"
);
assert.equal(
  optimizer.itemAllowedForSpecialization(agilityTrinket, "Trinket 1", "Shaman", "Enhancement"),
  true,
  "optimizer retains Agility trinkets"
);
const weights = optimizer.resolveStatWeights({ className: "Shaman", specialization: "Enhancement" });
assert.equal(weights.Intellect, 0, "Enhancement Intellect weight must be zero");
assert.equal(weights.Strength, 0, "Enhancement Strength weight must be zero");
console.log("Enhancement Shaman primary-stat eligibility regression passed.");
