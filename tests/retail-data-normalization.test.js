const fs = require("fs");
const vm = require("vm");

const context = { window: {}, fetch: async url => {
  const requested = String(url);
  const path = requested.includes("tier-sets-midnight-season-2.json") ? "data/tier-sets-midnight-season-2.json" : requested.includes("tier-set-item-ids.json") ? "data/tier-set-item-ids.json" : requested.includes("data/equipment-sections/") ? requested : "data/current-retail.json";
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(path, "utf8")) };
} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("wow-data.js", "utf8"), context);
const dataLayer = context.window.WoWData;
const optimizerContext = { window: {} };
vm.createContext(optimizerContext);
vm.runInContext(fs.readFileSync("optimizer.js", "utf8"), optimizerContext);
const optimizer = optimizerContext.window.WoWOptimizer;

const tierCatalogue = JSON.parse(fs.readFileSync("data/tier-sets-midnight-season-2.json", "utf8"));
const tierCatalogueErrors = dataLayer.validateTierSetCatalogue(tierCatalogue);
if (tierCatalogueErrors.length) {
  throw new Error("Tier-set catalogue validation failed: " + tierCatalogueErrors.join("; "));
}
if (tierCatalogue.sets.length !== 13 ||
    new Set(tierCatalogue.sets.map(set => set.class)).size !== 13 ||
    tierCatalogue.thresholds.join(",") !== "2,4" ||
    tierCatalogue.itemMatching.status !== "partial" ||
    tierCatalogue.itemMatching.verifiedClasses?.length !== 1 ||
    !tierCatalogue.itemMatching.verifiedClasses.includes("Shaman") ||
    tierCatalogue.itemMatching.candidateVariantClasses?.length !== 13 ||
    tierCatalogue.sets.some(set =>
      set.eligibleSlots?.join(",") !== "Head,Shoulders,Chest,Hands,Legs" ||
      set.appearanceVariants?.length !== 6 ||
      set.itemIdsVerified !== (set.class === "Shaman") ||
      set.baseItemIdsVerified !== true ||
      set.candidateVariantsAvailable !== true ||
      !set.pieces?.some(piece => piece.candidate === true))) {
  throw new Error("Tier-set catalogue must distinguish Shaman's canonical six-variant map from partial candidate maps for every class");
}


const samples = [
  [{ id: 1, name: "Helm", inventoryType: { name: "Head" } }, "Head"],
  [{ id: 2, name: "One-hand weapon", inventoryType: { name: "One-Hand" } }, "Main Hand"],
  [{ id: 3, name: "Ring", inventoryType: { name: "Finger" } }, "Ring 1"],
  [{ id: 4, name: "Trinket", inventoryType: { name: "Trinket" } }, "Trinket 1"],
  [{ id: 5, name: "Offhand", inventoryType: { name: "Held In Off-hand" } }, "Off Hand"]
];
for (const [item, expected] of samples) {
  const actual = dataLayer.inferEquipmentSlot(item);
  if (actual !== expected) throw new Error(item.name + ": expected " + expected + ", got " + actual);
}
const normalized = dataLayer.normalizeRetailDataset({
  mode: "Retail", expansion: "Midnight", season: 2,
  items: [
    { id: 10, name: "Test Ring", inventoryType: { name: "Finger" } },
    { id: 11, name: "Test Trinket", inventoryType: { name: "Trinket" } },
    { id: 12, name: "Material", inventoryType: { name: "Non-equippable" } }
  ]
});
if (normalized.items.length !== 4) throw new Error("Ring/trinket slots should expand to four optimizer candidates");
if (!normalized.items.some(item => item.slot === "Ring 2") ||
    !normalized.items.some(item => item.slot === "Trinket 2")) {
  throw new Error("Ring/trinket secondary slots were not generated");
}
const validation = dataLayer.validateRetailDataset(normalized);
if (validation.length) throw new Error("Normalized test dataset failed validation: " + validation.join("; "));
(async () => {
  const real = await dataLayer.loadRetailDataset();
  if (!real.items.length) throw new Error("Real retail dataset produced no equipment candidates");
  if (real.catalogSections?.status !== "complete" || real.catalogSections.loadedSections.length !== dataLayer.equipmentSectionFiles.length) throw new Error("All sectioned equipment catalog files must load");
  if (!real.items.some(item => item.catalogSection === "head")) throw new Error("Sectioned equipment must be included in the candidate pool");
  const shamanTierCandidates = real.items.filter(item => [271483,271481,271486,271484,271482].includes(Number(item.id)) && item.seasonScope === "Midnight Season 2");
  if (shamanTierCandidates.length !== 43) throw new Error("Expected 43 source-verified Shaman tier candidates including exact intermediate upgrade ranks, got " + shamanTierCandidates.length);
  for (const slot of ["Head","Shoulders","Chest","Hands","Legs"]) {
    if (!shamanTierCandidates.some(item => item.slot === slot && Number(item.itemLevel) > 0 && item.stats?.length)) {
      throw new Error("Missing source-backed Shaman tier candidate for " + slot);
    }
  }
  if (dataLayer.validateRetailDataset(real).length) throw new Error("Real retail dataset failed validation");

  // Every class must use the manifest's canonical set ID even when an item
  // record carries a different raw set label. Verify 2pc/4pc activation across
  // the five eligible slots and ensure the fifth piece adds no new threshold.
  const manifest = JSON.parse(fs.readFileSync("data/tier-set-item-ids.json", "utf8"));
  if (manifest.sets.length !== 13) throw new Error("Expected 13 verified class tier-set mappings");
  for (const manifestSet of manifest.sets) {
    const definition = real.setBonuses.find(set => String(set.setId) === String(manifestSet.setId));
    if (!definition) throw new Error("Missing optimizer tier-set definition for " + manifestSet.className);
    for (const piece of manifestSet.pieces) {
      const resolvedId = optimizer.getItemSetId({
        id: piece.itemId, name: piece.name, setId: "inconsistent-source-set-id"
      }, real.setBonuses);
      if (String(resolvedId) !== String(manifestSet.setId).toLowerCase()) {
        throw new Error("Verified item ID did not resolve to canonical tier set for " + manifestSet.className + ": " + resolvedId);
      }
    }
    const specName = tierCatalogue.sets.find(set => set.class === manifestSet.className)?.specs?.[0]?.[0];
    if (!specName) throw new Error("Missing specialization bonus descriptions for " + manifestSet.className);
    const buildLoadout = count => Object.fromEntries(manifestSet.pieces.slice(0, count).map(piece => [
      piece.slot,
      { id: piece.itemId, itemId: piece.itemId, name: piece.name, slot: piece.slot, setId: "inconsistent-source-set-id" }
    ]));
    const two = optimizer.getSetBonusStatus(buildLoadout(2), real.setBonuses, specName);
    const four = optimizer.getSetBonusStatus(buildLoadout(4), real.setBonuses, specName);
    const five = optimizer.getSetBonusStatus(buildLoadout(5), real.setBonuses, specName);
    const active = (status, threshold) => status.bonuses.find(bonus =>
      String(bonus.setId) === String(manifestSet.setId).toLowerCase() &&
      bonus.requiredPieces === threshold
    );
    if (active(two, 2)?.active !== true || active(two, 4)?.active !== false ||
        active(four, 2)?.active !== true || active(four, 4)?.active !== true ||
        active(five, 2)?.active !== true || active(five, 4)?.active !== true ||
        five.counts[String(manifestSet.setId).toLowerCase()] !== 5) {
      throw new Error("Tier threshold counting failed for " + manifestSet.className);
    }
    if (typeof active(two, 2)?.effect !== "string" || !active(two, 2).effect ||
        typeof active(four, 4)?.effect !== "string" || !active(four, 4).effect) {
      throw new Error("Specialization-specific bonus descriptions were not attached for " + manifestSet.className);
    }
    if (active(four, 2)?.scoreValue !== null || active(four, 4)?.scoreValue !== null) {
      throw new Error("Unverified numeric bonus scores must remain disabled for " + manifestSet.className);
    }
  }
  console.log("All 13 class tier-set IDs, specialization descriptions, 2pc/4pc thresholds, and optional fifth-piece behavior passed.");

  // Tier-set coverage is an optional enhancement: a missing/broken tier file
  // must not disable otherwise-valid PvE equipment optimization.
  const fallbackContext = {
    window: {},
    fetch: async url => {
      if (String(url).includes("tier-sets-midnight-season-2.json")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return { ok: true, json: async () => JSON.parse(fs.readFileSync("data/current-retail.json", "utf8")) };
    }
  };
  vm.createContext(fallbackContext);
  vm.runInContext(fs.readFileSync("wow-data.js", "utf8"), fallbackContext);
  const fallbackData = await fallbackContext.window.WoWData.loadRetailDataset();
  if (!fallbackData.items.length) throw new Error("Missing tier catalogue incorrectly blocked core equipment candidates");
  if (fallbackData.tierSetCatalogue !== null) throw new Error("Unavailable tier catalogue should be reported as null");
  console.log("Retail equipment slot normalization and optional tier-catalogue fallback passed (" + real.items.length + " optimizer candidates).");
})().catch(error => { console.error(error); process.exitCode = 1; });
