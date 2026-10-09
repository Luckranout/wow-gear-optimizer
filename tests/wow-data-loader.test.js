const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("wow-data.js", "utf8");
const context = {
  window: {},
  fetch: async () => ({
    ok: true,
    json: async () => ({
      mode: "Retail",
      expansion: "Midnight",
      season: 2,
      items: [
        { id: 100, name: "Valid Helm", slot: "Head", compatibleSlots: ["Head"] },
        { id: 101, name: "Unmapped source item", slot: null, compatibleSlots: [] },
        { id: 100, name: "Duplicate ID", slot: "Head", compatibleSlots: ["Head"] },
        { id: 102, name: "Invalid compatibility", slot: "Ring 1", compatibleSlots: ["Ring 1", "Unknown"] }
      ]
    })
  })
};
vm.runInNewContext(source, context);
(async () => {
  const data = await context.window.WoWData.loadRetailDataset("fixture.json");
  assert.equal(data.items.length, 1, "only supported, unique equipment should reach the optimizer");
  assert.equal(data.items[0].name, "Valid Helm");
  assert.equal(data.datasetWarnings.length, 1, "excluded catalog entries must be disclosed");
  assert.match(data.datasetWarnings[0], /3 invalid, duplicate, or unsupported catalog entries/);

  const rawErrors = context.window.WoWData.validateRetailDataset({
    mode: "Retail", expansion: "Midnight", season: 2,
    items: [{ id: 101, name: "Unmapped source item", slot: null, compatibleSlots: [] }]
  });
  assert.ok(rawErrors.length > 0, "strict dataset validation must continue rejecting malformed source records");
  console.log("Retail loader regression tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
