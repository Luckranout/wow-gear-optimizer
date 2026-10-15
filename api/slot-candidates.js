const fs = require("fs");
const path = require("path");
const { setCorsHeaders } = require("./cors");

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
  const inv = String(item.inventoryType?.name || item.inventoryType || "").toLowerCase();
  if (slot === "Ring 1" || slot === "Ring 2") return /finger|ring/.test(inv);
  if (slot === "Trinket 1" || slot === "Trinket 2") return /trinket/.test(inv);
  if (slot === "Main Hand") return /main.?hand|two.?hand|weapon|staff|sword|axe|mace|dagger|polearm|fist|bow|gun|crossbow/.test(inv);
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
  const subclass = String(item.itemSubclass?.name || item.itemSubclass || "").toLowerCase();
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
  const raw = String(value?.name || value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("staff")) return "staff";
  if (raw.includes("fist")) return "fist weapon";
  if (raw.includes("polearm")) return "polearm";
  if (raw.includes("crossbow")) return "crossbow";
  if (raw.includes("bow")) return "bow";
  if (raw.includes("gun")) return "gun";
  if (raw.includes("dagger")) return "dagger";
  if (raw.includes("wand")) return "wand";
  if (raw.includes("sword")) return raw.includes("one-hand") ? "one-hand sword" : "sword";
  if (raw.includes("axe")) return raw.includes("one-hand") ? "one-hand axe" : "axe";
  if (raw.includes("mace")) return raw.includes("one-hand") ? "one-hand mace" : "mace";
  if (raw.includes("shield") || raw.includes("held in off-hand") || raw.includes("off-hand")) return "off-hand";
  if (raw.includes("two-hand")) return "two-hand";
  if (raw.includes("one-hand")) return "one-hand";
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
      String(specialization || "").trim().toLowerCase() !== "enhancement" ||
      (slot !== "Main Hand" && slot !== "Off Hand")) return true;
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
  const values = item.stats ?? item.statValues ?? item.stat_values ?? item.attributes;
  if (Array.isArray(values)) return values.some(stat => Number(stat?.value ?? stat?.amount ?? stat) > 0);
  if (values && typeof values === "object") return Object.values(values).some(value => Number(value?.value ?? value?.amount ?? value) > 0);
  return Number(item.intellect || item.strength || item.agility || item.stamina || 0) > 0;
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
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    if (payload.complete !== true || !Array.isArray(payload.items)) {
      return res.status(503).json({ error: "This equipment section is not validated yet." });
    }
    const items = payload.items.filter(item =>
      item.isEquippable === true &&
      item.seasonScope === "Midnight Season 2+" &&
      hasUsableStats(item) &&
      slotMatches(item, slot) &&
      allowedForClass(item, className, slot) &&
      allowedForClassWeapon(item, className, slot) &&
      allowedForSpecialization(item, className, specialization, slot)
    );
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ slot, section, count: items.length, items, coverage: items.length ? "candidates-available" : "no-validated-compatible-candidates", source: "verified-season-section-cache" });
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return res.status(503).json({ error: "Verified equipment section is not available yet; no fallback catalog was used." });
    }
    return res.status(500).json({ error: "Unable to load the verified equipment section." });
  }
}
handler._test = {
  SLOT_SECTION, slotMatches, allowedForClass, allowedForClassWeapon, allowedForSpecialization, normalizeWeaponType, normalizeClass, hasUsableStats,
  createResponse,
  setSectionDir(dir) { sectionDir = dir; }
};
module.exports = handler;
