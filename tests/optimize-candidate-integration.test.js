const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");
const api = fs.readFileSync("api/slot-candidates.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

// Integration contract: Optimize must identify empty/incompatible slots, request
// candidates for those slots, merge them without duplicate item IDs, and then
// pass the combined pool to the real optimizer report.
assert.match(app, /const missingSlots = WoWOptimizer\\.slots\\.filter/);
assert.match(app, /fetch\(\x60\$\{API_BASE_URL\}\/api\/slot-candidates\?slot=/);
assert.match(app, /class=\$\{encodeURIComponent\(character\.className\)\}/);
assert.match(app, /Promise\.all\(missingSlots\.map/);
assert.match(app, /availableItems\.concat\(\.\.\.requests\)/);
assert.match(app, /const byId = new Map\(\)/);
assert.match(app, /availableItems\.splice\(0, availableItems\.length, \.\.\.byId\.values\(\)\)/);
assert.match(app, /createOptimizationReport\(\{\s*character,\s*availableItems,/);

// The endpoint must not fabricate results when the catalog file is absent or
// invalid, and must filter by explicit season verification, equippability,
// usable stats, requested slot, and class armor restrictions.
assert.match(api, /item\.isEquippable === true/);
assert.match(api, /item\.seasonScope === "Midnight Season 2\+"/);
assert.match(api, /hasUsableStats\(item\)/);
assert.match(api, /slotMatches\(item, slot\)/);
assert.match(api, /allowedForClass\(item, className, slot\)/);
assert.match(api, /Verified equipment section is not available yet; no fallback catalog was used/);

// Neck and Shoulders are mapped end-to-end and missing data remains explicit,
// rather than being mistaken for proof that no upgrade exists.
assert.match(api, /"Neck": "necklaces"/);
assert.match(api, /"Shoulders": "shoulders"/);
assert.match(html, /id="optimizeBtn"/);
assert.match(app, /no direct gear candidates ranked from the currently available dataset/);
assert.match(app, /This does not prove that no upgrades exist in game/);

console.log("Optimize-to-candidate API integration contract passed; this is a source-level test, not live Blizzard/browser verification.");
