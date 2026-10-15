const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");
const api = fs.readFileSync("api/slot-candidates.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

// Integration contract: Optimize must identify empty/incompatible slots, request
// candidates for those slots, merge them without duplicate item IDs, and then
// pass the combined pool to the real optimizer report.
assert.match(app, /const missingSlots = WoWOptimizer\.slots\.filter/);
assert.match(app, /const url = `\$\{API_BASE_URL\}\/api\/slot-candidates\?slot=/);
assert.match(app, /fetch\(url\)/);
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

// Crafted gear outputs must be discovered before section IDs are collected,
// then explicitly included alongside independently verified PvE/PvP sources.
const importer = fs.readFileSync("scripts/import_blizzard_data.py", "utf8");
assert.ok(importer.indexOf("profession_recipes, profession_output_ids = collect_profession_supporting_data(token)") < importer.indexOf("section_ids, section_item_sources = collect_equipment_section_ids("));
assert.match(importer, /crafted_gear_ids\s*=\s*\{/);
assert.match(importer, /set\(pve_sources\)\s*\|\s*set\(pvp_sources\)\s*\|\s*crafted_gear_ids/);
assert.match(importer, /"category": "Crafted Gear"/);

console.log("Optimize-to-candidate API integration contract passed; this is a source-level test, not live Blizzard/browser verification.");
