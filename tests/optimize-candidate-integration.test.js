const fs = require("node:fs");
const assert = require("node:assert/strict");

const app = fs.readFileSync("app.js", "utf8");
const api = fs.readFileSync("api/slot-candidates.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

// Integration contract: Optimize requests verified candidates for every slot.
// A local item does not prove the section catalog is complete; sparse local data
// must not hide valid upgrades from the on-demand candidate API.
assert.match(app, /const candidateSlots = WoWOptimizer\.slots/);
assert.doesNotMatch(app, /const missingSlots = WoWOptimizer\.slots\.filter/);
assert.match(app, /const url = `\$\{API_BASE_URL\}\/api\/slot-candidates\?slot=/);
assert.match(app, /fetch\(url\)/);
assert.match(app, /class=\$\{encodeURIComponent\(character\.className\)\}/);
assert.match(app, /Promise\.all\(candidateSlots\.map/);
assert.match(app, /requests\.map\(request => request\.items\)\.flat\(\)\.concat\(availableItems\)/);
assert.match(app, /const byId = new Map\(\)/);
assert.match(app, /availableItems\.splice\(0, availableItems\.length, \.\.\.byId\.values\(\)\)/);
assert.match(app, /createOptimizationReport\(\{\s*character,\s*availableItems,/);

// Missing-stat seasonal records are held out of scoring until Wowhead confirms
// positive passive combat stats and an explicit item level. The app performs this
// bounded pre-score resolution and enriches an existing catalog duplicate by ID.
assert.match(api, /pendingStatVerification/);
assert.match(api, /!hasUsableStats\(item\)/);
assert.match(api, /requiresWowheadVerification: true/);
const optimizer = fs.readFileSync("optimizer.js", "utf8");
assert.match(app, /const pendingLookupIds = \[\.\.\.pendingById\.keys\(\)\]\.slice\(0, 24\)/);
assert.match(app, /const discoveredItems = Array\.isArray\(payload\.discoveredItems\)/);
assert.match(app, /const verificationCandidates = requests\.flatMap/);
assert.match(app, /seasonScope !== "Midnight Season 2\+"/);
assert.match(optimizer, /"Main Hand": "Off Hand", "Off Hand": "Main Hand"/);
assert.match(optimizer, /Enforce uniqueness for both weapon hands on every whole-loadout pass/);
assert.match(app, /Number\(variant\?\.itemLevel\) > 0 && hasPositiveStats/);
assert.match(app, /preScoreWowheadVerified\+\+/);
assert.match(app, /const existing = byId\.get\(String\(id\)\)/);
assert.match(app, /Resolve the items the optimizer is actually proposing against live Wowhead/);
assert.match(app, /renderItemHoverTooltip\(upgrade\.currentItem\)/);
assert.match(app, /renderItemHoverTooltip\(upgrade\.recommendedItem\)/);
assert.match(app, /displayItemLevel\(upgrade\.recommendedItem\?\.itemLevel \?\? upgrade\.recommendedItem\?\.level\)/);


// Base-level catalog records must not displace a higher-item-level equipped variant.
assert.match(optimizer, /candidateLevel < equippedLevel\) continue/);
assert.match(optimizer, /meetsEquippedLevel\(item, firstSlot\)/);
assert.match(optimizer, /meetsEquippedLevel\(item, secondSlot\)/);
assert.match(optimizer, /Array\.isArray\(rawItem\.variants\)/);
assert.match(optimizer, /for \(const rawItem of expandedItems\)/);

// The endpoint must not fabricate results when the catalog file is absent or
// invalid, and must filter by explicit season verification, equippability,
// usable stats, requested slot, and class armor restrictions.
assert.match(api, /item\.isEquippable === true/);
assert.match(api, /item\.seasonScope === "Midnight Season 2\+"/);
assert.match(api, /hasUsableStats\(item\)/);
assert.match(api, /slotMatches\(item, slot\)/);
assert.match(api, /allowedForClass\(item, className, slot\)/);
assert.match(api, /Neither a validated section cache nor Blizzard discovery is available/);

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
