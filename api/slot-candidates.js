const fs = require("fs");
const path = require("path");
const { setCorsHeaders } = require("./cors");
const { searchItemIds, getItem } = require("../server/blizzard-item-catalog");

let sectionDir = path.join(process.cwd(), "data", "equipment-sections");
const SLOT_SECTION = {
  "Head": "head", "Neck": "necklaces", "Shoulders": "shoulders",
  "Back": "back", "Chest": "chest", "Wrists": "wrists", "Hands": "hands",
  "Waist": "waist", "Legs": "legs", "Feet": "feet",
  "Ring 1": "rings", "Ring 2": "rings",
  "Trinket 1": "trinkets", "Trinket 2": "trinkets",
  "Main Hand": "main-hand", "Off Hand": "off-hand"
};
const CLASS_ARMOR = {
  warrior: "plate", paladin: "plate", deathknight: "plate",
  hunter: "mail", shaman: "mail", evoker: "mail",
  demonhunter: "leather", druid: "leather", monk: "leather", rogue: "leather",
  mage: "cloth", priest: "cloth", warlock: "cloth"
};
const ARMOR_SLOTS = new Set(["Head", "Shoulders", "Chest", "Wrists", "Hands", "Waist", "Legs", "Feet"]);

function normalizeClass(value) {
  return String(value || "").toLowerCase().replace(/[\s'_-]/g, "");
}
function slotMatches(item, slot) {
  // Prefer the importer's canonical Blizzard metadata mapping when present.
  // Older catalog records without this field continue through compatibility aliases.
  const expectedSection = SLOT_SECTION[slot];
  if (Array.isArray(item.equipmentCategories)) {
    return Boolean(expectedSection && item.equipmentCategories.includes(expectedSection));
  }
  const inv = String(item.inventoryType?.name || item.inventoryType || "").toLowerCase();
  if (slot === "Ring 1" || slot === "Ring 2") return /finger|ring/.test(inv);
  if (slot === "Trinket 1" || slot === "Trinket 2") return /trinket/.test(inv);
  if (slot === "Main Hand") {
    const itemClass = String(item.itemClass?.name || item.itemClass || "").toLowerCase();
    return /main.?hand|two.?hand|weapon|staff|sword|axe|mace|dagger|polearm|fist|bow|gun|crossbow/.test(inv) ||
      (/(one.?hand|main.?hand)/.test(inv) && /weapon/.test(itemClass));
  }
  if (slot === "Off Hand") return /off.?hand|shield|holdable|offhand/.test(inv) ||
    Boolean(item.equipSlots && Array.isArray(item.equipSlots) && item.equipSlots.includes("Off Hand"));
  if (item.slot === slot) return true;
  const aliases = {
    Head: /head/, Neck: /neck/, Shoulders: /shoulder/, Back: /cloak|back/,
    Chest: /chest|robe/, Wrists: /wrist/, Hands: /hand/, Waist: /waist/,
    Legs: /legs|leg/, Feet: /feet/
  };
  return aliases[slot]?.test(inv) || false;
}
function allowedForClass(item, className, slot) {
  if (!ARMOR_SLOTS.has(slot)) return true;
  const expected = CLASS_ARMOR[normalizeClass(className)];
  if (!expected) return false;
  const itemClass = String(item.itemClass?.name || item.itemClass || "").toLowerCase();
  const rawSubclass = String(item.itemSubclass?.name || item.itemSubclass || "").toLowerCase();
  const subclass = /\\bcloth\\b/.test(rawSubclass) ? "cloth"
    : /\\bleather\\b/.test(rawSubclass) ? "leather"
      : /\\bmail\\b/.test(rawSubclass) ? "mail"
        : /\\bplate\\b/.test(rawSubclass) ? "plate" : "";
  return (itemClass.includes("armor") || itemClass.includes("armour")) && subclass === expected;
}
const CLASS_WEAPONS = {
  warrior: ["axe", "dagger", "fist weapon", "gun", "mace", "polearm", "staff", "sword", "bow", "crossbow"],
  paladin: ["axe", "mace", "polearm", "sword"],
  hunter: ["axe", "dagger", "fist weapon", "gun", "polearm", "staff", "sword", "bow", "crossbow"],
  rogue: ["axe", "dagger", "fist weapon", "gun", "mace", "sword", "bow", "crossbow"],
  priest: ["dagger", "mace", "staff", "wand"],
  shaman: ["axe", "dagger", "fist weapon", "mace", "staff"],
  mage: ["dagger", "sword", "staff", "wand"],
  warlock: ["dagger", "sword", "staff", "wand"],
  monk: ["axe", "fist weapon", "polearm", "staff", "sword"],
  druid: ["dagger", "fist weapon", "mace", "polearm", "staff"],
  demonhunter: ["fist weapon", "one-hand sword", "one-hand axe", "one-hand mace"],
  deathknight: ["axe", "mace", "polearm", "sword"],
  evoker: ["axe", "dagger", "mace", "sword", "staff"]
};
function normalizeWeaponType(value) {
  const raw = String(value?.name || value || "").trim().toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\\b(two|one) handed\\b/g, "$1 hand");
  if (!raw || /^(weapon|melee|ranged|miscellaneous|unknown)$/.test(raw)) return "";
  if (raw.includes("shield") || raw.includes("held in off hand") || raw.includes("off hand")) return "off-hand";
  // Classify weapon family before handedness: "Two-Handed Swords" is a sword.
  if (raw.includes("staff") || raw.includes("staves")) return "staff";
  if (raw.includes("fist")) return "fist weapon";
  if (raw.includes("polearm")) return "polearm";
  if (raw.includes("crossbow")) return "crossbow";
  if (raw.includes("bow")) return "bow";
  if (raw.includes("gun")) return "gun";
  if (raw.includes("dagger")) return "dagger";
  if (raw.includes("wand")) return "wand";
  if (raw.includes("sword")) return "sword";
  if (raw.includes("axe")) return "axe";
  if (raw.includes("mace")) return "mace";
  if (raw.includes("glaive")) return "warglaive";
  if (raw.includes("two hand")) return "two-hand";
  if (raw.includes("one hand")) return "one-hand";
  return "";
}
function allowedForClassWeapon(item, className, slot) {
  if (slot !== "Main Hand" && slot !== "Off Hand") return true;
  const allowed = CLASS_WEAPONS[normalizeClass(className)];
  if (!allowed) return false;
  const type = normalizeWeaponType(item.itemSubclass || item.weaponType || item.inventoryType);
  // A weapon with no recognizable subclass is not safe to recommend.
  if (!type) return false;
  if (type === "off-hand") return slot === "Off Hand";
  if (slot === "Off Hand" && (type === "staff" || type === "two-hand")) return false;
  return allowed.includes(type) || (type === "one-hand" && allowed.some(value =>
    ["axe", "dagger", "fist weapon", "mace", "sword"].includes(value)
  ));
}
function allowedForSpecialization(item, className, specialization, slot) {
  if (normalizeClass(className) !== "shaman" ||
      String(specialization || "").trim().toLowerCase() !== "enhancement") return true;

  // Enhancement is Agility-based; don't return static-Intellect caster items,
  // including trinkets and records whose upgraded variant supplies the stats.
  const hasIntellect = record => {
    const entries = Array.isArray(record?.stats)
      ? record.stats
      : record?.stats && typeof record.stats === "object"
        ? Object.entries(record.stats).map(([name, value]) => ({ name, value }))
        : [];
    return entries.some(stat => {
      const rawName = stat?.type?.name || stat?.name || stat?.type || stat?.stat || "";
      const name = String(rawName).replace(/[\s_-]/g, "").toLowerCase();
      return (name === "intellect" || name === "int") && Number(stat?.value ?? stat?.amount) > 0;
    });
  };
  if (hasIntellect(item) || (Array.isArray(item?.variants) && item.variants.some(hasIntellect))) return false;

  if (slot !== "Main Hand" && slot !== "Off Hand") return true;
  const type = normalizeWeaponType(item.itemSubclass || item.weaponType || item.inventoryType);
  const inventory = String(item.inventoryType?.name || item.inventoryType || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();
  if (type === "staff" || inventory.includes("staff") || name.includes("staff")) return false;
  if (slot === "Off Hand" && (type === "two-hand" || /two.?hand/.test(inventory))) return false;
  if (slot === "Main Hand" && (type === "two-hand" || /two.?hand/.test(inventory)) &&
      !(type === "mace" || name.includes("mace"))) return false;
  return true;
}

function hasUsableStats(item) {
  // Blizzard's base item record can contain placeholder/low-level stats while
  // a verified Wowhead variant carries the usable upgraded stats. Evaluate
  // both the base record and attached variants so the API does not discard an
  // item before optimizer.js can expand its variants.
  const hasStats = candidate => {
    const values = candidate?.stats ?? candidate?.statValues ?? candidate?.stat_values ?? candidate?.attributes;
    if (Array.isArray(values)) return values.some(stat => Number(stat?.value ?? stat?.amount ?? stat) > 0);
    if (values && typeof values === "object") return Object.values(values).some(value => Number(value?.value ?? value?.amount ?? value) > 0);
    return Number(candidate?.intellect || candidate?.strength || candidate?.agility || candidate?.stamina || 0) > 0;
  };
  return hasStats(item) || (Array.isArray(item.variants) && item.variants.some(hasStats));
}
const SLOT_INVENTORY_SEARCHES = {
  Head: ["HEAD"], Neck: ["NECK"], Shoulders: ["SHOULDER"], Back: ["CLOAK"],
  Chest: ["CHEST", "ROBE"], Wrists: ["WRIST"], Hands: ["HAND"], Waist: ["WAIST"],
  Legs: ["LEGS"], Feet: ["FEET"], "Ring 1": ["FINGER"], "Ring 2": ["FINGER"],
  "Trinket 1": ["TRINKET"], "Trinket 2": ["TRINKET"],
  "Main Hand": ["WEAPON", "WEAPONMAINHAND", "TWOHWEAPON"],
  "Off Hand": ["WEAPON", "WEAPONOFFHAND", "HOLDABLE", "SHIELD"]
};
let discoveryEnabled = true;
let discoveryProvider = null;
async function discoverSlotItems(slot) {
  if (!discoveryEnabled) return [];
  const ids = await searchItemIds(SLOT_INVENTORY_SEARCHES[slot] || [], { limit: 40 });
  const results = await Promise.all(ids.map(async id => {
    try { const result = await getItem(id); return result.item || null; }
    catch (_) { return null; }
  }));
  return results.filter(Boolean).map(item => ({ ...item, discoveredOnDemand: true }));
}
function createResponse() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}
async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const slot = String(req.query?.slot || "");
  const section = SLOT_SECTION[slot];
  const className = String(req.query?.class || "");
  const specialization = String(req.query?.specialization || "");
  if (!section) return res.status(400).json({ error: "Unsupported equipment slot." });
  if (!className) return res.status(400).json({ error: "Class is required to enforce armor restrictions." });
  const file = path.join(sectionDir, section + ".json");
  let payload = { complete: true, items: [] };
  let sectionCacheAvailable = false;
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (saved.complete === true && Array.isArray(saved.items)) { payload = saved; sectionCacheAvailable = true; }
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  try {
    let discovered = [];
    let discoveryError = null;
    try { discovered = await (discoveryProvider ? discoveryProvider(slot) : discoverSlotItems(slot)); }
    catch (error) { discoveryError = error.publicMessage || "Blizzard item discovery failed."; }
    const knownIds = new Set(payload.items.map(item => Number(item.id)));
    const newDiscovery = discovered.filter(item => !knownIds.has(Number(item.id)));
    const allRecords = [...payload.items, ...newDiscovery];
    if (!sectionCacheAvailable && !discovered.length) {
      return res.status(503).json({ error: discoveryError || "Neither a validated section cache nor Blizzard discovery is available." });
    }
    const eligibleByMetadata = allRecords.filter(item =>
      item.isEquippable === true &&
      item.seasonScope === "Midnight Season 2+" &&
      slotMatches(item, slot) &&
      allowedForClass(item, className, slot) &&
      allowedForClassWeapon(item, className, slot) &&
      allowedForSpecialization(item, className, specialization, slot)
    );
    const items = eligibleByMetadata.filter(hasUsableStats);
    const pendingStatVerification = allRecords
      .filter(item => item.isEquippable === true && slotMatches(item, slot) &&
        allowedForClass(item, className, slot) && allowedForClassWeapon(item, className, slot) &&
        allowedForSpecialization(item, className, specialization, slot) && !hasUsableStats(item))
      .slice(0, 8).map(item => ({ ...item, requiresWowheadVerification: true }));
    const pendingSeasonVerification = newDiscovery.filter(item => item.seasonEligibility !== "verified");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      slot, section, count: items.length, items, pendingStatVerification,
      pendingStatVerificationCount: pendingStatVerification.length,
      discoveredCount: newDiscovery.length, discoveredItems: newDiscovery,
      pendingSeasonVerificationCount: pendingSeasonVerification.length,
      discoveryError,
      coverage: items.length ? "candidates-available" : pendingSeasonVerification.length
        ? "blizzard-items-discovered-season-verification-required"
        : pendingStatVerification.length ? "combat-stats-require-wowhead-verification" : "no-validated-compatible-candidates",
      source: sectionCacheAvailable ? "blizzard-on-demand-plus-section-cache" : "blizzard-on-demand"
    });
  } catch (error) {
    return res.status(500).json({ error: "Unable to retrieve slot candidates." });
  }
}
handler._test = {
  SLOT_SECTION, slotMatches, allowedForClass, allowedForClassWeapon, allowedForSpecialization, normalizeWeaponType, normalizeClass, hasUsableStats,
  createResponse,
  setSectionDir(dir) { sectionDir = dir; },
  setDiscoveryEnabled(value) { discoveryEnabled = Boolean(value); },
  setDiscoveryProvider(fn) { discoveryProvider = typeof fn === "function" ? fn : null; },
  discoverSlotItems
};
module.exports = handler;
