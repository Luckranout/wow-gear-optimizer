const { createSimulationCraftProfile } = require("../simulation-export.js");

const character = {
  name: "Test Character",
  level: 90,
  class: { name: "Warrior" },
  activeSpec: { name: "Arms" },
  equipment: [
    { id: 1001, slot: "Head" },
    { id: 1002, slot: "Ring 1" },
    { id: 1003, slot: "Main Hand" },
    { id: 1004, slot: "Off Hand" }
  ]
};

const profile = createSimulationCraftProfile(character);
for (const expected of [
  'warrior="Test_Character"',
  "level=90",
  "spec=arms",
  "head=,id=1001",
  "finger1=,id=1002",
  "main_hand=,id=1003",
  "off_hand=,id=1004"
]) {
  if (!profile.includes(expected)) throw new Error(`SimulationCraft export missing: ${expected}`);
}

let failed = false;
try { createSimulationCraftProfile({ class: { name: "Unknown" } }); } catch { failed = true; }
if (!failed) throw new Error("Unsupported class should be rejected");

console.log("Step 16 SimulationCraft profile export passed.");
