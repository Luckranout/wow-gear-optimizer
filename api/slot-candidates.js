const fs = require("fs");
const path = require("path");
const { setCorsHeaders } = require("./cors");

const SECTION_DIR = path.join(process.cwd(), "data", "equipment-sections");
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
  if (slot === "Ring 1" || slot === "Ring 2") return /finger|ring/i.test(String(item.inventoryType?.name || item.inventoryType || ""));
  if (slot === "Trinket 1" || slot === "Trinket 2") return /trinket/i.test(String(item.inventoryType?.name || item.inventoryType || ""));
  if (slot === "Main Hand" || slot === "Off Hand") {
    const inv = String(item.inventoryType?.name || item.inventoryType || "").toLowerCase();
    if (slot === "Off Hand") return /off.?hand|shield|holdable/i.test(inv) || /one.?hand/i.test(inv);
    return /main.?hand|two.?hand|weapon|staff|sword|axe|mace|dagger|polearm|fist|bow|gun|crossbow/i.test(inv);
  }
  if (item.slot === slot) return true;
  const inv = String(item.inventoryType?.name || item.inventoryType || "").toLowerCase();
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
async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const slot = String(req.query?.slot || "");
  const section = SLOT_SECTION[slot];
  const className = String(req.query?.class || "");
  if (!section) return res.status(400).json({ error: "Unsupported equipment slot." });
  if (!className) return res.status(400).json({ error: "Class is required to enforce armor restrictions." });
  const file = path.join(SECTION_DIR, section + ".json");
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    if (payload.complete !== true || !Array.isArray(payload.items)) {
      return res.status(503).json({ error: "This equipment section is not validated yet." });
    }
    const items = payload.items.filter(item =>
      item.isEquippable === true &&
      item.seasonScope === "Midnight Season 2+" &&
      slotMatches(item, slot) &&
      allowedForClass(item, className, slot)
    );
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ slot, section, count: items.length, items, source: "verified-season-section-cache" });
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return res.status(503).json({ error: "Verified equipment section is not available yet; no fallback catalog was used." });
    }
    return res.status(500).json({ error: "Unable to load the verified equipment section." });
  }
};

handler._test = { SLOT_SECTION, slotMatches, allowedForClass, normalizeClass };
module.exports = handler;
