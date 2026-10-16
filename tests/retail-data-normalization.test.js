const fs = require("fs");
const vm = require("vm");

const context = { window: {}, fetch: async url => {
  const requested = String(url);
  const path = requested.includes("tier-sets-midnight-season-2.json") ? "data/tier-sets-midnight-season-2.json" : requested.includes("data/equipment-sections/") ? requested : "data/current-retail.json";
  return { ok: true, json: async () => JSON.parse(fs.readFileSync(path, "utf8")) };
} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("wow-data.js", "utf8"), context);
const dataLayer = context.window.WoWData;
const tierCatalogue = JSON.parse(fs.readFileSync("data/tier-sets-midnight-season-2.json", "utf8"));
const tierCatalogueErrors = dataLayer.validateTierSetCatalogue(tierCatalogue);
if (tierCatalogueErrors.length) {
  throw new Error("Tier-set catalogue validation failed: " + tierCatalogueErrors.join("; "));
}
if (tierCatalogue.sets.length !== 13 ||
    new Set(tierCatalogue.sets.map(set => set.class)).size !== 13 ||
    tierCatalogue.thresholds.join(",") !== "2,4" ||
    tierCatalogue.itemMatching.status !== "partial" ||
    !tierCatalogue.itemMatching.verifiedClasses?.includes("Shaman") ||
    tierCatalogue.sets.some(set =>
      set.eligibleSlots?.join(",") !== "Head,Shoulders,Chest,Hands,Legs" ||
      set.appearanceVariants?.length !== 6 ||
      (set.class === "Shaman"
        ? set.itemIdsVerified !== true || set.pieces?.length !== 30
        : set.itemIdsVerified !== false || set.pieces?.length !== 0))) {
  throw new Error("Tier-set catalogue must verify Shaman piece IDs while keeping other class matching explicitly incomplete");
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
  if (!real.items.some(item => Number(item.id) === 193751 && item.catalogSection === "head")) throw new Error("Sectioned equipment must be included in the candidate pool");
  const shamanTierCandidates = real.items.filter(item => [271483,271481,271486,271484,271482].includes(Number(item.id)) && item.seasonScope === "Midnight Season 2");
  if (shamanTierCandidates.length !== 20) throw new Error("Expected 20 verified Shaman tier candidates (four PvE variants for each of five slots), got " + shamanTierCandidates.length);
  for (const slot of ["Head","Shoulders","Chest","Hands","Legs"]) {
    if (!shamanTierCandidates.some(item => item.slot === slot && Number(item.itemLevel) > 0 && item.stats?.length)) {
      throw new Error("Missing source-backed Shaman tier candidate for " + slot);
    }
  }
  if (dataLayer.validateRetailDataset(real).length) throw new Error("Real retail dataset failed validation");

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
