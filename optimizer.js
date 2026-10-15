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

function itemMatchesSlot(item, slot) {
  if (!item || !slot) return false;
  if (item.slot === slot) return true;
  const inventoryType = String(item.inventoryType?.name || item.inventoryType || "").trim().toLowerCase();
  const map = {
    head: ["Head"], neck: ["Neck"], shoulder: ["Shoulders"], shoulders: ["Shoulders"],
    cloak: ["Back"], back: ["Back"], chest: ["Chest"], robe: ["Chest"],
    wrist: ["Wrists"], wrists: ["Wrists"], hands: ["Hands"], hand: ["Hands"],
    waist: ["Waist"], legs: ["Legs"], feet: ["Feet"],
    finger: ["Ring 1", "Ring 2"], ring: ["Ring 1", "Ring 2"],
    trinket: ["Trinket 1", "Trinket 2"],
    "one-hand": ["Main Hand"], "main hand": ["Main Hand"], "two-hand": ["Main Hand"],
    "off hand": ["Off Hand"], "held in off-hand": ["Off Hand"], shield: ["Off Hand"], "off-hand": ["Off Hand"]
  };
  return (map[inventoryType] || []).includes(slot);
}

const STAT_WEIGHTS = {
  Strength: 1, Agility: 1, Intellect: 1, Stamina: 0.15,
  CriticalStrike: 0.8, Haste: 0.8, Mastery: 0.8, Versatility: 0.8
};

const WOW_SECONDARY_STAT_DR_THRESHOLDS = [
  { upToPercent: 30, multiplier: 1 },
  { upToPercent: 39, multiplier: 0.9 },
  { upToPercent: 47, multiplier: 0.8 },
  { upToPercent: 54, multiplier: 0.7 },
  { upToPercent: 66, multiplier: 0.6 },
  { upToPercent: 126, multiplier: 0.5 }
];
const WOW_SECONDARY_STAT_DR_SOURCE =
  "Wowhead 12.1.0 Secondary Stat Diminishing Returns guide (updated 2026-03-04): https://www.wowhead.com/guide/diminishing-returns-on-secondary-stats-in-world-of-warcraft-11052";

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
        Number(s.value) || 0
      ])
    : Object.entries(item.stats).map(([stat, value]) => [
        normalizeItemStatName(stat),
        Number(value) || 0
      ]);
  return stats.reduce((score, [stat, value]) =>
    score + value * (statWeights[stat] ?? 0), 0);
}

function hasUsableItemStats(item) {
  if (!item || !item.stats) return false;
  const entries = Array.isArray(item.stats)
    ? item.stats.map(s => [s.stat?.name || s.type?.name || s.name || s.stat, s.value])
    : Object.entries(item.stats);
  return entries.some(([stat, value]) =>
    stat != null && String(stat).trim() !== "" && Number.isFinite(Number(value)) && Number(value) !== 0
  );
}

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


function scoreItem(item, statWeights = STAT_WEIGHTS) {
  if (!item || !hasUsableItemStats(item)) return 0;
  const itemLevel = Number(item.itemLevel ?? item.level) || 0;
  let effectScore = Number(item.effectValue) || 0;
  if (item.isUniqueEffect) effectScore += 5;
  return itemLevel * 2 + scoreItemStats(item, statWeights) + effectScore;
}

function normalizeSetId(item) {
  const raw = item?.setId ?? item?.set?.id ?? item?.itemSet?.id ?? item?.setName ?? item?.set?.name ?? item?.itemSet?.name;
  return raw == null || String(raw).trim() === "" ? null : String(raw).trim().toLowerCase();
}

function getSetBonusContext({ equipment = {}, setBonuses = [], className = "", specialization = "" } = {}) {
  const counts = {};
  for (const item of Object.values(equipment || {})) {
    const setId = normalizeSetId(item);
    if (setId) counts[setId] = (counts[setId] || 0) + 1;
  }
  const normalizedClass = normalizeClassName(className);
  const normalizedSpec = String(specialization || "").trim().toLowerCase();
  const activeBonuses = (setBonuses || []).filter(bonus => {
    const setId = bonus?.setId ?? bonus?.set?.id ?? bonus?.setName ?? bonus?.set?.name;
    const threshold = Number(bonus?.pieces ?? bonus?.threshold ?? bonus?.requiredPieces);
    const value = Number(bonus?.bonusScore ?? bonus?.scoreValue);
    if (setId == null || !Number.isFinite(threshold) || threshold < 2 || !Number.isFinite(value) || value <= 0) return false;
    if (bonus.verified !== true || typeof bonus.source !== "string" || !bonus.source.trim()) return false;
    if (bonus.className && normalizeClassName(bonus.className) !== normalizedClass) return false;
    if (bonus.specialization && String(bonus.specialization).trim().toLowerCase() !== normalizedSpec) return false;
    return (counts[String(setId).trim().toLowerCase()] || 0) >= threshold;
  }).map(bonus => ({
    setId: String(bonus.setId ?? bonus.set?.id ?? bonus.setName ?? bonus.set?.name).trim().toLowerCase(),
    pieces: Number(bonus.pieces ?? bonus.threshold ?? bonus.requiredPieces),
    bonusScore: Number(bonus.bonusScore ?? bonus.scoreValue),
    name: bonus.name || bonus.setName || bonus.set?.name || "Tier set",
    description: bonus.description || null
  }));
  return {
    counts,
    activeBonuses,
    bonusScore: activeBonuses.reduce((sum, bonus) => sum + bonus.bonusScore, 0),
    hasVerifiedScoringData: (setBonuses || []).some(bonus => {
      const value = Number(bonus?.bonusScore ?? bonus?.scoreValue);
      if (!Number.isFinite(value) || value <= 0 || bonus.verified !== true ||
          typeof bonus.source !== "string" || !bonus.source.trim()) return false;
      if (bonus.className && normalizeClassName(bonus.className) !== normalizedClass) return false;
      if (bonus.specialization && String(bonus.specialization).trim().toLowerCase() !== normalizedSpec) return false;
      return true;
    })
  };
}

function getOptimizationProfileRules(profile = {}) {
  const candidate = profile && typeof profile === "object" ? profile : {};
  const statWeights = candidate.statWeights || candidate.weights || {};
  const profileVerified = candidate.verified === true &&
    typeof candidate.source === "string" && candidate.source.trim().length > 0;
  const validWeights = Object.fromEntries(Object.entries(statWeights).filter(([, value]) =>
    Number.isFinite(Number(value))
  ).map(([key, value]) => [normalizeItemStatName(key), Number(value)]));
  const numericMap = source => Object.fromEntries(Object.entries(source || {}).filter(([, value]) =>
    Number.isFinite(Number(value)) && Number(value) >= 0
  ).map(([key, value]) => [normalizeItemStatName(key), Number(value)]));
  const softTargets = profileVerified ? numericMap(candidate.softTargets) : {};
  const hardCaps = profileVerified ? numericMap(candidate.hardCaps) : {};
  const softTargetMultipliers = Object.fromEntries(Object.entries(profileVerified ? (candidate.softTargetMultipliers || {}) : {}).filter(([, value]) =>
    Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1
  ).map(([key, value]) => [normalizeItemStatName(key), Number(value)]));
  const diminishingReturns = {};
  for (const [rawStat, rawRule] of Object.entries(candidate.diminishingReturns || {})) {
    const rule = rawRule && typeof rawRule === "object" ? rawRule : {};
    const ratingPerPercent = Number(rule.ratingPerPercent);
    const suppliedThresholds = Array.isArray(rule.thresholds) ? rule.thresholds.map(entry => ({
      upToPercent: Number(entry?.upToPercent),
      multiplier: Number(entry?.multiplier)
    })).filter(entry => Number.isFinite(entry.upToPercent) && entry.upToPercent > 0 &&
      Number.isFinite(entry.multiplier) && entry.multiplier >= 0 && entry.multiplier <= 1)
      .sort((a, b) => a.upToPercent - b.upToPercent) : [];
    const thresholds = suppliedThresholds.length ? suppliedThresholds : WOW_SECONDARY_STAT_DR_THRESHOLDS;
    if (rule.verified === true && typeof rule.source === "string" && rule.source.trim() &&
        Number.isFinite(ratingPerPercent) && ratingPerPercent > 0) {
      diminishingReturns[normalizeItemStatName(rawStat)] = {
        ratingPerPercent, thresholds, source: rule.source,
        hardCapPercent: Number.isFinite(Number(rule.hardCapPercent)) && Number(rule.hardCapPercent) > 0
          ? Number(rule.hardCapPercent) : 126,
        thresholdSource: suppliedThresholds.length ? rule.source : WOW_SECONDARY_STAT_DR_SOURCE
      };
    }
  }
  return {
    statWeights: validWeights,
    softTargets,
    hardCaps,
    softTargetMultipliers,
    diminishingReturns,
    source: candidate.source || null,
    verified: profileVerified,
    specializationMasteryWeight: profileVerified && Number.isFinite(Number(candidate.specializationMasteryWeight)) &&
      Number(candidate.specializationMasteryWeight) >= 0 ? Number(candidate.specializationMasteryWeight) : null,
    hasRules: Object.keys(softTargets).length > 0 || Object.keys(hardCaps).length > 0 ||
      Object.keys(diminishingReturns).length > 0
  };
}

function scoreStatRating(stat, rating, weight, rules = getOptimizationProfileRules()) {
  const total = Math.max(0, Number(rating) || 0);
  const statWeight = Number(weight) || 0;
  if (!total || !statWeight) return 0;
  const cap = rules.hardCaps[stat];
  let usableRating = cap === undefined ? total : Math.min(total, cap);
  const dr = rules.diminishingReturns[stat];
  if (dr?.hardCapPercent) usableRating = Math.min(usableRating, dr.hardCapPercent * dr.ratingPerPercent);
  if (!usableRating) return 0;

  const target = rules.softTargets[stat];
  const aboveTargetMultiplier = rules.softTargetMultipliers[stat] ?? 0.5;
  const boundaries = new Set([0, usableRating]);
  if (target !== undefined && target > 0 && target < usableRating) boundaries.add(target);
  if (dr) {
    for (const threshold of dr.thresholds) {
      const ratingBoundary = threshold.upToPercent * dr.ratingPerPercent;
      if (ratingBoundary > 0 && ratingBoundary < usableRating) boundaries.add(ratingBoundary);
    }
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  let score = 0;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const from = ordered[index];
    const to = ordered[index + 1];
    const midpoint = (from + to) / 2;
    const drMultiplier = dr
      ? (dr.thresholds.find(threshold => midpoint <= threshold.upToPercent * dr.ratingPerPercent)?.multiplier ??
        dr.thresholds[dr.thresholds.length - 1].multiplier)
      : 1;
    const softMultiplier = target !== undefined && midpoint > target ? aboveTargetMultiplier : 1;
    score += (to - from) * statWeight * drMultiplier * softMultiplier;
  }
  return score;
}

function scoreEquipmentWithProfile(equipment = {}, statWeights = STAT_WEIGHTS, optimizationProfile = {}) {
  const rules = getOptimizationProfileRules(optimizationProfile);
  let score = 0;
  const totals = {};
  for (const item of Object.values(equipment || {})) {
    if (!item) continue;
    score += (Number(item.itemLevel ?? item.level) || 0) * 2;
    score += Number(item.effectValue) || 0;
    if (item.isUniqueEffect) score += 5;
    const entries = Array.isArray(item.stats)
      ? item.stats.map(entry => [entry.stat?.name || entry.type?.name || entry.name || entry.stat, entry.value])
      : Object.entries(item.stats || {});
    for (const [rawStat, rawValue] of entries) {
      const stat = normalizeItemStatName(rawStat);
      const value = Number(rawValue);
      if (!stat || !Number.isFinite(value) || value <= 0) continue;
      totals[stat] = (totals[stat] || 0) + value;
    }
  }
  for (const [stat, total] of Object.entries(totals)) {
    score += scoreStatRating(stat, total, statWeights[stat] ?? 0, rules);
  }
  return score;
}

function scoreItemWithProfile(item, statWeights = STAT_WEIGHTS, optimizationProfile = {}, baselineStats = {}) {
  if (!item || !hasUsableItemStats(item)) return 0;
  const rules = getOptimizationProfileRules(optimizationProfile);
  const itemLevel = Number(item.itemLevel ?? item.level) || 0;
  let score = itemLevel * 2 + (Number(item.effectValue) || 0) + (item.isUniqueEffect ? 5 : 0);
  const entries = Array.isArray(item.stats)
    ? item.stats.map(entry => [entry.stat?.name || entry.type?.name || entry.name || entry.stat, entry.value])
    : Object.entries(item.stats || {});
  for (const [rawStat, rawValue] of entries) {
    const stat = normalizeItemStatName(rawStat);
    const value = Number(rawValue);
    if (!stat || !Number.isFinite(value) || value <= 0) continue;
    const before = Number(baselineStats[stat]) || 0;
    score += scoreStatRating(stat, before + value, statWeights[stat] ?? 0, rules) -
      scoreStatRating(stat, before, statWeights[stat] ?? 0, rules);
  }
  return score;
}

function getEquipmentStatTotals(equipment = {}, omitSlot = null) {
  const totals = {};
  for (const [slot, item] of Object.entries(equipment || {})) {
    if (!item || slot === omitSlot) continue;
    const entries = Array.isArray(item.stats)
      ? item.stats.map(entry => [entry.stat?.name || entry.type?.name || entry.name || entry.stat, entry.value])
      : Object.entries(item.stats || {});
    for (const [rawStat, rawValue] of entries) {
      const stat = normalizeItemStatName(rawStat);
      const value = Number(rawValue);
      if (!stat || !Number.isFinite(value) || value <= 0) continue;
      totals[stat] = (totals[stat] || 0) + value;
    }
  }
  return totals;
}

function hasUniqueItemConflict(candidate, equipment, targetSlot) {
  if (!candidate || candidate.id == null) return false;
  return Object.entries(equipment || {}).some(([slot, item]) =>
    slot !== targetSlot && item && item.id != null && String(item.id) === String(candidate.id)
  );
}

function optimizeLoadoutWithProfile({ items = [], equipment = {}, character = {}, statWeights = STAT_WEIGHTS, optimizationProfile = {} } = {}) {
  const rules = getOptimizationProfileRules(optimizationProfile);
  if (!rules.hasRules) return { equipment, score: scoreEquipment(equipment, statWeights), applied: false };
  const working = { ...equipment };
  const candidatesBySlot = {};
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    candidatesBySlot[slot] = (items || []).filter(item =>
      itemMatchesSlot(item, slot) && itemAllowedForClass(item, character.className) &&
      hasUsableItemStats(item) && item.optimizerEligible !== false
    ).map(item => ({
      item,
      rawScore: scoreItemWithProfile(
        item, statWeights, optimizationProfile, getEquipmentStatTotals(working, slot)
      )
    })).sort((a, b) => b.rawScore - a.rawScore).slice(0, 50).map(entry => entry.item);
  }
  let score = scoreEquipmentWithProfile(working, statWeights, optimizationProfile);
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const slot of WOW_EQUIPMENT_SLOTS) {
      let bestItem = working[slot] || null;
      let bestScore = score;
      for (const candidate of candidatesBySlot[slot]) {
        if (hasUniqueItemConflict(candidate, working, slot)) continue;
        const trial = { ...working, [slot]: candidate };
        const trialScore = scoreEquipmentWithProfile(trial, statWeights, optimizationProfile);
        if (trialScore > bestScore) {
          bestScore = trialScore;
          bestItem = candidate;
        }
      }
      if (bestItem !== working[slot]) {
        working[slot] = bestItem;
        score = bestScore;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { equipment: working, score, applied: true };
}

function evaluateCombatEnhancementOptions({ dataset = null, character = {}, statWeights = STAT_WEIGHTS, optimizationProfile = {} } = {}) {
  const rules = getOptimizationProfileRules(optimizationProfile);
  const groups = [];
  const consumables = dataset?.consumables || {};
  for (const category of ["food", "flaskOrPhial", "potions", "other"]) {
    const records = Array.isArray(consumables[category]) ? consumables[category] : [];
    const current = character.consumables?.[category] ?? null;
    const currentNames = new Set((Array.isArray(current) ? current : current ? [current] : [])
      .map(value => String(value?.id ?? value?.name ?? value).toLowerCase()));
    const candidates = records.map(record => {
      const source = record?.source || record?.statsSource || record?.effectSource || "";
      const verified = record?.effectVerified === true || record?.mechanicsVerified === true;
      const stats = record?.stats && typeof record.stats === "object" && !Array.isArray(record.stats) ? record.stats : null;
      if (!record?.name || !verified || !source || !stats || !Object.keys(stats).length) return null;
      const score = Object.entries(stats).reduce((sum, [rawStat, rawValue]) => {
        const stat = normalizeItemStatName(rawStat);
        const value = Number(rawValue);
        if (!stat || !Number.isFinite(value) || value <= 0) return sum;
        return sum + scoreStatRating(stat, value, statWeights[stat] ?? 0, rules);
      }, 0);
      return { id: record.id ?? null, name: record.name, score, source, stats, alreadyActive: currentNames.has(String(record.id ?? record.name).toLowerCase()) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    groups.push({
      category,
      current: currentNames.size ? [...currentNames] : [],
      recommendation: candidates.find(candidate => !candidate.alreadyActive) || null,
      activeOption: candidates.find(candidate => candidate.alreadyActive) || null,
      verifiedOptions: candidates.length,
      status: candidates.length ? "verified-options-available" : "no-verified-effect-data"
    });
  }
  const buffs = Array.isArray(dataset?.buffs) ? dataset.buffs : [];
  const activeBuffs = new Set((character.buffs || []).map(value => String(value?.id ?? value?.name ?? value).toLowerCase()));
  const verifiedBuffs = buffs.filter(buff => buff?.name && buff?.effectVerified === true && buff?.source &&
    buff?.stats && typeof buff.stats === "object" && !Array.isArray(buff.stats)).map(buff => ({
      id: buff.id ?? null, name: buff.name, source: buff.source,
      alreadyActive: activeBuffs.has(String(buff.id ?? buff.name).toLowerCase()),
      score: Object.entries(buff.stats).reduce((sum, [rawStat, rawValue]) => {
        const stat = normalizeItemStatName(rawStat);
        const value = Number(rawValue);
        return sum + (stat && Number.isFinite(value) && value > 0
          ? scoreStatRating(stat, value, statWeights[stat] ?? 0, rules) : 0);
      }, 0)
    })).sort((a, b) => b.score - a.score);
  return {
    categories: groups,
    buffs: verifiedBuffs,
    scoreAddedToGear: false,
    note: "Buff and consumable estimates are reported separately from gear score. Only records with explicit numeric stats, a verification flag, and a source are eligible; active options are not recommended again."
  };
}

function scoreEquipment(equipment, statWeights = STAT_WEIGHTS, optimizationProfile = {}) {
  const rules = getOptimizationProfileRules(optimizationProfile);
  if (rules.hasRules) return scoreEquipmentWithProfile(equipment, statWeights, optimizationProfile);
  return WOW_EQUIPMENT_SLOTS.reduce((total, slot) =>
    total + scoreItem(equipment?.[slot], statWeights), 0);
}

function scoreTierSetAwareLoadout(equipment, statWeights = STAT_WEIGHTS, setBonuses = [], character = {}, optimizationProfile = {}) {
  const baseScore = scoreEquipment(equipment, statWeights, optimizationProfile);
  const setContext = getSetBonusContext({
    equipment, setBonuses, className: character.className,
    specialization: character.specialization
  });
  return { score: baseScore + setContext.bonusScore, baseScore, setBonusScore: setContext.bonusScore, setContext };
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

function findCaseInsensitiveRecord(records, name) {
  if (!records || typeof records !== "object" || Array.isArray(records)) return null;
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;
  const key = Object.keys(records).find(candidate => candidate.trim().toLowerCase() === target);
  return key ? records[key] : null;
}

function getSpecProfileContext({ dataset = null, className = "", specialization = "", specializationId = null } = {}) {
  const specializationRecord = findBlizzardSpecialization(dataset, specializationId, specialization);
  const classProfiles = findCaseInsensitiveRecord(dataset?.optimizationProfiles, className);
  const optimizationProfile = findCaseInsensitiveRecord(classProfiles, specialization);
  return { specialization: specializationRecord, optimizationProfile };
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

function simulationMatchesSpecialization(simulationContext, specialization = "") {
  if (!simulationContext) return false;
  const simulationSpec = String(simulationContext.specialization || "").trim().toLowerCase();
  const targetSpec = String(specialization || "").trim().toLowerCase();
  return !simulationSpec || !targetSpec || simulationSpec === targetSpec ||
    simulationSpec.endsWith(" " + targetSpec) || targetSpec.endsWith(" " + simulationSpec);
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
  if (simulationMatchesSpecialization(simulationContext, specialization)) {
    return { ...goalWeights, ...simulationContext.scaleFactors };
  }

  const classProfiles = findCaseInsensitiveRecord(statProfiles, className);
  const profile = findCaseInsensitiveRecord(classProfiles, specialization);
  if (!profile || typeof profile !== "object") return goalWeights;
  const verifiedProfile = getOptimizationProfileRules(profile);
  if (!verifiedProfile.verified) return goalWeights;
  const profileWeights = profile.statWeights || profile.weights || profile;
  const merged = { ...goalWeights };
  for (const [stat, value] of Object.entries(profileWeights)) {
    if (["source", "verified", "softTargets", "hardCaps", "diminishingReturns",
      "softTargetMultipliers", "specializationMasteryWeight", "notes"].includes(stat)) continue;
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) merged[normalizeItemStatName(stat)] = numericValue;
  }
  const rules = getOptimizationProfileRules(profile);
  if (rules.specializationMasteryWeight !== null) merged.Mastery = rules.specializationMasteryWeight;
  return merged;
}

function findBestItemForSlot(items, slot, goal, statWeights = null) {
  const weights = statWeights || getGoalWeights(goal);
  return (items || []).filter(item => itemMatchesSlot(item, slot) && hasUsableItemStats(item))
    .map(item => ({ item, score: scoreItem(item, weights) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function forEachCombination(values, size, visit) {
  const chosen = [];
  function walk(start) {
    if (chosen.length === size) {
      visit(chosen.slice());
      return;
    }
    const remaining = size - chosen.length;
    for (let i = start; i <= values.length - remaining; i += 1) {
      chosen.push(values[i]);
      walk(i + 1);
      chosen.pop();
    }
  }
  if (Number.isInteger(size) && size > 0 && values.length >= size) walk(0);
}

function optimizeTierSetThresholds({ items = [], equipment = {}, statWeights = STAT_WEIGHTS, setBonuses = [], character = {}, optimizationProfile = {} } = {}) {
  let bestEquipment = { ...equipment };
  let bestResult = scoreTierSetAwareLoadout(bestEquipment, statWeights, setBonuses, character, optimizationProfile);
  const classKey = normalizeClassName(character.className);
  const specKey = String(character.specialization || "").trim().toLowerCase();

  for (const bonus of setBonuses || []) {
    const rawSetId = bonus?.setId ?? bonus?.set?.id ?? bonus?.setName ?? bonus?.set?.name;
    const threshold = Number(bonus?.pieces ?? bonus?.threshold ?? bonus?.requiredPieces);
    const bonusScore = Number(bonus?.bonusScore ?? bonus?.scoreValue);
    if (rawSetId == null || !Number.isInteger(threshold) || threshold < 2 || threshold > 5 ||
        !Number.isFinite(bonusScore) || bonusScore <= 0 || bonus.verified !== true ||
        typeof bonus.source !== "string" || !bonus.source.trim()) continue;
    if (bonus.className && normalizeClassName(bonus.className) !== classKey) continue;
    if (bonus.specialization && String(bonus.specialization).trim().toLowerCase() !== specKey) continue;

    const setId = String(rawSetId).trim().toLowerCase();
    const candidates = (items || []).filter(item =>
      normalizeSetId(item) === setId &&
      item?.slot && ARMOR_SLOTS.has(item.slot) &&
      itemAllowedForClass(item, character.className) &&
      hasUsableItemStats(item)
    );
    forEachCombination(candidates, threshold, pieces => {
      const slots = pieces.map(piece => piece.slot);
      if (new Set(slots).size !== threshold) return;
      const ids = pieces.filter(piece => piece.id != null).map(piece => String(piece.id));
      if (new Set(ids).size !== ids.length) return;

      const candidateEquipment = { ...equipment };
      for (const piece of pieces) candidateEquipment[piece.slot] = piece;
      const result = scoreTierSetAwareLoadout(candidateEquipment, statWeights, setBonuses, character, optimizationProfile);
      if (result.score > bestResult.score) {
        bestEquipment = candidateEquipment;
        bestResult = result;
      }
    });
  }
  return { equipment: bestEquipment, ...bestResult };
}

function optimizeEquipment({
  items = [],
  character = createCharacterProfile(),
  goal = character.goal || WOW_GOALS.general,
  statWeights = null,
  tierSetAware = false,
  setBonuses = [],
  optimizationProfile = {}
} = {}) {
  const weights = statWeights || getGoalWeights(goal);
  const candidateScore = (item, slot) => scoreItemWithProfile(
    item, weights, optimizationProfile, getEquipmentStatTotals(character.equipment || {}, slot)
  );
  const optimizedEquipment = {};
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const best = (items || []).filter(item => itemMatchesSlot(item, slot) && item.optimizerEligible !== false && itemAllowedForClass(item, character.className) && hasUsableItemStats(item))
      .map(item => ({ item, score: candidateScore(item, slot) }))
      .sort((a, b) => b.score - a.score)[0] || null;
    optimizedEquipment[slot] = best ? best.item : null;
  }

  // A physical item cannot fill both copies of a slot. Choose the best-scoring
  // distinct pair when the catalog has alternatives; keep the best single item
  // only when no second distinct item exists.
  for (const [firstSlot, secondSlot] of [["Ring 1", "Ring 2"], ["Trinket 1", "Trinket 2"], ["Main Hand", "Off Hand"]]) {
    const first = (items || []).filter(item => item.slot === firstSlot && item.optimizerEligible !== false && itemAllowedForClass(item, character.className) && hasUsableItemStats(item))
      .map(item => ({ item, score: candidateScore(item, firstSlot) }))
      .sort((a, b) => b.score - a.score);
    const second = (items || []).filter(item => item.slot === secondSlot && item.optimizerEligible !== false && itemAllowedForClass(item, character.className) && hasUsableItemStats(item))
      .map(item => ({ item, score: candidateScore(item, secondSlot) }))
      .sort((a, b) => b.score - a.score);
    let bestPair = null;
    for (const a of first) {
      for (const b of second) {
        const sameId = a.item.id != null && b.item.id != null && String(a.item.id) === String(b.item.id);
        const sameName = a.item.id == null && b.item.id == null && a.item.name && b.item.name && a.item.name === b.item.name;
        if (sameId || sameName) continue;
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
  const profileOptimized = optimizeLoadoutWithProfile({
    items, equipment: optimizedEquipment, character, statWeights: weights, optimizationProfile
  });
  Object.assign(optimizedEquipment, profileOptimized.equipment);
  if (tierSetAware) {
    const tierOptimized = optimizeTierSetThresholds({
      items, equipment: optimizedEquipment, statWeights: weights, setBonuses, character, optimizationProfile
    });
    Object.assign(optimizedEquipment, tierOptimized.equipment);
  }
  const tierSetScore = tierSetAware
    ? scoreTierSetAwareLoadout(optimizedEquipment, weights, setBonuses, character, optimizationProfile)
    : { score: scoreEquipment(optimizedEquipment, weights, optimizationProfile), baseScore: scoreEquipment(optimizedEquipment, weights, optimizationProfile), setBonusScore: 0, setContext: getSetBonusContext({ equipment: optimizedEquipment, setBonuses, className: character.className, specialization: character.specialization }) };
  return {
    character: { ...character, goal },
    equipment: optimizedEquipment,
    score: tierSetScore.score,
    baseScore: tierSetScore.baseScore,
    setBonusScore: tierSetScore.setBonusScore,
    setContext: tierSetScore.setContext,
    tierSetAware: Boolean(tierSetAware)
  };
}

function findUpgradeOpportunities({
  currentEquipment = {},
  availableItems = [],
  goal = WOW_GOALS.general,
  statWeights = null,
  optimizationProfile = {},
  limit = 5
} = {}) {
  const weights = statWeights || getGoalWeights(goal);
  const upgrades = [];
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const currentItem = currentEquipment[slot];
    const baselineStats = getEquipmentStatTotals(currentEquipment, slot);
    const currentScore = scoreItemWithProfile(currentItem, weights, optimizationProfile, baselineStats);
    const candidates = availableItems.filter(item => itemMatchesSlot(item, slot) && hasUsableItemStats(item) && item.optimizerEligible !== false)
      .map(item => ({ item, score: scoreItemWithProfile(item, weights, optimizationProfile, baselineStats) }))
      .filter(candidate => candidate.score > currentScore)
      .sort((a, b) => b.score - a.score);
    if (candidates.length) {
      const best = candidates[0];
      upgrades.push({
        slot, currentItem, recommendedItem: best.item, currentScore,
        recommendedScore: best.score, improvement: best.score - currentScore
      });
    }
  }
  return upgrades.sort((a, b) => b.improvement - a.improvement).slice(0, limit);
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

function createOptimizationReport({character = createCharacterProfile(), availableItems = [], dataset = null, upgradeSystem = null, tierSetAware = false} = {}) {
  const goal = character.goal || WOW_GOALS.general;
  const simulation = character.simulation || dataset?.simulation || null;
  const rawSimulationContext = getSimulationWeightContext(simulation);
  const simulationContext = simulationMatchesSpecialization(rawSimulationContext, character.specialization)
    ? rawSimulationContext : null;
  const profileContext = getSpecProfileContext({
    dataset, className: character.className, specialization: character.specialization,
    specializationId: character.specializationId
  });
  const optimizationProfile = profileContext.optimizationProfile || {};
  const statWeights = resolveStatWeights({
    goal,
    className: character.className,
    specialization: character.specialization,
    statProfiles: dataset?.optimizationProfiles,
    simulation
  });
  const profileRules = getOptimizationProfileRules(optimizationProfile);
  const statSummary = getCharacterStatSummary(character.statistics, statWeights);
  const setBonuses = Array.isArray(dataset?.setBonuses) ? dataset.setBonuses : [];
  const optimized = optimizeEquipment({
    items: availableItems, character, goal, statWeights, tierSetAware, setBonuses, optimizationProfile
  });
  const upgrades = findUpgradeOpportunities({
    currentEquipment: character.equipment,
    availableItems,
    goal,
    statWeights,
    optimizationProfile,
    limit: 5
  });
  const combatEnhancements = evaluateCombatEnhancementOptions({
    dataset, character, statWeights, optimizationProfile
  });
  const system = upgradeSystem || getUpgradeSystem(dataset);
  const upgradePlans = WOW_EQUIPMENT_SLOTS
    .map(slot => character.equipment?.[slot] ? recommendUpgradePlan({
      currentItem: character.equipment[slot], upgradeSystem: system,
      availableCrests: character.crestInventory || {}, weeklyUsed: character.weeklyCrestUsed || 0
    }) : null)
    .filter(Boolean);
  return {
    character, goal, optimizedEquipment: optimized.equipment, totalScore: optimized.score,
    tierSetAware: optimized.tierSetAware,
    tierSet: {
      enabled: Boolean(tierSetAware),
      bonusScore: optimized.setBonusScore || 0,
      activeBonuses: optimized.setContext?.activeBonuses || [],
      setCounts: optimized.setContext?.counts || {},
      scoringDataAvailable: Boolean(optimized.setContext?.hasVerifiedScoringData),
      note: tierSetAware && !optimized.setContext?.hasVerifiedScoringData
        ? "Tier-set mode is on, but this dataset has no verified numeric set-bonus scoring values. Recommendations remain ordinary stat/level rankings until verified bonus values are imported."
        : null
    },
    topUpgrades: upgrades, upgradePlans, currentStats: statSummary, statWeights,
    statOptimization: {
      profileAvailable: Boolean(profileContext.optimizationProfile),
      profileSource: profileRules.source || profileContext.optimizationProfile?.source || null,
      profileVerified: profileRules.verified,
      softTargets: profileRules.softTargets,
      hardCaps: profileRules.hardCaps,
      diminishingReturnsStats: Object.keys(profileRules.diminishingReturns),
      diminishingReturnsSources: Object.fromEntries(Object.entries(profileRules.diminishingReturns).map(([stat, rule]) => [stat, {
        ratingPerPercent: rule.ratingPerPercent,
        hardCapPercent: rule.hardCapPercent,
        ratingConversionSource: rule.source,
        thresholdCurveSource: rule.thresholdSource
      }])),
      specializationMasteryWeight: profileRules.specializationMasteryWeight,
      applied: profileRules.hasRules,
      note: profileRules.hasRules
        ? "Profile-supplied caps, soft targets, and verified diminishing-return conversions are applied to complete-loadout scoring."
        : "No validated caps, soft targets, or stat-rating conversion profile was available. The optimizer does not invent specialization-specific values."
    },
    combatEnhancements,
    optimizationContext: simulationContext ? {
      source: simulationContext.source,
      method: simulationContext.method,
      patch: simulationContext.patch,
      specialization: simulationContext.specialization,
      characterId: simulationContext.characterId,
      generatedAt: simulationContext.generatedAt
    } : {
      source: profileRules.verified ? profileRules.source : "Static goal heuristic (not spec-specific simulation)",
      method: profileRules.verified ? "specialization-profile" : "static-weights-heuristic",
      patch: null,
      specialization: character.specialization || null,
      characterId: character.characterId ?? null,
      generatedAt: null
    },
    recommendationStatus: simulationContext
      ? "simulation-weighted-ranking-not-full-stat-projection"
      : profileRules.verified
        ? "profile-weighted-ranking-not-full-stat-projection"
        : "heuristic-ranking-not-simulation-validated",
    numericProjectionAvailable: false,
    recommendationLimitations: [
      "Gear ranking is not a full combat simulation.",
      "Specialization weights, soft targets, hard caps, and diminishing-return conversions are applied only when explicitly supplied by a matching profile or simulation.",
      "Imported item stat presence does not prove complete item or enhancement effects.",
      "Buff and consumable estimates are separate from gear score and require verified numeric effect records.",
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
  createCharacterProfile, normalizeCharacterStatistics, scoreCharacterStatistics, getCharacterStatSummary, resolveStatWeights, normalizeSimulationScaleFactors, getSimulationWeightContext, findBlizzardSpecialization, getSpecProfileContext,
  normalizeImportedEquipment, createCharacterProfileFromImport, normalizeItemStatName, hasUsableItemStats, scoreItem, scoreEquipment, getGoalWeights,
  findBestItemForSlot, optimizeEquipment, findUpgradeOpportunities, rankItems,
  normalizeSetId, getSetBonusContext, scoreTierSetAwareLoadout,
  getOptimizationProfileRules, scoreStatRating, scoreEquipmentWithProfile, scoreItemWithProfile,
  secondaryStatDiminishingReturns: WOW_SECONDARY_STAT_DR_THRESHOLDS,
  secondaryStatDiminishingReturnsSource: WOW_SECONDARY_STAT_DR_SOURCE,
  optimizeLoadoutWithProfile, evaluateCombatEnhancementOptions, simulationMatchesSpecialization,
  getUpgradeSystem, findUpgradeTrack, getTrackRank, getNextUpgrade, getUpgradePath,
  calculateCrestRequirements, isAscendantVenomstoneEligible, recommendUpgradePlan,
  createOptimizationReport, testData: WOW_OPTIMIZER_TEST_DATA
};
