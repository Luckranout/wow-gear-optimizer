const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
assert(app.includes("retailDataset.apiCheck?.itemStatCoverage"), "status must use imported item-stat coverage metadata");
assert(app.includes("withStats === 0"), "zero-stat catalog must be detected");
assert(app.includes("item stats unavailable; gear recommendations disabled"), "zero-stat catalog must display a clear warning");
assert(app.includes("completeness not verified"), "nonzero stat presence must not be described as complete coverage");
assert(app.includes('statusNode.classList.add("error")'), "unusable catalog status must use warning styling");

console.log("Catalog readiness status UI tests passed.");
