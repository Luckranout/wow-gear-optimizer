"use strict";
const assert = require("node:assert/strict");
const { makeBatches } = require("../scripts/export-wow-tooltip-item-ids");
assert.deepEqual(makeBatches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(makeBatches([], 200), []);
assert.throws(() => makeBatches([1], 201), /1 to 200/);
console.log("WoW tooltip item ID batch tests passed.");
