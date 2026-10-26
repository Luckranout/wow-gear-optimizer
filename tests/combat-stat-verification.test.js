const assert = require("node:assert/strict");
const verification = require("../combat-stat-verification");

const incompleteBelt = {
  id: 251144,
  name: "Autumn's Boon Belt",
  slot: "Waist",
  stats: [
    { type: { name: "strength" }, value: 50 },
    { type: { name: "stamina" }, value: 500 }
  ],
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

assert.equal(verification.requiresPrimaryStat("Waist"), true);
assert.equal(verification.requiresPrimaryStat("Main Hand"), true);
assert.equal(verification.requiresPrimaryStat("Off Hand"), true);
assert.equal(verification.requiresPrimaryStat("Back"), false);
assert.equal(verification.requiresPrimaryStat("Neck"), false);
assert.equal(verification.requiresPrimaryStat("Trinket 1"), false);
assert.equal(verification.hasVerifiedCombatStats(incompleteBelt), false,
  "placeholder Strength on the base record must not validate an upgraded variant missing Strength");

const lookupVariants = [
  {
    itemLevel: 334,
    variantKey: "missing-primary",
    stats: { Armor: 245, Stamina: 2932, Versatility: 59, Mastery: 91 }
  },
  {
    itemLevel: 334,
    variantKey: "wowhead:verified-strength",
    stats: {
      Strength: 189,
      Stamina: 2932,
      Versatility: 59,
      Mastery: 91
    }
  },
  {
    itemLevel: 0,
    variantKey: "invalid-level",
    stats: { Strength: 189, Stamina: 2932 }
  }
];
const filtered = verification.filterVerifiedVariants(incompleteBelt, lookupVariants);
assert.deepEqual(filtered.map(variant => variant.variantKey), ["wowhead:verified-strength"],
  "only positive-level armor variants with an actual primary stat may be scored");
assert.equal(verification.hasVerifiedCombatStats({ ...incompleteBelt, variants: filtered }), true);

const weapon = {
  slot: "Main Hand",
  stats: { Strength: 100, Stamina: 200 },
  variants: [{ itemLevel: 334, stats: { Stamina: 2932, Haste: 90, Mastery: 50 } }]
};
assert.equal(verification.hasVerifiedCombatStats(weapon), false,
  "weapon base stats cannot mask an upgraded variant missing its primary stat");

const cloak = {
  slot: "Back",
  stats: [],
  variants: [{ itemLevel: 334, stats: { Stamina: 2932, Haste: 90 } }]
};
assert.equal(verification.hasVerifiedCombatStats(cloak), true,
  "secondary stats remain valid for slots that do not use primary stats");

console.log("Primary-stat variant verification tests passed.");
