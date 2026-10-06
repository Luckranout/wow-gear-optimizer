// WoW Gear Optimizer
// Core optimization engine
// Retail / current-season ready
//
// This engine is intentionally data-source independent.
// Blizzard data will be connected later through the secure backend.

const WOW_EQUIPMENT_SLOTS = [
  "Head",
  "Neck",
  "Shoulders",
  "Back",
  "Chest",
  "Wrists",
  "Hands",
  "Waist",
  "Legs",
  "Feet",
  "Ring 1",
  "Ring 2",
  "Trinket 1",
  "Trinket 2",
  "Main Hand",
  "Off Hand"
];

const WOW_GOALS = {
  mythicPlus: "Mythic+",
  raid: "Raid",
  pvp: "PvP",
  general: "General / All-around"
};

const STAT_WEIGHTS = {
  Strength: 1,
  Agility: 1,
  Intellect: 1,
  Stamina: 0.15,
  CriticalStrike: 0.8,
  Haste: 0.8,
  Mastery: 0.8,
  Versatility: 0.8
};

/**
 * Creates an empty character optimization profile.
 */
function createCharacterProfile() {
  return {
    className: "",
    specialization: "",
    goal: "General / All-around",
    equipment: Object.fromEntries(
      WOW_EQUIPMENT_SLOTS.map(slot => [slot, null])
    ),
    gems: [],
    enchants: [],
    embellishments: [],
    upgrades: [],
    consumables: {
      food: null,
      flaskOrPhial: null,
      potions: [],
      other: []
    }
  };
}

/**
 * Calculate the basic stat score of an item.
 */
function scoreItemStats(item, statWeights = STAT_WEIGHTS) {
  if (!item || !item.stats) {
    return 0;
  }

  return Object.entries(item.stats).reduce((score, [stat, value]) => {
    const weight = statWeights[stat] ?? 0;
    return score + (Number(value) || 0) * weight;
  }, 0);
}

/**
 * Gives higher-quality items a reasonable advantage.
 *
 * This is NOT intended to replace full simulation.
 * It provides the first deterministic optimization layer.
 */
function scoreItem(item, statWeights = STAT_WEIGHTS) {
  if (!item) {
    return 0;
  }

  const itemLevelScore = (Number(item.itemLevel) || 0) * 2;
  const statScore = scoreItemStats(item, statWeights);

  let effectScore = 0;

  if (item.effectValue) {
    effectScore += Number(item.effectValue) || 0;
  }

  if (item.isSetPiece) {
    effectScore += 10;
  }

  if (item.isUniqueEffect) {
    effectScore += 5;
  }

  return itemLevelScore + statScore + effectScore;
}

/**
 * Score a complete equipment set.
 */
function scoreEquipment(equipment, statWeights = STAT_WEIGHTS) {
  let total = 0;

  for (const slot of WOW_EQUIPMENT_SLOTS) {
    total += scoreItem(equipment?.[slot], statWeights);
  }

  return total;
}

/**
 * Apply goal-specific adjustments.
 */
function getGoalWeights(goal) {
  const weights = { ...STAT_WEIGHTS };

  switch (goal) {
    case WOW_GOALS.mythicPlus:
      weights.Haste *= 1.08;
      weights.CriticalStrike *= 1.04;
      break;

    case WOW_GOALS.raid:
      weights.Mastery *= 1.06;
      weights.CriticalStrike *= 1.04;
      break;

    case WOW_GOALS.pvp:
      weights.Versatility *= 1.12;
      weights.Haste *= 1.05;
      break;

    case WOW_GOALS.general:
    default:
      break;
  }

  return weights;
}

/**
 * Find the best item for one equipment slot.
 */
function findBestItemForSlot(items, slot, goal) {
  const statWeights = getGoalWeights(goal);

  const candidates = (items || [])
    .filter(item => item.slot === slot)
    .map(item => ({
      item,
      score: scoreItem(item, statWeights)
    }))
    .sort((a, b) => b.score - a.score);

  return candidates.length ? candidates[0] : null;
}

/**
 * Build the best available equipment set from supplied data.
 */
function optimizeEquipment({
  items = [],
  character = createCharacterProfile(),
  goal = character.goal || WOW_GOALS.general
} = {}) {
  const optimizedEquipment = {};

  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const best = findBestItemForSlot(items, slot, goal);
    optimizedEquipment[slot] = best
      ? best.item
      : null;
  }

  return {
    character: {
      ...character,
      goal
    },
    equipment: optimizedEquipment,
    score: scoreEquipment(
      optimizedEquipment,
      getGoalWeights(goal)
    )
  };
}

/**
 * Find the most important upgrades compared with the current character.
 */
function findUpgradeOpportunities({
  currentEquipment = {},
  availableItems = [],
  goal = WOW_GOALS.general,
  limit = 5
} = {}) {
  const statWeights = getGoalWeights(goal);
  const upgrades = [];

  for (const slot of WOW_EQUIPMENT_SLOTS) {
    const currentItem = currentEquipment[slot];
    const currentScore = scoreItem(currentItem, statWeights);

    const candidates = availableItems
      .filter(item => item.slot === slot)
      .map(item => ({
        item,
        score: scoreItem(item, statWeights)
      }))
      .filter(candidate => candidate.score > currentScore)
      .sort((a, b) => b.score - a.score);

    if (candidates.length) {
      const best = candidates[0];

      upgrades.push({
        slot,
        currentItem,
        recommendedItem: best.item,
        currentScore,
        recommendedScore: best.score,
        improvement: best.score - currentScore
      });
    }
  }

  return upgrades
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, limit);
}

/**
 * Rank a collection of items.
 */
function rankItems(items, goal = WOW_GOALS.general) {
  const statWeights = getGoalWeights(goal);

  return (items || [])
    .map(item => ({
      item,
      score: scoreItem(item, statWeights)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Create a complete optimization report.
 */
function createOptimizationReport({
  character = createCharacterProfile(),
  availableItems = []
} = {}) {
  const goal = character.goal || WOW_GOALS.general;

  const optimized = optimizeEquipment({
    items: availableItems,
    character,
    goal
  });

  const upgrades = findUpgradeOpportunities({
    currentEquipment: character.equipment,
    availableItems,
    goal,
    limit: 5
  });

  return {
    character,
    goal,
    optimizedEquipment: optimized.equipment,
    totalScore: optimized.score,
    topUpgrades: upgrades,
    equipmentSlots: WOW_EQUIPMENT_SLOTS.length,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Example test data.
 * This is only used until real Blizzard data is connected.
 */
const WOW_OPTIMIZER_TEST_DATA = [
  {
    id: 1,
    name: "Example Helm",
    slot: "Head",
    itemLevel: 250,
    stats: {
      Strength: 100,
      Haste: 50,
      CriticalStrike: 40
    }
  },
  {
    id: 2,
    name: "Example Chest",
    slot: "Chest",
    itemLevel: 250,
    stats: {
      Strength: 120,
      Mastery: 45,
      Versatility: 35
    }
  }
];

/**
 * Public API used by the website.
 */
window.WoWOptimizer = {
  slots: WOW_EQUIPMENT_SLOTS,
  goals: WOW_GOALS,

  createCharacterProfile,
  scoreItem,
  scoreEquipment,
  getGoalWeights,
  findBestItemForSlot,
  optimizeEquipment,
  findUpgradeOpportunities,
  rankItems,
  createOptimizationReport,

  testData: WOW_OPTIMIZER_TEST_DATA
};
