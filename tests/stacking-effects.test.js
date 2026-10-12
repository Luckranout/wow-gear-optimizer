"use strict";

const assert = require("node:assert/strict");
const { evaluateStatEffect, evaluateItemEffects } = require("../stacking-effects");

const stackingTrinket = {
  id: "sample-stack-trinket",
  type: "stacking_stat",
  stat: "CriticalStrike",
  valuePerStack: 85,
  maxStacks: 10,
  expectedStackFraction: 0.6,
  uptime: 0.75,
  mechanicVerified: true,
  source: "verified test fixture"
};

const evaluated = evaluateStatEffect(stackingTrinket);
assert.equal(evaluated.scoreable, true);
assert.equal(evaluated.maxBonus, 850);
assert.equal(evaluated.expectedActiveStacks, 6);
assert.equal(evaluated.expectedBonus, 382.5);

const unknown = evaluateStatEffect({
  type: "stacking_stat",
  stat: "Intellect",
  valuePerStack: 561,
  maxStacks: 1,
  mechanicVerified: false,
  source: "unverified tooltip"
});
assert.equal(unknown.scoreable, false);
assert.equal(unknown.expectedBonus, null);
assert.ok(unknown.validationErrors.some(error => error.includes("not verified")));
assert.ok(unknown.validationErrors.some(error => error.includes("expectedStackFraction")));
assert.ok(unknown.validationErrors.some(error => error.includes("uptime")));

const capped = evaluateStatEffect({
  ...stackingTrinket,
  expectedStackFraction: 1,
  uptime: 1
});
assert.equal(capped.expectedBonus, 850);

const noStacks = evaluateStatEffect({
  ...stackingTrinket,
  expectedStackFraction: 0
});
assert.equal(noStacks.expectedBonus, 0);

const batch = evaluateItemEffects([stackingTrinket, unknown]);
assert.equal(batch.length, 2);
assert.equal(batch[0].scoreable, true);
assert.equal(batch[1].scoreable, false);

assert.throws(() => evaluateItemEffects(null), /array/);
console.log("Stacking item effect model tests passed.");
