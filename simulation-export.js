// SimulationCraft profile export.
// Produces a conservative profile from the normalized imported character.
// No external service is contacted.

const CLASS_KEYS = {
  "Death Knight": "death_knight",
  "Demon Hunter": "demon_hunter",
  Druid: "druid",
  Evoker: "evoker",
  Hunter: "hunter",
  Mage: "mage",
  Monk: "monk",
  Paladin: "paladin",
  Priest: "priest",
  Rogue: "rogue",
  Shaman: "shaman",
  Warlock: "warlock",
  Warrior: "warrior"
};

const SLOT_KEYS = {
  Head: "head", Neck: "neck", Shoulders: "shoulders", Back: "back",
  Chest: "chest", Wrists: "wrist", Hands: "hands", Waist: "waist",
  Legs: "legs", Feet: "feet", "Ring 1": "finger1", "Ring 2": "finger2",
  "Trinket 1": "trinket1", "Trinket 2": "trinket2",
  "Main Hand": "main_hand", "Off Hand": "off_hand"
};

function simcName(value) {
  return String(value || "Character")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_");
}

function simcSpec(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function createSimulationCraftProfile(character) {
  if (!character || typeof character !== "object") {
    throw new Error("A normalized character is required.");
  }

  const classKey = CLASS_KEYS[character.class?.name || character.className];
  if (!classKey) throw new Error("Unsupported character class for SimulationCraft export.");

  const lines = [
    `# WoW Gear Optimizer export`,
    `# Source: Blizzard character import`,
    `${classKey}="${simcName(character.name || character.characterName)}"`,
    `level=${Number(character.level) || 90}`
  ];

  const spec = simcSpec(character.activeSpec?.name || character.specialization);
  if (spec) lines.push(`spec=${spec}`);

  const equipment = Array.isArray(character.equipment)
    ? character.equipment
    : Object.values(character.equipment || {});

  for (const item of equipment) {
    if (!item || !item.id) continue;
    const slot = SLOT_KEYS[item.slot];
    if (!slot) continue;
    lines.push(`${slot}=,id=${Number(item.id)}`);
  }

  return lines.join("\n") + "\n";
}

if (typeof window !== "undefined") {
  window.WoWSimulationExport = { createSimulationCraftProfile };
}

if (typeof module !== "undefined") {
  module.exports = { createSimulationCraftProfile };
}
