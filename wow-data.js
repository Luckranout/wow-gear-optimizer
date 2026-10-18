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

// Independently imported equipment files contain the full candidate catalogue.
const WOW_EQUIPMENT_SECTION_FILES = ["back", "chest", "feet", "hands", "head", "legs", "main-hand", "necklaces", "off-hand", "rings", "shoulders", "trinkets", "waist", "wrists"];

function mergeEquipmentCatalogItems(items) {
  const byIdentity = new Map();
  for (const item of items || []) {
    if (!item || typeof item !== "object") continue;
    const id = item.id ?? item.itemId;
    if (id === null || id === undefined || !item.slot) continue;
    const key = String(id) + "|" + String(item.slot);
    const previous = byIdentity.get(key);
    if (!previous) { byIdentity.set(key, item); continue; }
    const countStats = value => Array.isArray(value?.stats) ? value.stats.length : Object.keys(value?.stats || {}).length;
    const preferred = countStats(item) > countStats(previous) ? item : previous;
    const other = preferred === item ? previous : item;
    const locations = [...(preferred.sourceLocations || []), ...(other.sourceLocations || [])];
    byIdentity.set(key, { ...other, ...preferred, ...(locations.length ? { sourceLocations: [...new Map(locations.map(x => [JSON.stringify(x), x])).values()] } : {}) });
  }
  return [...byIdentity.values()];
}

async function loadEquipmentSections(fetcher = fetch) {
  const items = [], loadedSections = [], unavailableSections = [];
  for (const sectionName of WOW_EQUIPMENT_SECTION_FILES) {
    try {
      const response = await fetcher(`data/equipment-sections/${sectionName}.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const section = await response.json();
      if (section?.section !== sectionName || !Array.isArray(section.items)) throw new Error("Section name or item list is invalid");
      items.push(...normalizeEquipmentItems(section.items.map(item => ({ ...item, catalogSection: sectionName }))));
      loadedSections.push(sectionName);
    } catch (error) { unavailableSections.push({ section: sectionName, reason: String(error?.message || error) }); }
  }
  const merged = mergeEquipmentCatalogItems(items);
  return { items: merged, status: loadedSections.length === WOW_EQUIPMENT_SECTION_FILES.length ? "complete" : loadedSections.length ? "partial" : "unavailable", expectedSectionCount: WOW_EQUIPMENT_SECTION_FILES.length, loadedSections, unavailableSections, itemCount: merged.length };
}
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

  const sectionCatalogue = await loadEquipmentSections();
  data.items = mergeEquipmentCatalogItems([...data.items, ...sectionCatalogue.items]);
  data.catalogSections = { ...sectionCatalogue, itemCount: sectionCatalogue.itemCount, fallbackItemCount: raw.items?.length || 0 };

  // Tier-set data is an optional optimization enhancement, not a dependency
  // for loading ordinary gear. Missing/invalid tier data must never block PvE
  // item scoring; report its absence explicitly so set advice stays conservative.
  let tierCatalogue = null;
  try {
    const tierResponse = await fetch("data/tier-sets-midnight-season-2.json", { cache: "no-store" });
    if (!tierResponse.ok) throw new Error(`HTTP ${tierResponse.status}`);
    const candidateCatalogue = await tierResponse.json();
    const catalogErrors = validateTierSetCatalogue(candidateCatalogue);
    if (catalogErrors.length) throw new Error(catalogErrors.join(" "));
    tierCatalogue = candidateCatalogue;
  } catch (error) {
    console.warn("Tier-set catalogue unavailable; continuing with regular gear optimization:", error);
  }

  data.tierSetCatalogue = tierCatalogue;

  // Mapping-only manifest is kept separate from bonus definitions: verified piece
  // IDs support coverage reporting, but do not imply numeric set-bonus scoring.
  let tierSetItemIdManifest = null;
  try {
    const manifestResponse = await fetch("data/tier-set-item-ids.json", { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}`);
    const candidateManifest = await manifestResponse.json();
    const validSets = Array.isArray(candidateManifest?.sets) &&
      candidateManifest.sets.length === 13 &&
      candidateManifest.sets.every(set => set?.className && set?.setName &&
        set.mappingStatus === "verified" && Array.isArray(set.pieces) &&
        set.pieces.length === 5 && set.pieces.every(piece =>
          Number.isInteger(Number(piece.itemId)) && piece.slot && piece.sourceUrl));
    if (candidateManifest?.expansion !== "Midnight" || Number(candidateManifest?.season) !== 2 || !validSets) {
      throw new Error("Manifest must contain verified five-piece mappings for all 13 Midnight Season 2 class sets.");
    }
    tierSetItemIdManifest = candidateManifest;
  } catch (error) {
    console.warn("Tier-set item ID manifest unavailable; continuing without mapping-only coverage:", error);
  }
  data.tierSetItemIdManifest = tierSetItemIdManifest;
  const manifestSets = data.tierSetItemIdManifest?.sets || [];
  const normalizeSetName = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sourceBackedBonuses = (tierCatalogue?.sets || []).map(set => {
    const manifestSet = manifestSets.find(candidate =>
      normalizeSetName(candidate.className) === normalizeSetName(set.class) &&
      normalizeSetName(candidate.setName) === normalizeSetName(set.setName)
    );
    const aliases = [...new Set([
      set.id, set.setId, set.setName,
      manifestSet?.setId, manifestSet?.setName
    ].filter(value => value !== null && value !== undefined && String(value).trim() !== ""))];
    const pieces = [...(manifestSet?.pieces || []), ...(Array.isArray(set.pieces) ? set.pieces : [])];
    return {
      // The verified item-ID manifest is the canonical identity when present.
      // Keep source catalogue IDs/names as aliases because Blizzard and Wowhead
      // item records do not always use the same set identifier.
      setId: manifestSet?.setId || set.id || set.setId || String(set.setName || "").trim().toLowerCase(),
      aliases,
      name: set.setName,
      class: set.class,
      source: tierCatalogue.source?.url || manifestSet?.sourceUrl || null,
      pieces,
      thresholds: [2, 4].map((pieces, index) => ({
        pieces,
        effects: Object.fromEntries((set.specs || []).map(spec => [spec[0], spec[index + 1]])),
        scoreValue: null,
        source: tierCatalogue.source?.url || null
      }))
    };
  });
  // Add source-backed Shaman tier candidates for four PvE difficulty variants.
  // PvP variants are mapped for set detection but remain excluded from candidates
  // until their stat and item-level records are verified.
  const verifiedTierCandidates = (tierCatalogue?.sets || []).flatMap(set =>
    (set.pieces || []).filter(piece => piece.candidate === true && Number.isFinite(Number(piece.itemLevel)) &&
      Array.isArray(piece.stats) && piece.stats.length > 0).map(piece => ({
        id: piece.itemId,
        name: piece.name,
        slot: piece.slot,
        itemLevel: Number(piece.itemLevel),
        level: Number(piece.itemLevel),
        inventoryType: { name: ({Head:"Head",Shoulders:"Shoulder",Chest:"Chest",Hands:"Hands",Legs:"Legs"})[piece.slot] },
        itemClass: { name: "Armor" },
        itemSubclass: { name: "Mail" },
        stats: piece.stats,
        setId: piece.setId,
        set: piece.setId,
        source: "Wowhead Midnight Season 2 item page",
        sourceUrl: piece.sourceUrl,
        seasonScope: "Midnight Season 2"
      }))
  );
  data.items.push(...verifiedTierCandidates);

  // Use the independently verified item-ID manifest for set membership when
  // the richer tier catalogue is absent. Its 2pc/4pc thresholds intentionally
  // carry no score: piece mapping is not evidence of a numeric combat effect.
  const catalogueClasses = new Set(sourceBackedBonuses.map(set => normalizeSetName(set.class)));
  const manifestOnlyBonuses = manifestSets
    .filter(set => !catalogueClasses.has(normalizeSetName(set.className)))
    .map(set => ({
      setId: set.setId || set.setName,
      aliases: [set.setId, set.setName, set.className].filter(Boolean),
      name: set.setName,
      class: set.className,
      source: set.sourceUrl || "Verified Midnight Season 2 tier-piece ID manifest",
      pieces: set.pieces || [],
      thresholds: [2, 4].map(pieces => ({
        pieces,
        effects: null,
        scoreValue: null,
        source: set.sourceUrl || "Verified piece membership only; numeric bonus scoring unavailable"
      }))
    }));
  data.setBonuses = [...(data.setBonuses || []), ...sourceBackedBonuses, ...manifestOnlyBonuses];

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
  const matchingStatus = catalogue.itemMatching?.status;
  if (!["incomplete", "partial", "complete"].includes(matchingStatus)) {
    errors.push("Tier-set item matching status must be incomplete, partial, or complete.");
  }
  const expectedVariants = catalogue.itemMatching?.expectedVariants || [];
  for (const set of catalogue.sets || []) {
    const pieces = Array.isArray(set.pieces) ? set.pieces : [];
    const candidates = pieces.filter(piece => piece?.candidate === true);
    if (set.itemIdsVerified) {
      const itemIds = new Set();
      for (const piece of pieces) {
        if (!Number.isInteger(Number(piece?.itemId)) || !piece?.setId || !piece?.slot ||
            !expectedVariants.includes(piece?.variant) || !piece?.sourceUrl) {
          errors.push(`Verified tier set ${set.setName} contains an incomplete item-matching record.`);
          break;
        }
        itemIds.add(Number(piece.itemId));
      }
      if (itemIds.size !== 5 || pieces.length !== 5 * expectedVariants.length) {
        errors.push(`Verified tier set ${set.setName} must map five pieces across every expected variant.`);
      }
    } else if (pieces.length) {
      if (set.baseItemIdsVerified !== true || set.candidateVariantsAvailable !== true || candidates.length === 0) {
        errors.push(`Tier set ${set.setName} has candidate records without verified base IDs and partial-candidate metadata.`);
      }
      for (const piece of pieces) {
        if (!Number.isInteger(Number(piece?.itemId)) || !piece?.setId || !piece?.slot || !piece?.sourceUrl) {
          errors.push(`Partial tier set ${set.setName} contains an incomplete source record.`);
          break;
        }
        if (piece.candidate === true &&
            (!Array.isArray(piece.stats) || piece.stats.length < 4 ||
             !piece.stats.every(stat => Number.isFinite(stat?.value) && stat.value > 0 && typeof stat.source === "string" && stat.source.length))) {
          errors.push(`Partial tier set ${set.setName} has a candidate without exact numeric stat provenance.`);
          break;
        }
      }
    } else if (set.candidateVariantsAvailable === true) {
      errors.push(`Tier set ${set.setName} advertises candidates but contains no candidate records.`);
    }
  }
  const verifiedSets = (catalogue.sets || []).filter(set => set.itemIdsVerified).length;
  const candidateSets = (catalogue.sets || []).filter(set =>
    set.candidateVariantsAvailable === true && Array.isArray(set.pieces) && set.pieces.some(piece => piece?.candidate === true)
  ).length;
  if (matchingStatus === "incomplete" && (verifiedSets > 0 || candidateSets > 0)) {
    errors.push("Tier-set matching cannot be incomplete when verified candidates are present.");
  }
  if (matchingStatus === "complete" && verifiedSets !== (catalogue.sets || []).length) {
    errors.push("Tier-set matching cannot be complete while any class set is unverified.");
  }
  if (matchingStatus === "partial" && (candidateSets === 0 || verifiedSets === (catalogue.sets || []).length)) {
    errors.push("Partial tier-set matching requires source-verified candidates and incomplete class maps.");
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
  mergeEquipmentCatalogItems,
  loadEquipmentSections,
  equipmentSectionFiles: WOW_EQUIPMENT_SECTION_FILES,
  loadRetailDataset,
  validateTierSetCatalogue
};
