// WoW Gear Optimizer
// Core optimization engine
// Retail / current-season ready.

const WOW_EQUIPMENT_SLOTS = [
  "Head","Neck","Shoulders","Back","Chest","Wrists","Hands","Waist",
  "Legs","Feet","Ring 1","Ring 2","Trinket 1","Trinket 2","Main Hand","Off Hand"
];

const WOW_GOALS = {
  mythicPlus: "Mythic+",
  raid: "Raid",
  pvp: "PvP",
  solo: "Solo / Open World",
  general: "General / All-around"
};

const CLASS_ARMOR_TYPE = {
  warrior: "plate",
  paladin: "plate",
  deathknight: "plate",
  hunter: "mail",
  shaman: "mail",
  evoker: "mail",
  demonhunter: "leather",
  druid: "leather",
  monk: "leather",
  rogue: "leather",
  mage: "cloth",
  priest: "cloth",
  warlock: "cloth"
};

const ARMOR_SLOTS = new Set(["Head", "Shoulders", "Chest", "Wrists", "Hands", "Waist", "Legs", "Feet"]);
const CLASS_WEAPON_PROFICIENCIES = {
  warrior: ["axe", "dagger", "fist weapon", "gun", "mace", "polearm", "staff", "sword", "bow", "crossbow"],
  paladin: ["axe", "mace", "polearm", "sword"],
  hunter: ["axe", "dagger", "fist weapon", "gun", "polearm", "staff", "sword", "bow", "crossbow"],
  rogue: ["axe", "dagger", "fist weapon", "mace", "sword", "bow", "crossbow", "gun"],
  priest: ["dagger", "mace", "staff", "wand"],
  deathknight: ["axe", "mace", "polearm", "sword"],
  shaman: ["axe", "dagger", "fist weapon", "mace", "staff"],
  mage: ["dagger", "staff", "sword", "wand"],
  warlock: ["dagger", "staff", "sword", "wand"],
  monk: ["axe", "fist weapon", "mace", "polearm", "staff", "sword"],
  druid: ["dagger", "fist weapon", "mace", "polearm", "staff"],
  demonhunter: ["axe", "dagger", "fist weapon", "sword", "warglaive"],
  evoker: ["axe", "dagger", "fist weapon", "mace", "sword", "staff"]
};

function normalizeWeaponType(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  const aliases = {
    axes: "axe", "one handed axe": "axe", "two handed axe": "axe",
    daggers: "dagger", "one handed dagger": "dagger",
    "fist weapons": "fist weapon", fist: "fist weapon",
    maces: "mace", "one handed mace": "mace", "two handed mace": "mace",
    staves: "staff", polearms: "polearm", swords: "sword",
    "one handed sword": "sword", "two handed sword": "sword",
    bows: "bow", guns: "gun", crossbows: "crossbow", wands: "wand",
    glaive: "warglaive", glaives: "warglaive", "war glaive": "warglaive"
  };
  return aliases[key] || key;
}


function normalizeClassName(className) {
  return String(className || "").toLowerCase().replace(/[\s'_-]/g, "");
}

function itemAllowedForClass(item, className) {
  if (!item || !className) return true;
  const expectedArmor = CLASS_ARMOR_TYPE[normalizeClassName(className)];
  if (!expectedArmor) return true;

  const inventoryType = String(item.inventoryType?.name || item.inventoryType || "").trim().toLowerCase();
  const slot = item.slot || ({
    head: "Head", shoulder: "Shoulders", shoulders: "Shoulders", chest: "Chest",
    wrist: "Wrists", wrists: "Wrists", hands: "Hands", hand: "Hands",
    waist: "Waist", legs: "Legs", feet: "Feet"
  })[inventoryType];
  if (!ARMOR_SLOTS.has(slot)) return true;

  const itemClass = String(item.itemClass?.name || item.itemClass || "").trim().toLowerCase();
  const subclass = String(item.itemSubclass?.name || item.itemSubclass || "").trim().toLowerCase();
  // Only filter when the catalog explicitly identifies an armor subclass.
  // Missing or unknown metadata must not silently remove otherwise valid gear.
  if (itemClass && !itemClass.includes("armor") && !itemClass.includes("armour")) return true;
  if (["cloth", "leather", "mail", "plate"].includes(subclass)) return subclass === expectedArmor;
  return true;
}

function getWeaponMetadata(item) {
  const inventoryType = String(item?.inventoryType?.name || item?.inventoryType || "").trim().toLowerCase();
  const subclass = String(item?.itemSubclass?.name || item?.itemSubclass || item?.weaponType || "").trim().toLowerCase();
  const name = String(item?.name || "").toLowerCase();
  const weaponType = subclass || (name.includes("staff") || inventoryType.includes("staff") ? "staff" :
    name.includes("mace") || inventoryType.includes("mace") ? "mace" : "");
  const twoHanded = inventoryType.includes("two-hand") || inventoryType.includes("two hand") ||
    inventoryType.includes("twohand") || inventoryType.includes("staff") ||
    (item?.twoHanded === true);
  const oneHanded = inventoryType.includes("one-hand") || inventoryType.includes("one hand") ||
    inventoryType.includes("onehand") || item?.twoHanded === false;
  return { inventoryType, weaponType, twoHanded, oneHanded };
}

function itemAllowedForClassWeapon(item, slot, className) {
  if (slot !== "Main Hand" && slot !== "Off Hand") return true;
  const classKey = normalizeClassName(className);
  const allowed = CLASS_WEAPON_PROFICIENCIES[classKey];
  if (!allowed) return true;
  const rawType = item?.itemSubclass?.name || item?.itemSubclass || item?.weaponType || "";
  const weaponType = normalizeWeaponType(rawType);
  // Missing/unrecognized weapon-subclass metadata is not enough evidence to
  // reject an item. The importer/catalog should provide itemSubclass for strict filtering.
  if (!weaponType || !allowed.includes(weaponType)) {
    return !weaponType;
  }
  return true;
}

function itemAllowedForSpecialization(item, slot, className, specialization) {
  if (normalizeClassName(className) !== "shaman") return true;
  const spec = String(specialization || "").trim().toLowerCase();
  if (spec !== "enhancement") return true;

  // Enhancement uses Agility, not Intellect. Exclude caster items with static
  // Intellect from all slots, checking upgraded variants as well as base stats.
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
  const weapon = getWeaponMetadata(item);
  // Enhancement defaults to dual wield. Do not recommend staffs or unknown
  // two-hand weapons; allow a verified two-handed mace as a main-hand option.
  if (weapon.weaponType.includes("staff") || weapon.inventoryType.includes("staff") ||
      String(item?.name || "").toLowerCase().includes("staff")) return false;
  if (slot === "Off Hand" && weapon.twoHanded) return false;
  if (slot === "Main Hand" && weapon.twoHanded &&
      !(weapon.weaponType.includes("mace") || String(item?.name || "").toLowerCase().includes("mace"))) return false;
  return true;
}

function itemMatchesSlot(item, slot) {
  if (!item || !slot) return false;
  const inventoryType = String(item.inventoryType?.name || item.inventoryType || "").trim().toLowerCase();
  const map = {
    head: ["Head"], neck: ["Neck"], shoulder: ["Shoulders"], shoulders: ["Shoulders"],
    cloak: ["Back"], back: ["Back"], chest: ["Chest"], robe: ["Chest"],
    wrist: ["Wrists"], wrists: ["Wrists"], hands: ["Hands"], hand: ["Hands"],
    waist: ["Waist"], legs: ["Legs"], feet: ["Feet"],
    finger: ["Ring 1", "Ring 2"], ring: ["Ring 1", "Ring 2"],
    trinket: ["Trinket 1", "Trinket 2"],
    "one-hand": ["Main Hand", "Off Hand"], "one hand": ["Main Hand", "Off Hand"],
    "main hand": ["Main Hand"], "two-hand": ["Main Hand"], "two hand": ["Main Hand"],
    staff: ["Main Hand"], mace: ["Main Hand", "Off Hand"], axe: ["Main Hand", "Off Hand"],
    dagger: ["Main Hand", "Off Hand"], "fist weapon": ["Main Hand", "Off Hand"],
    "off hand": ["Off Hand"], "held in off-hand": ["Off Hand"], shield: ["Off Hand"], "off-hand": ["Off Hand"]
  };
  if (item.slot === slot) {
    // Explicit slot metadata does not override incompatible weapon-hand metadata.
    if ((slot === "Main Hand" || slot === "Off Hand") && inventoryType && map[inventoryType]) {
      return map[inventoryType].includes(slot);
    }
    return true;
  }
  return (map[inventoryType] || []).includes(slot);
}

const STAT_WEIGHTS = {
  Strength: 1, Agility: 1, Intellect: 1, Stamina: 0.15,
  CriticalStrike: 0.8, Haste: 0.8, Mastery: 0.8, Versatility: 0.8
};

function normalizeCharacterStatistics(statistics = {}) {
  const aliases = {
    strength: "Strength", agility: "Agility", intellect: "Intellect", stamina: "Stamina",
    criticalstrike: "CriticalStrike", haste: "Haste", mastery: "Mastery", versatility: "Versatility",
    armor: "Armor", dodge: "Dodge", parry: "Parry", block: "Block",
    leech: "Leech", speed: "Speed", avoidance: "Avoidance"
  };
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(statistics || {})) {
    const key = String(rawKey).replace(/[\s_-]/g, "").toLowerCase();
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) continue;
    normalized[aliases[key] || rawKey] = numericValue;
  }
  return normalized;
}

// Level-90 secondary-stat rating diminishing returns, based on the supplied rating bands.
// Each band's penalty applies progressively to rating inside that band only.
// Keep rating-derived stats separate from temporary percentage buffs (e.g. Bloodlust/Heroism).
const SECONDARY_RATING_DR_LEVEL = 90;
const SECONDARY_RATING_DR_TABLE = {
  Haste: [1320, 1760, 2200, 2640, 3080, 8800],
  CriticalStrike: [1380, 1840, 2300, 2760, 3220, 9200],
  Mastery: [1380, 1840, 2300, 2760, 3220, 9200],
  Versatility: [1620, 2160, 2700, 3240, 3780, 10800]
};
const SECONDARY_RATING_DR_MULTIPLIERS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0];
const SECONDARY_RATING_DR_CAP_PERCENT = 126;

// Level-90 tertiary rating DR from the supplied Midnight 12.0.1 reference.
// Bands are progressive; rating above the final threshold contributes no
// effective rating. These are rating values, not direct percentage stats.
const TERTIARY_RATING_DR_TABLE = Object.freeze({
  Avoidance: [370, 555, 740, 1813],
  Leech: [690, 1035, 1380, 3381],
  Speed: [120, 180, 240, 588]
});
const TERTIARY_RATING_DR_MULTIPLIERS = [1, 0.8, 0.6, 0.4, 0];
function applyTertiaryRatingDiminishingReturns(rawRating, stat, characterLevel = SECONDARY_RATING_DR_LEVEL) {
  const rating = Number(rawRating);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  if (Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL) return null;
  const key = normalizeItemStatName(stat);
  const thresholds = TERTIARY_RATING_DR_TABLE[key];
  if (!thresholds) return null;
  let previous = 0;
  let effective = 0;
  for (let band = 0; band < thresholds.length; band++) {
    const limit = thresholds[band];
    const amount = Math.max(0, Math.min(rating, limit) - previous);
    effective += amount * TERTIARY_RATING_DR_MULTIPLIERS[band];
    previous = limit;
    if (rating <= limit) return effective;
  }
  return effective;
}
function getTertiaryRatingTotals(equipment = {}) {
  const totals = {};
  for (const item of Object.values(equipment || {})) {
    if (!item || !item.stats) continue;
    const entries = Array.isArray(item.stats)
      ? item.stats.map(s => [
          normalizeItemStatName(s.stat?.name || s.type?.name || s.name || s.stat),
          Number(s.value?.value ?? s.value?.amount ?? s.amount ?? s.value) || 0
        ])
      : Object.entries(item.stats).map(([stat, value]) => [
          normalizeItemStatName(stat), Number(value?.value ?? value?.amount ?? value) || 0
        ]);
    for (const [stat, value] of entries) {
      if (Object.hasOwn(TERTIARY_RATING_DR_TABLE, stat)) totals[stat] = (totals[stat] || 0) + value;
    }
  }
  return totals;
}
// Soft targets are the first supplied thresholds; the last threshold is a hard
// cap for eligible level-90 loadouts. Above soft targets, prefer the secondary
// stat furthest behind relative to its own target (not lowest raw rating).
const SECONDARY_RATING_DR_SOFT_TARGETS = Object.freeze({
  Haste: 1320,
  CriticalStrike: 1380,
  Mastery: 1380,
  Versatility: 1620
});
function getSecondaryRatingTotals(equipment = {}) {
  const totals = {};
  for (const item of Object.values(equipment || {})) {
    if (!item || !item.stats) continue;
    const entries = Array.isArray(item.stats)
      ? item.stats.map(s => [
          normalizeItemStatName(s.stat?.name || s.type?.name || s.name || s.stat),
          Number(s.value?.value ?? s.value?.amount ?? s.amount ?? s.value) || 0
        ])
      : Object.entries(item.stats).map(([stat, value]) => [
          normalizeItemStatName(stat),
          Number(value?.value ?? value?.amount ?? value) || 0
        ]);
    for (const [stat, value] of entries) {
      if (Object.hasOwn(SECONDARY_RATING_DR_TABLE, stat)) totals[stat] = (totals[stat] || 0) + value;
    }
  }
  return totals;
}
function getSecondaryRatingHardCapViolations(equipment = {}, characterLevel = null) {
  if (Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL) return [];
  const totals = getSecondaryRatingTotals(equipment);
  return Object.entries(SECONDARY_RATING_DR_TABLE).flatMap(([stat, thresholds]) => {
    const rating = totals[stat] || 0;
    const maximum = thresholds[thresholds.length - 1];
    return rating > maximum ? [{ stat, rating, maximum, excess: rating - maximum }] : [];
  });
}
function getSecondaryRatingSoftTargetPenalty(equipment = {}, characterLevel = null) {
  if (Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL) return 0;
  const totals = getSecondaryRatingTotals(equipment);
  const stats = Object.entries(SECONDARY_RATING_DR_SOFT_TARGETS).map(([stat, target]) => ({
    stat,
    target,
    rating: totals[stat] || 0,
    normalized: (totals[stat] || 0) / target
  }));
  // First, penalize any shortfall so reaching all soft targets is valuable.
  const shortfallPenalty = stats.reduce((penalty, entry) =>
    penalty + Math.max(0, entry.target - entry.rating) * 2, 0);
  // Once at/above target, penalize over-investment quadratically relative to
  // each stat's own threshold. This makes the least-covered stat the preferred
  // destination for additional rating while preserving stat-weight scoring.
  const overTargetPenalty = stats.reduce((penalty, entry) => {
    const normalizedExcess = Math.max(0, entry.normalized - 1);
    return penalty + normalizedExcess * normalizedExcess * entry.target * 4;
  }, 0);
  return shortfallPenalty + overTargetPenalty;
}
function applySecondaryRatingDiminishingReturns(rawRating, stat, characterLevel = SECONDARY_RATING_DR_LEVEL) {
  const rating = Number(rawRating);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  // This table is only supported for the supplied level-90 data. Do not silently
  // apply it to characters at a different level.
  if (Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL) return null;
  const key = normalizeItemStatName(stat);
  const thresholds = SECONDARY_RATING_DR_TABLE[key];
  if (!thresholds) return null;
  let previous = 0;
  let effective = 0;
  for (let band = 0; band < thresholds.length; band++) {
    const limit = thresholds[band];
    const amount = Math.max(0, Math.min(rating, limit) - previous);
    effective += amount * SECONDARY_RATING_DR_MULTIPLIERS[band];
    previous = limit;
    if (rating <= limit) return effective;
  }
  // Rating above the last threshold has 100% penalty and adds no effective rating.
  return effective;
}
function getSecondaryRatingDiminishingReturns(rawRating, stat, characterLevel = SECONDARY_RATING_DR_LEVEL) {
  const rating = Number(rawRating);
  const normalizedRating = Number.isFinite(rating) ? Math.max(0, rating) : 0;
  const effectiveRating = applySecondaryRatingDiminishingReturns(normalizedRating, stat, characterLevel);
  return {
    stat: normalizeItemStatName(stat), characterLevel: Number(characterLevel),
    rawRating: normalizedRating, effectiveRating,
    lostRating: effectiveRating === null ? null : Math.max(0, normalizedRating - effectiveRating),
    unsupportedLevel: Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL,
    unsupportedStat: !SECONDARY_RATING_DR_TABLE[normalizeItemStatName(stat)]
  };
}

function scoreCharacterStatistics(statistics = {}, statWeights = STAT_WEIGHTS) {
  const normalized = normalizeCharacterStatistics(statistics);
  return Object.entries(normalized).reduce((score, [stat, value]) =>
    score + value * (statWeights[stat] ?? 0), 0);
}

function getCharacterStatSummary(statistics = {}, statWeights = STAT_WEIGHTS) {
  const normalized = normalizeCharacterStatistics(statistics);
  const trackedStats = Object.fromEntries(
    Object.keys(statWeights)
      .filter(stat => normalized[stat] !== undefined)
      .map(stat => [stat, normalized[stat]])
  );
  return {
    stats: normalized,
    trackedStats,
    weightedScore: scoreCharacterStatistics(normalized, statWeights)
  };
}

function createCharacterProfile() {
  return {
    className: "", specialization: "", goal: WOW_GOALS.general,
    equipment: Object.fromEntries(WOW_EQUIPMENT_SLOTS.map(slot => [slot, null])),
    gems: [], enchants: [], embellishments: [], upgrades: [],
    consumables: { food: null, flaskOrPhial: null, potions: [], other: [] }
  };
}

function normalizeImportedEquipment(equipmentItems = []) {
  const equipment = Object.fromEntries(WOW_EQUIPMENT_SLOTS.map(slot => [slot, null]));
  const nextDuplicateSlot = { Finger: "Ring 1", Trinket: "Trinket 1" };

  for (const rawItem of equipmentItems || []) {
    if (!rawItem) continue;
    const slotType = String(rawItem.slotType || "").toUpperCase();
    const rawSlot = String(rawItem.slot || rawItem.slotName || "").trim();
    let targetSlot = null;

    if (slotType === "FINGER" || rawSlot.toLowerCase() === "finger") {
      targetSlot = nextDuplicateSlot.Finger === "Ring 1" ? "Ring 1" : "Ring 2";
      nextDuplicateSlot.Finger = targetSlot === "Ring 1" ? "Ring 2" : null;
    } else if (slotType === "TRINKET" || rawSlot.toLowerCase() === "trinket") {
      targetSlot = nextDuplicateSlot.Trinket === "Trinket 1" ? "Trinket 1" : "Trinket 2";
      nextDuplicateSlot.Trinket = targetSlot === "Trinket 1" ? "Trinket 2" : null;
    } else if (WOW_EQUIPMENT_SLOTS.includes(rawSlot)) {
      targetSlot = rawSlot;
    } else if (slotType === "MAIN_HAND" || rawSlot.toLowerCase() === "main hand") {
      targetSlot = "Main Hand";
    } else if (slotType === "OFF_HAND" || rawSlot.toLowerCase() === "off hand") {
      targetSlot = "Off Hand";
    }

    if (targetSlot && !equipment[targetSlot]) {
      equipment[targetSlot] = { ...rawItem, slot: targetSlot };
    }
  }

  return equipment;
}

function createCharacterProfileFromImport({ importedCharacter, goal = WOW_GOALS.general } = {}) {
  const character = createCharacterProfile();
  if (!importedCharacter) return character;

  character.className = importedCharacter.class?.name || "";
  character.specialization = importedCharacter.activeSpec?.name || "";
  character.goal = goal;
  character.equipment = normalizeImportedEquipment(importedCharacter.equipment);
  character.statistics = normalizeCharacterStatistics(importedCharacter.statistics);
  character.talents = Array.isArray(importedCharacter.talents) ? importedCharacter.talents : [];

  return {
    ...character,
    characterId: importedCharacter.id ?? null,
    characterName: importedCharacter.name || "",
    realm: importedCharacter.realm || null,
    level: importedCharacter.level ?? null,
    classId: importedCharacter.class?.id ?? null,
    specializationId: importedCharacter.activeSpec?.id ?? null,
    source: importedCharacter.source || "Imported character"
  };
}

function normalizeItemStatName(stat) {
  const key = String(stat || "").replace(/[\s_-]/g, "").toLowerCase();
  const aliases = {
    strength: "Strength", str: "Strength",
    agility: "Agility", agi: "Agility",
    intellect: "Intellect", int: "Intellect",
    stamina: "Stamina", sta: "Stamina",
    attackpower: "AttackPower", ap: "AttackPower",
    criticalstrike: "CriticalStrike", crit: "CriticalStrike", critrating: "CriticalStrike",
    haste: "Haste", hasterating: "Haste",
    mastery: "Mastery", masteryrating: "Mastery",
    versatility: "Versatility", vers: "Versatility", versatilityrating: "Versatility",
    armor: "Armor", bonusarmor: "BonusArmor", wdps: "WeaponDPS"
  };
  return aliases[key] || stat;
}

function scoreItemStats(item, statWeights = STAT_WEIGHTS) {
  if (!item || !item.stats) return 0;
  const stats = Array.isArray(item.stats)
    ? item.stats.map(s => [
        normalizeItemStatName(s.stat?.name || s.type?.name || s.name || s.stat),
        Number(s.value ?? s.amount) || 0
      ])
    : Object.entries(item.stats).map(([stat, value]) => [
        normalizeItemStatName(stat),
        Number(value?.value ?? value?.amount ?? value) || 0
      ]);
  return stats.reduce((score, [stat, value]) =>
    score + value * (statWeights[stat] ?? 0), 0);
}

function hasUsableItemStats(item) {
  if (!item || !item.stats) return false;
  // Blizzard character imports and catalog records can represent stat values
  // as numbers, {value}, or {amount}. Treat the same shapes as scoreItemStats;
  // otherwise equipped items can score as zero and a lower-ilvl catalog item
  // may be incorrectly recommended over them.
  const entries = Array.isArray(item.stats)
    ? item.stats.map(s => [
        s.stat?.name || s.type?.name || s.name || s.stat,
        s.value?.value ?? s.value?.amount ?? s.amount ?? s.value
      ])
    : Object.entries(item.stats).map(([stat, value]) => [
        stat, value?.value ?? value?.amount ?? value
      ]);
  return entries.some(([stat, value]) =>
    stat != null && String(stat).trim() !== "" && Number.isFinite(Number(value)) && Number(value) !== 0
  );
}

function scoreTrinketUseEffect(item, statWeights = STAT_WEIGHTS) {
  const effect = item?.trinketEffect;
  if (!effect || !effect.temporaryStats || !Number.isFinite(Number(effect.durationSeconds)) ||
      !Number.isFinite(Number(effect.cooldownSeconds)) || Number(effect.durationSeconds) <= 0 ||
      Number(effect.cooldownSeconds) <= 0) return 0;
  const slot = String(item.slot || item.inventoryType?.name || "").toLowerCase();
  if (!slot.includes("trinket")) return 0;
  const uptime = Math.min(1, Number(effect.durationSeconds) / Number(effect.cooldownSeconds));
  return Object.entries(effect.temporaryStats).reduce((total, [stat, value]) =>
    total + (Number(value) || 0) * (statWeights[normalizeItemStatName(stat)] ?? 0) * uptime, 0);
}

function scoreItem(item, statWeights = STAT_WEIGHTS) {
  if (!item || !hasUsableItemStats(item)) return 0;
  const itemLevel = Number(item.itemLevel ?? item.level) || 0;
  let effectScore = Number(item.effectValue) || 0;
  if (item.isSetPiece) effectScore += 10;
  if (item.isUniqueEffect) effectScore += 5;
  effectScore += scoreTrinketUseEffect(item, statWeights);
  return itemLevel * 2 + scoreItemStats(item, statWeights) + effectScore;
}

function scoreEquipment(equipment, statWeights = STAT_WEIGHTS) {
  return WOW_EQUIPMENT_SLOTS.reduce((total, slot) =>
    total + scoreItem(equipment?.[slot], statWeights), 0);
}

function normalizeSetIdentity(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value).trim().toLowerCase();
}

function getItemSetId(item, setBonuses = []) {
  const set = item?.set;
  const raw = item?.tierSetId ?? item?.setId ??
    (set && typeof set === "object" ? (set.id ?? set.name) : set);
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    return normalizeSetIdentity(raw);
  }

  // Blizzard item records do not always expose a set identity on the equipped
  // item. Fall back to explicit, source-backed item IDs/names in the set
  // definitions; never infer set membership from class, faction, or item level.
  const itemId = Number(item?.id ?? item?.itemId);
  const itemName = normalizeSetIdentity(item?.name);
  for (const definition of setBonuses || []) {
    const setId = normalizeSetIdentity(definition?.setId ?? definition?.id ?? definition?.name);
    if (!setId) continue;
    const pieces = Array.isArray(definition.pieces) ? definition.pieces : [];
    const matches = pieces.some(piece => {
      if (typeof piece === "number" || typeof piece === "string") {
        return (Number.isFinite(itemId) && Number(piece) === itemId) ||
          (itemName && normalizeSetIdentity(piece) === itemName);
      }
      if (!piece || typeof piece !== "object") return false;
      const pieceId = Number(piece.itemId ?? piece.id);
      const pieceName = normalizeSetIdentity(piece.name);
      return (Number.isFinite(itemId) && Number.isFinite(pieceId) && itemId === pieceId) ||
        (itemName && pieceName === itemName);
    });
    if (matches) return setId;
  }
  return null;
}

function getSetBonusStatus(equipment = {}, setBonuses = [], specialization = "") {
  const counts = {};
  for (const item of Object.values(equipment || {})) {
    const setId = getItemSetId(item, setBonuses);
    if (setId) counts[setId] = (counts[setId] || 0) + 1;
  }

  const bonuses = [];
  for (const definition of setBonuses || []) {
    const setId = normalizeSetIdentity(definition?.setId ?? definition?.id ?? definition?.name);
    if (!setId) continue;
    const pieces = counts[setId] || 0;
    for (const threshold of definition.thresholds || []) {
      const requiredPieces = Number(threshold.pieces);
      if (!Number.isFinite(requiredPieces) || requiredPieces < 2) continue;
      const effects = threshold.effects && typeof threshold.effects === "object" ? threshold.effects : null;
      const selectedEffect = effects
        ? (effects[specialization] ?? effects[String(specialization).toLowerCase()] ?? null)
        : null;
      bonuses.push({
        setId,
        setName: definition.name || definition.setName || definition.setId || definition.id || setId,
        requiredPieces,
        equippedPieces: pieces,
        active: pieces >= requiredPieces,
        scoreValue: threshold.scoreValue !== null && threshold.scoreValue !== undefined && Number.isFinite(Number(threshold.scoreValue))
          ? Number(threshold.scoreValue) : null,
        effect: selectedEffect || threshold.effect || threshold.description || null,
        effects: effects || null,
        source: threshold.source || definition.source || null
      });
    }
  }
  return { counts, bonuses };
}

function scoreSetBonuses(equipment = {}, setBonuses = [], specialization = "") {
  const status = getSetBonusStatus(equipment, setBonuses, specialization);
  const score = status.bonuses.reduce((total, bonus) =>
    total + (bonus.active && bonus.scoreValue !== null ? bonus.scoreValue : 0), 0);
  return { ...status, score };
}

function scoreEquipmentWithRatingDiminishingReturns(equipment = {}, statWeights = STAT_WEIGHTS, characterLevel = null) {
  // Only apply the supplied threshold table when level is explicitly known to be 90.
  // Otherwise preserve the existing rating score rather than applying wrong-level data.
  if (Number(characterLevel) !== SECONDARY_RATING_DR_LEVEL) return scoreEquipment(equipment, statWeights);
  const secondaryStats = new Set(Object.keys(SECONDARY_RATING_DR_TABLE));
  const tertiaryStats = new Set(Object.keys(TERTIARY_RATING_DR_TABLE));
  const totals = {};
  const tertiaryTotals = {};
  let score = 0;
  for (const item of Object.values(equipment || {})) {
    if (!item || !hasUsableItemStats(item)) continue;
    score += (Number(item.itemLevel ?? item.level) || 0) * 2;
    score += Number(item.effectValue) || 0;
    if (item.isSetPiece) score += 10;
    if (item.isUniqueEffect) score += 5;
    score += scoreTrinketUseEffect(item, statWeights);
    const entries = Array.isArray(item.stats)
      ? item.stats.map(s => [normalizeItemStatName(s.stat?.name || s.type?.name || s.name || s.stat), Number(s.value ?? s.amount) || 0])
      : Object.entries(item.stats || {}).map(([stat, value]) => [normalizeItemStatName(stat), Number(value?.value ?? value?.amount ?? value) || 0]);
    for (const [stat, value] of entries) {
      if (secondaryStats.has(stat)) totals[stat] = (totals[stat] || 0) + value;
      else if (tertiaryStats.has(stat)) tertiaryTotals[stat] = (tertiaryTotals[stat] || 0) + value;
      else score += value * (statWeights[stat] ?? 0);
    }
  }
  for (const stat of secondaryStats) {
    if (totals[stat] !== undefined) {
      const effective = applySecondaryRatingDiminishingReturns(totals[stat], stat, characterLevel);
      score += effective * (statWeights[stat] ?? 0);
    }
  }
  for (const stat of tertiaryStats) {
    if (tertiaryTotals[stat] !== undefined) {
      const effective = applyTertiaryRatingDiminishingReturns(tertiaryTotals[stat], stat, characterLevel);
      score += effective * (statWeights[stat] ?? 0);
    }
  }
  return score;
}

function scoreLoadout(equipment = {}, statWeights = STAT_WEIGHTS, setBonuses = [], specialization = "", characterLevel = null) {
  const setScore = scoreSetBonuses(equipment, setBonuses, specialization);
  const rawScore = scoreEquipmentWithRatingDiminishingReturns(equipment, statWeights, characterLevel) + setScore.score;
  // Make the DR soft-target policy part of the same aggregate score used for
  // whole-loadout search. Previously the helper existed but wasn't connected
  // to loadout scoring, so it could not reliably influence selected gear.
  const softTargetPenalty = getSecondaryRatingSoftTargetPenalty(equipment, characterLevel);
  return {
    score: rawScore - softTargetPenalty,
    rawScore,
    softTargetPenalty,
    setBonuses: setScore
  };
}

function getGoalWeights(goal) {
  const weights = { ...STAT_WEIGHTS };
  switch (goal) {
    case WOW_GOALS.mythicPlus:
      weights.Haste *= 1.08; weights.CriticalStrike *= 1.04; break;
    case WOW_GOALS.raid:
      weights.Mastery *= 1.06; weights.CriticalStrike *= 1.04; break;
    case WOW_GOALS.pvp:
      weights.Versatility *= 1.12; weights.Haste *= 1.05; break;
  }
  return weights;
}

function findBlizzardSpecialization(dataset, specializationId = null, specializationName = "") {
  const records = dataset?.talents?.specializations || [];
  if (!records.length) return null;

  if (specializationId !== null && specializationId !== undefined) {
    const byId = records.find(record => Number(record.id) === Number(specializationId));
    if (byId) return byId;
  }

  const target = String(specializationName || "").trim().toLowerCase();
  if (!target) return null;
  return records.find(record => String(record.name || "").trim().toLowerCase() === target) || null;
}

function getSpecProfileContext({ dataset = null, className = "", specialization = "", specializationId = null } = {}) {
  const specializationRecord = findBlizzardSpecialization(
    dataset,
    specializationId,
    specialization
  );
  const optimizationProfile =
    dataset?.optimizationProfiles?.[className]?.[specialization] || null;

  return {
    specialization: specializationRecord,
    optimizationProfile
  };
}

function normalizeSimulationScaleFactors(scaleFactors = {}) {
  const aliases = {
    strength: "Strength", str: "Strength",
    agility: "Agility", agi: "Agility",
    intellect: "Intellect", int: "Intellect",
    stamina: "Stamina", sta: "Stamina",
    attackpower: "AttackPower", ap: "AttackPower",
    criticalstrike: "CriticalStrike", crit: "CriticalStrike", critrating: "CriticalStrike",
    haste: "Haste", hasterating: "Haste",
    mastery: "Mastery", masteryrating: "Mastery",
    versatility: "Versatility", vers: "Versatility", versatilityrating: "Versatility",
    armor: "Armor", bonusarmor: "BonusArmor", wdps: "WeaponDPS"
  };
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(scaleFactors || {})) {
    const key = String(rawKey).replace(/[\s_-]/g, "").toLowerCase();
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    normalized[aliases[key] || rawKey] = value;
  }
  return normalized;
}

function getSimulationWeightContext(simulation = null) {
  if (!simulation || typeof simulation !== "object") return null;
  const scaleFactors = normalizeSimulationScaleFactors(
    simulation.scaleFactors || simulation.weights || {}
  );
  if (!Object.keys(scaleFactors).length) return null;

  return {
    source: simulation.source || "Simulation-derived",
    method: simulation.method || "scale-factors",
    patch: simulation.patch || null,
    specialization: simulation.specialization || null,
    characterId: simulation.characterId ?? null,
    generatedAt: simulation.generatedAt || null,
    scaleFactors
  };
}

function resolveStatWeights({
  goal = WOW_GOALS.general,
  className = "",
  specialization = "",
  statProfiles = null,
  simulation = null
} = {}) {
  const goalWeights = getGoalWeights(goal);
  const simulationContext = getSimulationWeightContext(simulation);
  if (simulationContext) return { ...goalWeights, ...simulationContext.scaleFactors };

  const classProfiles = statProfiles && typeof statProfiles === "object"
    ? statProfiles[className]
    : null;
  const profile = classProfiles?.[specialization];
  const merged = { ...goalWeights };

  // Enhancement-specific fallback when no character simulation/profile exists.
  // These are priority heuristics from current-season gearing guides, not DPS
  // scale factors. Item level remains a major signal in scoreItem; the profile
  // distinguishes the important secondary stats from Versatility.
  if (normalizeClassName(className) === "shaman" &&
      String(specialization || "").trim().toLowerCase() === "enhancement") {
    merged.Agility = 1.25;
    merged.Intellect = 0;
    merged.Strength = 0;
    merged.CriticalStrike = 0.9;
    merged.Mastery = 0.9;
    merged.Haste = 0.9;
    merged.Versatility = 0.55;
  }

  if (!profile || typeof profile !== "object") return merged;
  for (const [stat, value] of Object.entries(profile)) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      merged[stat] = numericValue;
    }
  }
  return merged;
}

function resolveCatalogItemAgainstEquippedVariant(candidate, equippedItem) {
  if (!candidate || !equippedItem || candidate.id == null || equippedItem.id == null) return candidate;
  if (String(candidate.id) !== String(equippedItem.id)) return candidate;

  const candidateLevel = Number(candidate.itemLevel ?? candidate.level);
  const equippedLevel = Number(equippedItem.itemLevel ?? equippedItem.level);
  // The catalog endpoint may describe only the base item while Blizzard's
  // character profile contains the actual upgraded variant. Never replace
  // that verified equipped variant with a lower-level base record.
  if (Number.isFinite(candidateLevel) && Number.isFinite(equippedLevel) && equippedLevel > candidateLevel) {
    return equippedItem;
  }
  return candidate;
}

function findBestItemForSlot(items, slot, goal, statWeights = null, className = "", equippedItem = null, specialization = "") {
  const weights = statWeights || getGoalWeights(goal);
  const bestByIdentity = new Map();
  for (const candidate of (items || [])) {
    if (!itemMatchesSlot(candidate, slot) ||
        !itemAllowedForClass(candidate, className) ||
        !itemAllowedForClassWeapon(candidate, slot, className) ||
        !itemAllowedForSpecialization(candidate, slot, className, specialization) ||
        !hasUsableItemStats(candidate)) continue;

    // Do not replace an equipped higher-item-level piece with a lower-level
    // base record just because its visible secondary stats happen to score well.
    // The catalogue currently stores base item records for some Mythic drops;
    // those are not equivalent to their fully upgraded variants. A lower-level
    // recommendation requires verified variant data, not an implicit downgrade.
    const candidateLevel = Number(candidate.itemLevel ?? candidate.level);
    const equippedLevel = Number(equippedItem?.itemLevel ?? equippedItem?.level);
    if (Number.isFinite(candidateLevel) && Number.isFinite(equippedLevel) &&
        candidateLevel < equippedLevel) continue;

    // A seasonal catalogue can contain multiple difficulty/upgrade variants
    // sharing the same base item ID. Resolve an equipped upgraded copy first,
    // then retain the highest-scoring variant for each identity instead of
    // accidentally keeping the first (often lowest-ilvl) record in the file.
    const item = resolveCatalogItemAgainstEquippedVariant(candidate, equippedItem);
    const key = String(item.id ?? item.name) + "|" + slot;
    const score = scoreItem(item, weights);
    const previous = bestByIdentity.get(key);
    if (!previous || score > previous.score) bestByIdentity.set(key, { item, score });
  }
  return [...bestByIdentity.values()].sort((a, b) => b.score - a.score)[0] || null;
}

function optimizeEquipment({
  items = [],
  character = createCharacterProfile(),
  goal = character.goal || WOW_GOALS.general,
  statWeights = null,
  setBonuses = []
} = {}) {
  const weights = statWeights || resolveStatWeights({
    goal,
    className: character.className,
    specialization: character.specialization,
    simulation: character.simulation
  });
  // The live character's equipped variants are valid candidates too. The catalog
  // may contain only a low-level/base version of an item or omit that variant
  // entirely; excluding current gear can produce recommendations far below the
  // character's equipped item level.
  const equippedItems = Object.entries(character.equipment || {})
    .filter(([, item]) => item && typeof item === "object")
    .map(([slot, item]) => ({ ...item, slot: item.slot || slot }));
  // Expand explicitly verified difficulty/upgrade variants before anti-downgrade
  // filtering so each candidate is scored using its own item level and stats.
  const expandedItems = [];
  for (const rawItem of [...(items || []), ...equippedItems]) {
    if (!rawItem || typeof rawItem !== "object") continue;
    expandedItems.push(rawItem);
    if (Array.isArray(rawItem.variants)) {
      for (const variant of rawItem.variants) {
        if (!variant || typeof variant !== "object") continue;
        expandedItems.push({
          ...rawItem,
          ...variant,
          id: rawItem.id,
          slot: variant.slot || rawItem.slot,
          variantKey: variant.variantKey || String(rawItem.id) + ":variant:" + String(variant.itemLevel ?? variant.level ?? "unknown"),
          baseItemId: rawItem.id,
        });
      }
    }
  }
  const candidateItemsByIdentity = new Map();
  for (const rawItem of expandedItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const slot = rawItem.slot;
    const equippedItem = character.equipment?.[slot];
    const item = resolveCatalogItemAgainstEquippedVariant(rawItem, equippedItem);
    const key = String(item.id ?? item.name) + "|" + String(slot || "");
    const score = scoreItem(item, weights);
    const previous = candidateItemsByIdentity.get(key);
    if (!previous || score > previous.score) {
      candidateItemsByIdentity.set(key, { item, score });
    }
  }
  const candidateItems = [...candidateItemsByIdentity.values()].map(entry => entry.item);
  const optimizedEquipment = {};
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const best = findBestItemForSlot(candidateItems, slot, goal, weights, character.className, character.equipment?.[slot], character.specialization);
    optimizedEquipment[slot] = best ? best.item : null;
  }

  // A physical item cannot fill both copies of a slot. Choose the best-scoring
  // distinct pair when the catalog has alternatives; keep the best single item
  // only when no second distinct item exists.
  for (const [firstSlot, secondSlot] of [["Ring 1", "Ring 2"], ["Trinket 1", "Trinket 2"], ["Main Hand", "Off Hand"]]) {
    // Pair selection runs after findBestItemForSlot and must apply the same
    // anti-downgrade guard. Otherwise a low-level catalog record can overwrite
    // the safe result when choosing distinct trinkets/rings/weapons.
    const meetsEquippedLevel = (item, slot) => {
      const current = character.equipment?.[slot];
      const candidateLevel = Number(item.itemLevel ?? item.level);
      const currentLevel = Number(current?.itemLevel ?? current?.level);
      return !(Number.isFinite(candidateLevel) && Number.isFinite(currentLevel) &&
        candidateLevel < currentLevel);
    };
    const first = candidateItems.filter(item => itemMatchesSlot(item, firstSlot) && itemAllowedForClass(item, character.className) && itemAllowedForClassWeapon(item, firstSlot, character.className) && itemAllowedForSpecialization(item, firstSlot, character.className, character.specialization) && hasUsableItemStats(item) && meetsEquippedLevel(item, firstSlot))
      .map(item => ({ item, score: scoreItem(item, weights) }))
      .sort((a, b) => b.score - a.score);
    const second = candidateItems.filter(item => itemMatchesSlot(item, secondSlot) && itemAllowedForClass(item, character.className) && itemAllowedForClassWeapon(item, secondSlot, character.className) && itemAllowedForSpecialization(item, secondSlot, character.className, character.specialization) && hasUsableItemStats(item) && meetsEquippedLevel(item, secondSlot))
      .map(item => ({ item, score: scoreItem(item, weights) }))
      .sort((a, b) => b.score - a.score);
    let bestPair = null;
    for (const a of first) {
      for (const b of second) {
        const sameId = a.item.id != null && b.item.id != null && String(a.item.id) === String(b.item.id);
        const sameName = a.item.id == null && b.item.id == null && a.item.name && b.item.name && a.item.name === b.item.name;
        if (sameId || sameName) continue;
        if (firstSlot === "Main Hand" && getWeaponMetadata(a.item).twoHanded) continue;
        const combinedScore = a.score + b.score;
        if (!bestPair || combinedScore > bestPair.combinedScore) bestPair = { a, b, combinedScore };
      }
    }
    if (bestPair) {
      optimizedEquipment[firstSlot] = bestPair.a.item;
      optimizedEquipment[secondSlot] = bestPair.b.item;
    } else if (first.length && !second.length) {
      optimizedEquipment[firstSlot] = first[0].item;
      optimizedEquipment[secondSlot] = null;
    } else if (second.length && !first.length) {
      optimizedEquipment[firstSlot] = null;
      optimizedEquipment[secondSlot] = second[0].item;
    } else if (first.length && second.length) {
      optimizedEquipment[firstSlot] = first[0].item;
      optimizedEquipment[secondSlot] = null;
    }
  }

  // Hard-cap policy: if all four secondary stats are already over their caps,
  // stop and ask the player which stat to prioritize before changing the build.
  // If only some stats are over cap, repair those violations first using valid
  // slot candidates, choosing each swap by the reduction in total cap excess.
  const originalViolations = getSecondaryRatingHardCapViolations(character.equipment || {}, character.level);
  const originalTotals = getSecondaryRatingTotals(character.equipment || {});
  const allSecondaryStatsOverCap = Number(character.level) === SECONDARY_RATING_DR_LEVEL &&
    Object.keys(SECONDARY_RATING_DR_TABLE).every(stat =>
      (originalTotals[stat] || 0) > SECONDARY_RATING_DR_TABLE[stat].at(-1));
  const preferredSecondaryStat = Object.hasOwn(SECONDARY_RATING_DR_TABLE, character.preferredSecondaryStat)
    ? character.preferredSecondaryStat : null;
  // Once the player chooses a focus, give that stat a modest scoring preference
  // while still treating its final threshold as an absolute ceiling.
  if (preferredSecondaryStat) {
    weights[preferredSecondaryStat] = (Number(weights[preferredSecondaryStat]) || 1) * 1.25;
  }
  if (allSecondaryStatsOverCap && !preferredSecondaryStat) {
    return {
      character: { ...character, goal },
      equipment: { ...(character.equipment || {}) },
      score: scoreLoadout(character.equipment || {}, weights, setBonuses, character.specialization || "", character.level).score,
      setBonusStatus: getSetBonusStatus(character.equipment || {}, setBonuses, character.specialization || ""),
      ratingConstraintStatus: {
        requiresUserChoice: true, allSecondaryStatsOverCap: true,
        preferredSecondaryStat: null, originalViolations,
        remainingViolations: originalViolations, balanced: false
      }
    };
  }

  const capExcess = equipment => getSecondaryRatingHardCapViolations(equipment, character.level)
    .reduce((sum, violation) => sum + violation.excess, 0);
  const isCandidateAllowed = (item, slot) => itemMatchesSlot(item, slot) &&
    itemAllowedForClass(item, character.className) &&
    itemAllowedForClassWeapon(item, slot, character.className) &&
    itemAllowedForSpecialization(item, slot, character.className, character.specialization) &&
    hasUsableItemStats(item);
  // Repair only when the imported character has cap violations. A selected
  // priority stat breaks ties but can never override a hard ceiling.
  for (let pass = 0; pass < WOW_EQUIPMENT_SLOTS.length * 2; pass++) {
    const currentExcess = capExcess(optimizedEquipment);
    if (currentExcess <= 0) break;
    let bestRepair = null;
    for (const slot of WOW_EQUIPMENT_SLOTS) {
      for (const candidate of candidateItems.filter(item => isCandidateAllowed(item, slot))) {
        const trial = { ...optimizedEquipment, [slot]: candidate };
        if (slot === "Main Hand" && getWeaponMetadata(candidate).twoHanded) trial["Off Hand"] = null;
        const nextExcess = capExcess(trial);
        if (nextExcess >= currentExcess) continue;
        const chosenStatPenalty = preferredSecondaryStat
          ? Math.max(0, (getSecondaryRatingTotals(trial)[preferredSecondaryStat] || 0) -
              SECONDARY_RATING_DR_TABLE[preferredSecondaryStat].at(-1)) * 1000000
          : 0;
        const candidateValue = nextExcess * 1000000000 + chosenStatPenalty -
          scoreLoadout(trial, weights, setBonuses, character.specialization || "", character.level).score;
        if (!bestRepair || candidateValue < bestRepair.candidateValue) {
          bestRepair = { slot, candidate, trial, candidateValue };
        }
      }
    }
    if (!bestRepair) break;
    Object.assign(optimizedEquipment, bestRepair.trial);
  }

  // Improve the complete loadout, not only individual slots. A hard-cap
  // violating state is not allowed to win; infeasibility is reported explicitly.
  const loadoutScore = equipment => {
    if (getSecondaryRatingHardCapViolations(equipment, character.level).length) return -Infinity;
    return scoreLoadout(equipment, weights, setBonuses, character.specialization || "", character.level).score;
  };
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const slot of WOW_EQUIPMENT_SLOTS) {
      const current = optimizedEquipment[slot];
      const currentScore = loadoutScore(optimizedEquipment);
      const candidates = candidateItems.filter(item =>
        itemMatchesSlot(item, slot) &&
        itemAllowedForClass(item, character.className) &&
        itemAllowedForClassWeapon(item, slot, character.className) &&
        itemAllowedForSpecialization(item, slot, character.className, character.specialization) &&
        hasUsableItemStats(item)
      );
      let bestItem = current;
      let bestScore = currentScore;
      for (const candidate of candidates) {
        const pairedSlot = ({
          "Ring 1": "Ring 2", "Ring 2": "Ring 1",
          "Trinket 1": "Trinket 2", "Trinket 2": "Trinket 1"
        })[slot];
        const pairedItem = pairedSlot ? optimizedEquipment[pairedSlot] : null;
        if (pairedItem && candidate.id != null && pairedItem.id != null &&
            String(candidate.id) === String(pairedItem.id)) continue;
        if (pairedItem && candidate.id == null && pairedItem.id == null &&
            candidate.name && pairedItem.name && candidate.name === pairedItem.name) continue;

        // A two-handed main-hand weapon occupies both weapon slots. Clear the
        // off hand in the same trial; never score an invalid 2H + off-hand loadout.
        if (slot === "Off Hand" && getWeaponMetadata(optimizedEquipment["Main Hand"]).twoHanded) continue;
        const trial = { ...optimizedEquipment, [slot]: candidate };
        if (slot === "Main Hand" && getWeaponMetadata(candidate).twoHanded) {
          trial["Off Hand"] = null;
        }
        const trialScore = loadoutScore(trial);
        if (trialScore > bestScore) {
          bestScore = trialScore;
          bestItem = candidate;
        }
      }
      if (bestItem !== current) {
        optimizedEquipment[slot] = bestItem;
        if (slot === "Main Hand" && getWeaponMetadata(bestItem).twoHanded) {
          optimizedEquipment["Off Hand"] = null;
        }
        changed = true;
      }
    }
    if (!changed) break;
  }

  const scored = scoreLoadout(optimizedEquipment, weights, setBonuses, character.specialization || "", character.level);
  const remainingViolations = getSecondaryRatingHardCapViolations(optimizedEquipment, character.level);
  return {
    character: { ...character, goal },
    equipment: optimizedEquipment,
    score: scored.score,
    setBonusStatus: scored.setBonuses,
    ratingConstraintStatus: {
      requiresUserChoice: false,
      allSecondaryStatsOverCap,
      preferredSecondaryStat,
      originalViolations,
      remainingViolations,
      balanced: remainingViolations.length === 0,
      unableToFullyBalance: remainingViolations.length > 0
    }
  };
}

function findUpgradeOpportunities({
  currentEquipment = {},
  availableItems = [],
  goal = WOW_GOALS.general,
  statWeights = null,
  className = "",
  specialization = "",
  characterLevel = null,
  setBonuses = [],
  limit = 6
} = {}) {
  const weights = statWeights || resolveStatWeights({
    goal,
    className,
    specialization
  });
  const upgrades = [];
  const baselineLoadoutScore = scoreLoadout(
    currentEquipment, weights, setBonuses, specialization, characterLevel
  ).score;

  // Expand verified imported variants before level comparisons and scoring. The base
  // record can be a low-level drop while its verified variant is the usable upgrade.
  const upgradeCandidates = (availableItems || []).flatMap(rawItem => {
    if (!Array.isArray(rawItem?.variants) || !rawItem.variants.length) return [rawItem];
    return rawItem.variants.map(variant => ({ ...rawItem, ...variant, id: rawItem.id ?? variant.id, baseItemId: rawItem.id ?? rawItem.itemId, variants: undefined }));
  });

  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const currentItem = currentEquipment[slot];
    const currentScore = scoreItem(currentItem, weights);
    const candidates = upgradeCandidates.filter(rawItem =>
      itemMatchesSlot(rawItem, slot) &&
      itemAllowedForClass(rawItem, className) &&
      itemAllowedForClassWeapon(rawItem, slot, className) &&
      itemAllowedForSpecialization(rawItem, slot, className, specialization) &&
      hasUsableItemStats(rawItem)
    )
      .map(rawItem => {
        const item = resolveCatalogItemAgainstEquippedVariant(rawItem, currentItem);
        const candidateLevel = Number(item.itemLevel ?? item.level);
        const currentLevel = Number(currentItem?.itemLevel ?? currentItem?.level);
        // No recommendation may lower item level unless it is the same verified
        // equipped variant resolved above. Missing levels remain eligible because
        // the catalog cannot support a safe numeric comparison for those records.
        if (Number.isFinite(candidateLevel) && Number.isFinite(currentLevel) &&
            candidateLevel < currentLevel) {
          return { item, score: -Infinity, itemScore: scoreItem(item, weights), capViolations: [], lowerLevelRejected: true };
        }
        const trialEquipment = { ...currentEquipment, [slot]: item };
        // Never present a single-slot upgrade that pushes a supported level-90
        // loadout beyond a secondary-rating hard cap as a valid recommendation.
        const capViolations = getSecondaryRatingHardCapViolations(trialEquipment, characterLevel);
        if (capViolations.length) {
          return { item, score: -Infinity, itemScore: scoreItem(item, weights), capViolations };
        }
        const trialScore = scoreLoadout(
          trialEquipment, weights, setBonuses, specialization, characterLevel
        ).score;
        return { item, score: trialScore, itemScore: scoreItem(item, weights), capViolations: [] };
      })
      .filter(candidate => !candidate.lowerLevelRejected && candidate.capViolations.length === 0 && candidate.score > baselineLoadoutScore)
      .sort((a, b) => b.score - a.score);

    if (candidates.length) {
      const best = candidates[0];
      upgrades.push({
        slot, currentItem, recommendedItem: best.item, currentScore,
        recommendedScore: best.score, improvement: best.score - baselineLoadoutScore
      });
    }
  }

  // The summary is a six-upgrade shortlist, not one card per equipment slot.
  // Keep at most one ring, one trinket, and one weapon across both hands.
  // A two-handed main-hand recommendation also occupies the weapon allowance
  // and must not be paired with an off-hand recommendation.
  const categoryFor = upgrade => {
    if (upgrade.slot === "Ring 1" || upgrade.slot === "Ring 2") return "ring";
    if (upgrade.slot === "Trinket 1" || upgrade.slot === "Trinket 2") return "trinket";
    if (upgrade.slot === "Main Hand" || upgrade.slot === "Off Hand") return "weapon";
    return upgrade.slot;
  };
  const sorted = upgrades.sort((a, b) => b.improvement - a.improvement);
  const selected = [];
  const usedCategories = new Set();
  for (const upgrade of sorted) {
    const category = categoryFor(upgrade);
    if (usedCategories.has(category)) continue;
    selected.push(upgrade);
    usedCategories.add(category);
    if (selected.length >= Math.max(0, Number(limit) || 6)) break;
  }
  return selected;
}
function rankItems(items, goal = WOW_GOALS.general, statWeights = null) {
  const weights = statWeights || getGoalWeights(goal);
  return (items || []).filter(hasUsableItemStats)
    .map(item => ({ item, score: scoreItem(item, weights) }))
    .sort((a, b) => b.score - a.score);
}

function getUpgradeSystem(dataset) {
  return dataset?.upgradeSystem || dataset?.upgradeData || { tracks: [], crests: [], exchangeRules: [], ascendantVenomstone: null };
}

function findUpgradeTrack(upgradeSystem, track) {
  const tracks = upgradeSystem?.tracks || [];
  return tracks.find(t =>
    String(t.id).toLowerCase() === String(track).toLowerCase() ||
    String(t.name).toLowerCase() === String(track).toLowerCase()
  ) || null;
}

function getTrackRank(track, rank) {
  if (!track) return null;
  const numericRank = Number(rank);
  return (track.rankItemLevels || []).find(r => Number(r.rank) === numericRank) ||
    (track.ranks || []).map((itemLevel, i) => ({ rank: i + 1, itemLevel }))
      .find(r => r.rank === numericRank) || null;
}

/**
 * Return the next legal rank on the item's current upgrade track.
 * No cross-track promotion is inferred here; it must be supplied explicitly by the caller.
 */
function getNextUpgrade({ upgradeSystem, track, rank } = {}) {
  const resolvedTrack = findUpgradeTrack(upgradeSystem, track);
  const currentRank = Number(rank);
  if (!resolvedTrack || !Number.isFinite(currentRank)) return null;
  const maxRank = Number(resolvedTrack.maxRank || resolvedTrack.rankCount || resolvedTrack.ranks?.length || 0);
  if (currentRank >= maxRank) return null;
  const next = getTrackRank(resolvedTrack, currentRank + 1);
  if (!next) return null;
  return {
    track: resolvedTrack.name,
    trackId: resolvedTrack.id,
    fromRank: currentRank,
    toRank: next.rank,
    fromItemLevel: getTrackRank(resolvedTrack, currentRank)?.itemLevel ?? null,
    toItemLevel: next.itemLevel,
    crest: resolvedTrack.crest,
    crestCost: Number(resolvedTrack.crestCostPerUpgrade ?? 20),
    weeklyCrestCap: resolvedTrack.weeklyCrestCap == null ? null : Number(resolvedTrack.weeklyCrestCap)
  };
}

function getUpgradePath({ upgradeSystem, track, rank } = {}) {
  const path = [];
  let currentTrack = track;
  let currentRank = Number(rank);
  while (true) {
    const next = getNextUpgrade({ upgradeSystem, track: currentTrack, rank: currentRank });
    if (!next) break;
    path.push(next);
    currentRank = next.toRank;
  }
  return path;
}

function parseExchangeRatio(rule) {
  const raw = String(rule?.ratio || "1:1");
  const parts = raw.split(":").map(Number);
  return { from: Number.isFinite(parts[0]) ? parts[0] : 1, to: Number.isFinite(parts[1]) ? parts[1] : 1 };
}

function calculateCrestRequirements({ upgradeSystem, track, rank, availableCrests = {}, weeklyUsed = 0 } = {}) {
  const path = getUpgradePath({ upgradeSystem, track, rank });
  const required = {};
  for (const step of path) required[step.crest] = (required[step.crest] || 0) + step.crestCost;

  const exchanges = [];
  for (const [crest, amount] of Object.entries(required)) {
    const have = Number(availableCrests[crest] || 0);
    if (have >= amount) continue;
    let deficit = amount - have;
    let current = crest;
    const visited = new Set();
    while (deficit > 0 && !visited.has(current)) {
      visited.add(current);
      const rule = (upgradeSystem.exchangeRules || []).find(r => r.to === current);
      if (!rule) break;
      const ratio = parseExchangeRatio(rule);
      const neededFrom = Math.ceil(deficit * ratio.from / ratio.to);
      const availableFrom = Number(availableCrests[rule.from] || 0);
      const exchangeNeeded = Math.max(0, neededFrom - availableFrom);
      if (exchangeNeeded > 0) {
        exchanges.push({ from: rule.from, to: rule.to, required: exchangeNeeded, ratio: rule.ratio, requirement: rule.requirement });
      }
      current = rule.from;
      deficit = exchangeNeeded;
    }
  }

  const totalCrests = Object.values(required).reduce((a, b) => a + b, 0);
  const weeklyUsedValue = Number(weeklyUsed) || 0;
  const weeklyCap = Object.prototype.hasOwnProperty.call(upgradeSystem || {}, "weeklyCrestCap")
    ? upgradeSystem.weeklyCrestCap
    : (path[0]?.weeklyCrestCap ?? 100);
  const hasWeeklyCap = weeklyCap !== null && weeklyCap !== undefined && Number.isFinite(Number(weeklyCap));
  const normalizedWeeklyCap = hasWeeklyCap ? Number(weeklyCap) : null;
  return {
    path,
    required,
    exchanges,
    totalCrests,
    weeklyUsed: weeklyUsedValue,
    weeklyCap: normalizedWeeklyCap,
    weeklyRemaining: hasWeeklyCap ? Math.max(0, normalizedWeeklyCap - weeklyUsedValue) : null,
    fitsWeeklyCap: !hasWeeklyCap || weeklyUsedValue + totalCrests <= normalizedWeeklyCap
  };
}

function isAscendantVenomstoneEligible({ upgradeSystem, item = {}, track, rank, maximumQualityTidalCrafted = false } = {}) {
  const rule = upgradeSystem?.ascendantVenomstone;
  if (!rule) return { eligible: false, reasons: ["Ascendant Venomstone data is unavailable."] };
  const reasons = [];
  const slot = item.slot;
  if (!(rule.eligibleSlots || []).includes(slot)) reasons.push("Slot is not eligible.");
  const resolvedTrack = String(track || item.track || "");
  if (!(rule.eligibleTracks || []).some(t => String(t).toLowerCase() === resolvedTrack.toLowerCase())) {
    reasons.push("Track is not eligible.");
  }
  const resolved = findUpgradeTrack(upgradeSystem, resolvedTrack);
  const maxRank = Number(resolved?.maxRank || resolved?.rankCount || resolved?.ranks?.length || 0);
  if (Number(rank ?? item.rank) !== maxRank) reasons.push("Item must be fully upgraded.");
  if (!maximumQualityTidalCrafted && !item.maximumQualityTidalCrafted) {
    reasons.push("Maximum-quality Tidal Crafted status is required.");
  }
  return { eligible: reasons.length === 0, reasons, cost: Number(rule.cost) || 10 };
}

function recommendUpgradePlan({ currentItem, upgradeSystem, availableCrests = {}, weeklyUsed = 0, maximumQualityTidalCrafted = false } = {}) {
  if (!currentItem) return null;
  const track = currentItem.track || currentItem.upgradeTrack;
  const rank = currentItem.rank ?? currentItem.upgradeRank;
  const next = getNextUpgrade({ upgradeSystem, track, rank });
  const crestPlan = calculateCrestRequirements({ upgradeSystem, track, rank, availableCrests, weeklyUsed });
  const venomstone = isAscendantVenomstoneEligible({
    upgradeSystem, item: currentItem, track, rank, maximumQualityTidalCrafted
  });
  return {
    slot: currentItem.slot,
    item: currentItem,
    track,
    rank: Number(rank),
    nextUpgrade: next,
    crestPlan,
    ascendantVenomstone: venomstone
  };
}

function getTierSetCoverageStatus(tierSetCatalogue = null, className = "", specialization = "") {
  const sets = Array.isArray(tierSetCatalogue?.sets) ? tierSetCatalogue.sets : [];
  const mappingOnly = sets.some(set => typeof set?.className === "string" && set?.mappingStatus === "verified");
  const normalizedClass = String(className || "").trim().toLowerCase();
  const classSet = sets.find(set =>
    String(set.class || set.className || "").trim().toLowerCase() === normalizedClass
  ) || null;
  const isVerified = set => set?.itemIdsVerified === true || set?.mappingStatus === "verified";
  const verifiedClasses = sets.filter(isVerified);
  const unverifiedClasses = sets.filter(set => !isVerified(set));
  const uniqueVerifiedPieceIds = classSet && isVerified(classSet)
    ? new Set((classSet.pieces || []).map(piece => Number(piece.itemId)).filter(Number.isFinite)).size
    : 0;
  return {
    catalogueStatus: tierSetCatalogue?.itemMatching?.status || (mappingOnly ? "mapping-only" : "unavailable"),
    className: classSet?.class || classSet?.className || className || null,
    specialization: specialization || null,
    setName: classSet?.setName || null,
    itemMappingVerified: isVerified(classSet),
    verifiedPieceCount: uniqueVerifiedPieceIds,
    expectedPieceCount: 5,
    bonusDescriptionsAvailable: !mappingOnly && Array.isArray(classSet?.specs) &&
      classSet.specs.some(spec => String(spec[0]).toLowerCase() === String(specialization || "").toLowerCase()),
    numericScoringAvailable: false,
    verifiedClassCount: verifiedClasses.length,
    totalClassCount: sets.length,
    unverifiedClasses: unverifiedClasses.map(set => set.class || set.className),
    limitations: [
      mappingOnly
        ? "The item-ID manifest verifies piece membership only; tier bonus effects and numeric scoring are unmodeled."
        : "Tier bonus descriptions do not provide a numeric gear score without simulation-derived or otherwise verified values.",
      ...(isVerified(classSet) ? [] : ["This class's tier-piece item mapping is not verified, so equipped-piece counts may be incomplete."])
    ]
  };
}

function createOptimizationReport({character = createCharacterProfile(), availableItems = [], dataset = null, upgradeSystem = null} = {}) {
  const goal = character.goal || WOW_GOALS.general;
  const simulation = character.simulation || dataset?.simulation || null;
  const simulationContext = getSimulationWeightContext(simulation);
  const statWeights = resolveStatWeights({
    goal,
    className: character.className,
    specialization: character.specialization,
    statProfiles: dataset?.optimizationProfiles,
    simulation
  });
  const statSummary = getCharacterStatSummary(character.statistics, statWeights);
  const setBonuses = dataset?.tierSetBonuses || dataset?.setBonuses || [];
  const optimized = optimizeEquipment({ items: availableItems, character, goal, statWeights, setBonuses });
  const upgrades = findUpgradeOpportunities({
    currentEquipment: character.equipment,
    availableItems,
    goal,
    statWeights,
    className: character.className,
    specialization: character.specialization,
    characterLevel: character.level,
    setBonuses,
    limit: 6
  });
  const system = upgradeSystem || getUpgradeSystem(dataset);
  const upgradePlans = WOW_EQUIPMENT_SLOTS
    .map(slot => character.equipment?.[slot] ? recommendUpgradePlan({
      currentItem: character.equipment[slot], upgradeSystem: system,
      availableCrests: character.crestInventory || {}, weeklyUsed: character.weeklyCrestUsed || 0
    }) : null)
    .filter(Boolean);
  return {
    character, goal, statWeights, optimizedEquipment: optimized.equipment, totalScore: optimized.score,
    setBonusStatus: optimized.setBonusStatus,
    tierSetCoverage: getTierSetCoverageStatus(dataset?.tierSetCatalogue || dataset?.tierSetItemIdManifest, character.className, character.specialization),
    ratingConstraintStatus: optimized.ratingConstraintStatus || {
      requiresUserChoice: false, balanced: true, remainingViolations: []
    },
    topUpgrades: upgrades, upgradePlans, currentStats: statSummary,
    optimizationContext: simulationContext ? {
      source: simulationContext.source,
      method: simulationContext.method,
      patch: simulationContext.patch,
      specialization: simulationContext.specialization,
      characterId: simulationContext.characterId,
      generatedAt: simulationContext.generatedAt
    } : {
      source: "Static goal heuristic (not spec-specific simulation)",
      method: "static-weights-heuristic",
      patch: null,
      specialization: character.specialization || null,
      characterId: character.characterId ?? null,
      generatedAt: null
    },
    recommendationStatus: simulationContext
      ? "simulation-weighted-ranking-not-full-stat-projection"
      : "heuristic-ranking-not-simulation-validated",
    numericProjectionAvailable: false,
    recommendationLimitations: [
      "Gear ranking is not a full combat simulation.",
      "Static fallback weights are not specialization-specific.",
      "Imported item stat presence does not prove complete item or enhancement effects.",
      "Numeric projected character stats are not calculated by this report."
    ],
    equipmentSlots: WOW_EQUIPMENT_SLOTS.length, generatedAt: new Date().toISOString()
  };
}

const WOW_OPTIMIZER_TEST_DATA = [
  { id: 1, name: "Example Helm", slot: "Head", itemLevel: 250, stats: { Strength: 100, Haste: 50, CriticalStrike: 40 } },
  { id: 2, name: "Example Chest", slot: "Chest", itemLevel: 250, stats: { Strength: 120, Mastery: 45, Versatility: 35 } }
];

window.WoWOptimizer = {
  slots: WOW_EQUIPMENT_SLOTS, goals: WOW_GOALS,
  applySecondaryRatingDiminishingReturns, getSecondaryRatingDiminishingReturns, SECONDARY_RATING_DR_TABLE, SECONDARY_RATING_DR_SOFT_TARGETS, getSecondaryRatingTotals, getSecondaryRatingHardCapViolations, getSecondaryRatingSoftTargetPenalty,
  applyTertiaryRatingDiminishingReturns, TERTIARY_RATING_DR_TABLE, getTertiaryRatingTotals,
  createCharacterProfile, normalizeCharacterStatistics, scoreCharacterStatistics, getCharacterStatSummary, resolveStatWeights, normalizeSimulationScaleFactors, getSimulationWeightContext, findBlizzardSpecialization, getSpecProfileContext,
  normalizeImportedEquipment, createCharacterProfileFromImport, normalizeItemStatName, hasUsableItemStats, itemAllowedForClass, scoreTrinketUseEffect, scoreItem, scoreEquipment, getGoalWeights,
  findBestItemForSlot, itemMatchesSlot, itemAllowedForClassWeapon, itemAllowedForSpecialization, getWeaponMetadata, normalizeWeaponType, optimizeEquipment, findUpgradeOpportunities, rankItems,
  getItemSetId, getSetBonusStatus, getTierSetCoverageStatus, scoreSetBonuses, scoreEquipmentWithRatingDiminishingReturns, scoreLoadout,
  getUpgradeSystem, findUpgradeTrack, getTrackRank, getNextUpgrade, getUpgradePath,
  calculateCrestRequirements, isAscendantVenomstoneEligible, recommendUpgradePlan,
  createOptimizationReport, testData: WOW_OPTIMIZER_TEST_DATA
};