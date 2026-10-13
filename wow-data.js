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

function normalizeEquipmentItems(items) {
  const normalized = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const slot = inferEquipmentSlot(item);
    if (!slot) {
      // Supporting records (for example, crafting materials) are not optimizer gear.
      continue;
    }
    const normalizedItem = { ...item, slot };
    normalized.push(normalizedItem);
    // Rings and trinkets can occupy either copy of their equipment slot.
    if (slot === "Ring 1") normalized.push({ ...normalizedItem, slot: "Ring 2" });
    if (slot === "Trinket 1") normalized.push({ ...normalizedItem, slot: "Trinket 2" });
  }
  return normalized;
}

function inferEquipmentSlot(item) {
  if (typeof item.slot === "string" && WOW_DATA_REQUIRED_SLOTS.includes(item.slot)) return item.slot;
  const raw = String(item.inventoryType?.name || item.inventoryType || "")
    .toLowerCase().replace(/[_-]+/g, " ").trim();
  const slots = {
    head: "Head", neck: "Neck", shoulder: "Shoulders", shoulders: "Shoulders",
    cloak: "Back", back: "Back", chest: "Chest", robe: "Chest",
    wrist: "Wrists", wrists: "Wrists", hand: "Hands", hands: "Hands",
    waist: "Waist", legs: "Legs", feet: "Feet",
    finger: "Ring 1", trinket: "Trinket 1",
    "one hand": "Main Hand", "two hand": "Main Hand", "main hand": "Main Hand",
    "off hand": "Off Hand", "held in off hand": "Off Hand", shield: "Off Hand",
    "ranged right": "Main Hand", ranged: "Main Hand", thrown: "Main Hand"
  };
  return slots[raw] || null;
}

function normalizeRetailDataset(input) {
  const base = createEmptyRetailDataset();
  const data = input && typeof input === "object" ? input : {};

  return {
    ...base,
    ...data,
    schemaVersion: data.schemaVersion || base.schemaVersion,
    mode: "Retail",
    items: Array.isArray(data.items) ? normalizeEquipmentItems(data.items) : [],
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

  // Tier bonus descriptions are versioned separately from the large generated
  // item dataset. Failure is surfaced rather than silently claiming complete
  // tier-set coverage.
  const tierResponse = await fetch("data/tier-sets-midnight-season-2.json", { cache: "no-store" });
  if (!tierResponse.ok) {
    throw new Error(`Tier-set catalogue request failed: HTTP ${tierResponse.status}`);
  }
  const tierCatalogue = await tierResponse.json();
  const catalogErrors = validateTierSetCatalogue(tierCatalogue);
  if (catalogErrors.length) throw new Error(catalogErrors.join(" "));

  data.tierSetCatalogue = tierCatalogue;
  const sourceBackedBonuses = (tierCatalogue.sets || []).map(set => ({
    setId: set.id || String(set.setName || "").trim().toLowerCase(),
    name: set.setName,
    class: set.class,
    source: tierCatalogue.source?.url || null,
    pieces: Array.isArray(set.pieces) ? set.pieces : [],
    thresholds: [2, 4].map((pieces, index) => ({
      pieces,
      effects: Object.fromEntries((set.specs || []).map(spec => [spec[0], spec[index + 1]])),
      scoreValue: null
    }))
  }));
  data.setBonuses = [...(data.setBonuses || []), ...sourceBackedBonuses];

  const errors = validateRetailDataset(data);

  if (errors.length) {
    throw new Error(errors.join(" "));
  }

  return data;
}

function validateTierSetCatalogue(catalogue) {
  const errors = [];
  if (!catalogue || catalogue.expansion !== "Midnight" || Number(catalogue.season) !== 2) {
    return ["Tier-set catalogue must identify Midnight Season 2."];
  }
  if (!Array.isArray(catalogue.sets) || catalogue.sets.length !== 13) {
    errors.push("Tier-set catalogue must include all 13 classes.");
  }
  const classes = new Set();
  for (const set of catalogue.sets || []) {
    if (!set?.class || !set?.setName || !Array.isArray(set.specs) || !set.specs.length) {
      errors.push("Each tier set must include a class, set name, and specialization bonus records.");
      continue;
    }
    classes.add(set.class);
    for (const spec of set.specs) {
      if (!Array.isArray(spec) || spec.length < 3 || !spec[0] || !spec[1] || !spec[2]) {
        errors.push(`Tier set ${set.setName} has an incomplete specialization bonus record.`);
      }
    }
  }
  if (classes.size !== 13) errors.push("Tier-set catalogue does not cover 13 unique classes.");
  if (catalogue.thresholds?.join(",") !== "2,4") errors.push("Tier-set thresholds must be 2-piece and 4-piece.");
  if (catalogue.itemMatching?.status !== "incomplete") {
    errors.push("Item matching status must remain explicit until verified item IDs are supplied.");
  }
  return errors;
}

window.WoWData = {
  schemaVersion: WOW_DATA_SCHEMA_VERSION,
  slots: WOW_DATA_REQUIRED_SLOTS,
  createEmptyRetailDataset,
  inferEquipmentSlot,
  normalizeRetailDataset,
  validateRetailDataset,
  loadRetailDataset,
  validateTierSetCatalogue
};
