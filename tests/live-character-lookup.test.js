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
assert.deepStrictEqual(normalized.statistics, { Strength: 100, Haste: 50 });
assert.ok(normalized.fetchedAt);

const structuredStats = require("../server/blizzard-character").normalizeStatistics({
  strength: { base: 100, effective: 125 },
  critical_strike: { rating: 840, rating_bonus: 12.5 },
  haste: { rating: 700, rating_bonus: 8.4 },
  mastery: { rating: 500, rating_bonus: 9.1 },
  versatility: 727,
  _links: { self: "ignored" },
  character: { key: "ignored" }
});
assert.deepStrictEqual(structuredStats, {
  Strength: 125, CriticalStrike: 840, Haste: 700, Mastery: 500, Versatility: 727
});

const { normalizeEquippedItem } = require("../server/blizzard-character");
assert.strictEqual(normalizeEquippedItem({
  item: { id: 9 }, name: { en_US: "Test Bracers" },
  slot: { type: "WRIST", name: { en_US: "Wrist" } }
}).slot, "Wrists");
assert.strictEqual(normalizeEquippedItem({
  item: { id: 10 }, name: { en_US: "Test Ring" },
  slot: { type: "FINGER", name: { en_US: "Finger" } }
}).slot, "Finger");

console.log("Live character lookup tests passed.");

const realmsApi = fs.readFileSync("api/realms.js", "utf8");
assert.ok(realmsApi.includes("fetchRealms"), "Realm API must use the cached Blizzard realm loader.");
assert.ok(realmsApi.includes("s-maxage=21600"), "Realm API must advertise its cache lifetime.");
console.log("Blizzard realm API contract passed.");


const { normalizeBlizzardItemSearchResult } = require("../server/blizzard-character");
const liveNeck = normalizeBlizzardItemSearchResult({
  data: {
    id: 271900,
    name: { en_US: "Live Season Neck" },
    level: 310,
    inventory_type: { type: "NECK", name: { en_US: "Neck" } },
    item_class: { id: 4, name: { en_US: "Armor" } },
    item_subclass: { id: 0, name: { en_US: "Miscellaneous" } },
    is_equippable: true,
    stats: [{ type: { name: "Haste" }, value: 120 }]
  }
});
assert.strictEqual(liveNeck.slot, "Neck");
assert.strictEqual(liveNeck.itemLevel, 310);
assert.strictEqual(liveNeck.isEquippable, true);
assert.strictEqual(liveNeck.source, "Live Blizzard Item Search API");
const liveShoulders = normalizeBlizzardItemSearchResult({
  data: {
    id: 271481,
    name: { en_US: "Hissing Mantle of the Ophidian Oracle" },
    level: 219,
    inventory_type: { type: "SHOULDER", name: { en_US: "Shoulder" } },
    item_class: { id: 4, name: { en_US: "Armor" } },
    item_subclass: { id: 3, name: { en_US: "Mail" } },
    is_equippable: true,
    stats: [{ type: { name: "Haste" }, value: 56 }]
  }
});
assert.strictEqual(liveShoulders.slot, "Shoulders");
assert.strictEqual(liveShoulders.id, 271481);
assert.strictEqual(normalizeBlizzardItemSearchResult({ data: { id: 4, name: "Wrong slot", inventory_type: { type: "HEAD", name: { en_US: "Head" } } } }).slot, null);

const slotCandidatesApi = fs.readFileSync("api/slot-candidates.js", "utf8");
assert.ok(slotCandidatesApi.includes("fetchSlotCandidates"), "Slot candidate endpoint must query Blizzard directly.");
assert.ok(slotCandidatesApi.includes("Only Neck and Shoulders"), "Slot candidate endpoint must restrict requested slots.");
console.log("Live Blizzard Neck/Shoulder candidate normalization tests passed.");
