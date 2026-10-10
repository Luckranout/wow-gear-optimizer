const fs = require("fs");
const vm = require("vm");

const context = { window: {}, fetch: async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("data/current-retail.json", "utf8")) }) };
vm.createContext(context);
vm.runInContext(fs.readFileSync("wow-data.js", "utf8"), context);
const dataLayer = context.window.WoWData;

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
  if (dataLayer.validateRetailDataset(real).length) throw new Error("Real retail dataset failed validation");
  console.log("Retail equipment slot normalization passed (" + real.items.length + " optimizer candidates).");
})().catch(error => { console.error(error); process.exitCode = 1; });
