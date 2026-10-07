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
  general: "General / All-around"
};

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

function scoreItemStats(item, statWeights = STAT_WEIGHTS) {
  if (!item || !item.stats) return 0;
  const stats = Array.isArray(item.stats)
    ? Object.fromEntries(item.stats.map(s => [s.stat?.name || s.name, Number(s.value) || 0]))
    : item.stats;
  return Object.entries(stats).reduce((score, [stat, value]) =>
    score + (Number(value) || 0) * (statWeights[stat] ?? 0), 0);
}

function scoreItem(item, statWeights = STAT_WEIGHTS) {
  if (!item) return 0;
  const itemLevel = Number(item.itemLevel ?? item.level) || 0;
  let effectScore = Number(item.effectValue) || 0;
  if (item.isSetPiece) effectScore += 10;
  if (item.isUniqueEffect) effectScore += 5;
  return itemLevel * 2 + scoreItemStats(item, statWeights) + effectScore;
}

function scoreEquipment(equipment, statWeights = STAT_WEIGHTS) {
  return WOW_EQUIPMENT_SLOTS.reduce((total, slot) =>
    total + scoreItem(equipment?.[slot], statWeights), 0);
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
    strength: "Strength", agility: "Agility", intellect: "Intellect", stamina: "Stamina",
    criticalstrike: "CriticalStrike", crit: "CriticalStrike", critrating: "CriticalStrike",
    haste: "Haste", hasterating: "Haste", mastery: "Mastery", masteryrating: "Mastery",
    versatility: "Versatility", versatilityrating: "Versatility"
  };
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(scaleFactors || {})) {
    const key = String(rawKey).replace(/[\s_-]/g, "").toLowerCase();
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) continue;
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
  if (!statProfiles || typeof statProfiles !== "object") return goalWeights;

  const classProfiles = statProfiles[className];
  const profile = classProfiles?.[specialization];
  if (!profile || typeof profile !== "object") return goalWeights;

  const merged = { ...goalWeights };
  for (const [stat, value] of Object.entries(profile)) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      merged[stat] = numericValue;
    }
  }
  return merged;
}

function findBestItemForSlot(items, slot, goal, statWeights = null) {
  const weights = statWeights || getGoalWeights(goal);
  return (items || []).filter(item => item.slot === slot)
    .map(item => ({ item, score: scoreItem(item, weights) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function optimizeEquipment({
  items = [],
  character = createCharacterProfile(),
  goal = character.goal || WOW_GOALS.general,
  statWeights = null
} = {}) {
  const weights = statWeights || getGoalWeights(goal);
  const optimizedEquipment = {};
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const best = findBestItemForSlot(items, slot, goal, weights);
    optimizedEquipment[slot] = best ? best.item : null;
  }
  return {
    character: { ...character, goal },
    equipment: optimizedEquipment,
    score: scoreEquipment(optimizedEquipment, weights)
  };
}

function findUpgradeOpportunities({currentEquipment = {}, availableItems = [], goal = WOW_GOALS.general, limit = 5} = {}) {
  const statWeights = getGoalWeights(goal);
  const upgrades = [];
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const currentItem = currentEquipment[slot];
    const currentScore = scoreItem(currentItem, statWeights);
    const candidates = availableItems.filter(item => item.slot === slot)
      .map(item => ({ item, score: scoreItem(item, statWeights) }))
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

function rankItems(items, goal = WOW_GOALS.general) {
  const statWeights = getGoalWeights(goal);
  return (items || []).map(item => ({ item, score: scoreItem(item, statWeights) }))
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
    weeklyCrestCap: Number(resolvedTrack.weeklyCrestCap ?? 100)
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
  return {
    path,
    required,
    exchanges,
    totalCrests,
    weeklyUsed: Number(weeklyUsed) || 0,
    weeklyRemaining: Math.max(0, 100 - (Number(weeklyUsed) || 0)),
    fitsWeeklyCap: (Number(weeklyUsed) || 0) + totalCrests <= 100
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
  const optimized = optimizeEquipment({ items: availableItems, character, goal, statWeights });
  const upgrades = findUpgradeOpportunities({ currentEquipment: character.equipment, availableItems, goal, limit: 5 });
  const system = upgradeSystem || getUpgradeSystem(dataset);
  const upgradePlans = WOW_EQUIPMENT_SLOTS
    .map(slot => character.equipment?.[slot] ? recommendUpgradePlan({
      currentItem: character.equipment[slot], upgradeSystem: system,
      availableCrests: character.crestInventory || {}, weeklyUsed: character.weeklyCrestUsed || 0
    }) : null)
    .filter(Boolean);
  return {
    character, goal, optimizedEquipment: optimized.equipment, totalScore: optimized.score,
    topUpgrades: upgrades, upgradePlans, currentStats: statSummary,
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
  normalizeImportedEquipment, createCharacterProfileFromImport, scoreItem, scoreEquipment, getGoalWeights,
  findBestItemForSlot, optimizeEquipment, findUpgradeOpportunities, rankItems,
  getUpgradeSystem, findUpgradeTrack, getTrackRank, getNextUpgrade, getUpgradePath,
  calculateCrestRequirements, isAscendantVenomstoneEligible, recommendUpgradePlan,
  createOptimizationReport, testData: WOW_OPTIMIZER_TEST_DATA
};
