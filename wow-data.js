// WoW Gear Optimizer data layer
// Normalizes current Retail data for the optimizer.
// Live Blizzard API access must stay server-side; this browser layer only
// consumes a prepared normalized dataset.

const WOW_DATA_SCHEMA_VERSION = "1.0.0";

const WOW_DATA_REQUIRED_SLOTS = [
  "Head", "Neck", "Shoulders", "Back",
  "Chest", "Wrists", "Hands", "Waist",
  "Legs", "Feet", "Ring 1", "Ring 2",
  "Trinket 1", "Trinket 2", "Main Hand", "Off Hand"
];

function createEmptyRetailDataset() {
  return {
    schemaVersion: WOW_DATA_SCHEMA_VERSION,
    game: "World of Warcraft",
    mode: "Retail",
    expansion: "Midnight",
    season: 2,
    patch: null,
    status: "pending-live-import",
    updatedAt: null,
    source: "Blizzard Game Data API",
    items: [],
    gems: [],
    enchants: [],
    embellishments: [],
    upgrades: [],
    upgradeSystem: {
      tracks: [],
      crests: [],
      exchangeRules: [],
      ascendantVenomstone: null
    },
    consumables: {
      food: [],
      flaskOrPhial: [],
      potions: [],
      other: []
    },
    setBonuses: [],
    encounters: [],
    dungeons: [],
    pvp: [],
    notes: [],
    optimizationProfiles: {},
    talents: {
      specializations: [],
      trees: [],
      seasonScope: null,
      source: null,
      specializationCount: 0,
      treeCount: 0,
      nodeCount: 0,
      apexReferenceCount: 0
    }
  };
}

function normalizeRetailDataset(input) {
  const base = createEmptyRetailDataset();
  const data = input && typeof input === "object" ? input : {};

  return {
    ...base,
    ...data,
    schemaVersion: data.schemaVersion || base.schemaVersion,
    mode: "Retail",
    items: Array.isArray(data.items) ? data.items : [],
    gems: Array.isArray(data.gems) ? data.gems : [],
    enchants: Array.isArray(data.enchants) ? data.enchants : [],
    embellishments: Array.isArray(data.embellishments) ? data.embellishments : [],
    upgrades: Array.isArray(data.upgrades) ? data.upgrades : [],
    upgradeSystem: {
      ...base.upgradeSystem,
      ...(data.upgradeSystem || {}),
      tracks: Array.isArray(data.upgradeSystem?.tracks) ? data.upgradeSystem.tracks : [],
      crests: Array.isArray(data.upgradeSystem?.crests) ? data.upgradeSystem.crests : [],
      exchangeRules: Array.isArray(data.upgradeSystem?.exchangeRules) ? data.upgradeSystem.exchangeRules : [],
      ascendantVenomstone: data.upgradeSystem?.ascendantVenomstone || null
    },
    setBonuses: Array.isArray(data.setBonuses) ? data.setBonuses : [],
    optimizationProfiles: data.optimizationProfiles && typeof data.optimizationProfiles === "object"
      ? data.optimizationProfiles : {},
    talents: {
      ...base.talents,
      ...(data.talents || {}),
      specializations: Array.isArray(data.talents?.specializations) ? data.talents.specializations : [],
      trees: Array.isArray(data.talents?.trees) ? data.talents.trees : []
    },
    encounters: Array.isArray(data.encounters) ? data.encounters : [],
    dungeons: Array.isArray(data.dungeons) ? data.dungeons : [],
    pvp: Array.isArray(data.pvp) ? data.pvp : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    consumables: {
      ...base.consumables,
      ...(data.consumables || {}),
      food: Array.isArray(data.consumables?.food) ? data.consumables.food : [],
      flaskOrPhial: Array.isArray(data.consumables?.flaskOrPhial) ? data.consumables.flaskOrPhial : [],
      potions: Array.isArray(data.consumables?.potions) ? data.consumables.potions : [],
      other: Array.isArray(data.consumables?.other) ? data.consumables.other : []
    }
  };
}

function validateRetailDataset(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    errors.push("Dataset is not an object.");
    return errors;
  }

  if (data.mode !== "Retail") {
    errors.push("Dataset mode must be Retail.");
  }

  if (!data.expansion) {
    errors.push("Dataset is missing expansion metadata.");
  }

  if (!Number.isFinite(Number(data.season))) {
    errors.push("Dataset is missing season metadata.");
  }

  if (!Array.isArray(data.items)) {
    errors.push("Dataset items must be an array.");
  }

  for (const item of data.items || []) {
    if (!item.id || !item.name || !item.slot) {
      errors.push("Every item must include id, name, and slot.");
      break;
    }

    if (!WOW_DATA_REQUIRED_SLOTS.includes(item.slot)) {
      errors.push(`Unsupported equipment slot: ${item.slot}`);
      break;
    }
  }

  return errors;
}

async function loadRetailDataset(url = "data/current-retail.json") {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Retail dataset request failed: HTTP ${response.status}`);
  }

  const raw = await response.json();
  const data = normalizeRetailDataset(raw);
  const errors = validateRetailDataset(data);

  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  return data;
}

window.WoWData = {
  schemaVersion: WOW_DATA_SCHEMA_VERSION,
  slots: WOW_DATA_REQUIRED_SLOTS,
  createEmptyRetailDataset,
  normalizeRetailDataset,
  validateRetailDataset,
  loadRetailDataset
};
