const fs = require("fs");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

for (const id of ["characterNameInput", "realmInput", "lookupCharacterBtn", "importStatus"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing live lookup control: ${id}`);
}
if (!index.includes("Nothing to import")) throw new Error("Live lookup copy is missing.");
if (!index.includes('id="characterNameInput" type="text" autocomplete="off" value="Failing"')) throw new Error("Default character must be Failing.");
if (!index.includes('id="realmInput" type="text" autocomplete="off" value="Burning Legion"')) throw new Error("Default realm must be Burning Legion.");
if (index.includes('id="simulationFile"')) throw new Error("SimulationCraft upload must not be part of the customer lookup flow.");
if (index.includes('id="simulationExportBtn"')) throw new Error("SimulationCraft export must not be part of the customer lookup flow.");
for (const needle of ["/api/character?", "Looking up your character from Blizzard", "applyLiveCharacter"]) {
  if (!app.includes(needle)) throw new Error(`Missing live lookup behavior: ${needle}`);
}
console.log("Live character lookup UI contract passed.");

