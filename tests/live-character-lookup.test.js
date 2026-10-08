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
    active_spec: { id: 73, name: { en_US: "Protection" } },
    faction: { type: "HORDE", name: { en_US: "Horde" } },
    guild: { id: 42, name: { en_US: "Example Guild" } },
    achievement_points: 12345,
    average_item_level: 700,
    equipped_item_level: 695
  },
  {
    equipped_items: [
      {
        item: { id: 1001 },
        name: { en_US: "Example Helm" },
        slot: { type: "HEAD", name: { en_US: "Head" } },
        level: 300,
        quality: { id: 4, name: { en_US: "Epic" } },
        stats: [{ type: { en_US: "Strength" }, value: 100 }],
        enchantments: [{ id: 77, name: { en_US: "Example Enchant" } }],
        gems: [{ item: { id: 88 }, name: { en_US: "Example Gem" } }]
      }
    ]
  },
  { Strength: 100, Haste: 50, _links: {} }
);

assert.strictEqual(normalized.name, "Luckranout");
assert.strictEqual(normalized.realm.slug, "area-52");
assert.strictEqual(normalized.class.name, "Warrior");
assert.strictEqual(normalized.activeSpec.name, "Protection");
assert.strictEqual(normalized.faction, "Horde");
assert.strictEqual(normalized.guild, "Example Guild");
assert.strictEqual(normalized.achievementPoints, 12345);
assert.strictEqual(normalized.averageItemLevel, 700);
assert.strictEqual(normalized.equippedItemLevel, 695);
assert.strictEqual(normalized.equipmentCount, 1);
assert.strictEqual(normalized.equipment[0].slotType, "HEAD");
assert.deepStrictEqual(normalized.equipment[0].stats, [{ type: "Strength", value: 100 }]);
assert.deepStrictEqual(normalized.equipment[0].enchantments, [{ id: 77, name: "Example Enchant", displayString: "" }]);
assert.deepStrictEqual(normalized.equipment[0].gems, [{ id: 88, name: "Example Gem", raw: { item: { id: 88 }, name: { en_US: "Example Gem" } } }]);
assert.deepStrictEqual(normalized.statistics, { Strength: 100, Haste: 50 });
assert.ok(normalized.fetchedAt);
console.log("Live character lookup tests passed.");

const realmsApi = fs.readFileSync("api/realms.js", "utf8");
assert.ok(realmsApi.includes("fetchRealms"), "Realm API must use the cached Blizzard realm loader.");
assert.ok(realmsApi.includes("s-maxage=21600"), "Realm API must advertise its cache lifetime.");
console.log("Blizzard realm API contract passed.");
