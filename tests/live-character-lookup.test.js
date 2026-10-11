const assert = require("assert");
const { slugify, normalizeCharacter } = require("../server/blizzard-character");
const fs = require("fs");

assert.strictEqual(slugify("Area 52"), "area-52");
assert.strictEqual(slugify("Zul'jin"), "zuljin");

const normalized = normalizeCharacter(
  {
    id: 1,
    name: "Luckranout",
    level: 90,
    realm: { id: 3676, name: { en_US: "Area 52" }, slug: "area-52" },
    character_class: { id: 1, name: { en_US: "Warrior" } },
    race: { id: 2, name: { en_US: "Orc" } },
    active_spec: { id: 73, name: { en_US: "Protection" } }
  },
  {
    equipped_items: [
      {
        item: { id: 1001 },
        name: { en_US: "Example Helm" },
        slot: { type: "HEAD", name: { en_US: "Head" } },
        level: 300,
        bonus_list: [1234, 5678],
        quality: { id: 4, name: { en_US: "Epic" } }
      }
    ]
  },
  { Strength: 100, Haste: 50, _links: {} }
);

assert.strictEqual(normalized.name, "Luckranout");
assert.strictEqual(normalized.realm.slug, "area-52");
assert.strictEqual(normalized.class.name, "Warrior");
assert.strictEqual(normalized.activeSpec.name, "Protection");
assert.strictEqual(normalized.equipmentCount, 1);
assert.strictEqual(normalized.equipment[0].slotType, "HEAD");
assert.deepStrictEqual(normalized.equipment[0].bonusList, [1234, 5678]);
assert.deepStrictEqual(normalized.statistics, { Strength: 100, Haste: 50 });

// The live Blizzard statistics endpoint represents most values as nested
// objects; ensure those are flattened into the numeric baseline the optimizer expects.
const nestedStats = require("../server/blizzard-character").normalizeStatistics({
  health: 123456,
  strength: { base: 100, effective: 240 },
  agility: { base: 20, effective: 25 },
  stamina: { base: 300, effective: 500 },
  melee_crit: { rating: 620, rating_bonus: 0.12 },
  melee_haste: { rating: 810, haste_rating: 810, rating_bonus: 0.15 },
  mastery: { rating: 450, rating_bonus: 0.2 },
  versatility: { rating: 727, damage_done_bonus: 0.04 },
  _links: {},
  character: { key: "ignored" }
});
assert.deepStrictEqual(nestedStats, {
  Health: 123456, Strength: 240, Agility: 25, Stamina: 500,
  Versatility: 727, Mastery: 450, CriticalStrike: 620, Haste: 810
});
assert.ok(normalized.fetchedAt);
console.log("Live character lookup tests passed.");

const realmsApi = fs.readFileSync("api/realms.js", "utf8");
assert.ok(realmsApi.includes("fetchRealms"), "Realm API must use the cached Blizzard realm loader.");
assert.ok(realmsApi.includes("s-maxage=21600"), "Realm API must advertise its cache lifetime.");
console.log("Blizzard realm API contract passed.");
