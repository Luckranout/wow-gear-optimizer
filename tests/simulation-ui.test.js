const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

for (const required of [
  'id="simulationFile"',
  'id="simulationStatus"',
  'simulation-import.js'
]) {
  if (!index.includes(required)) throw new Error(`UI is missing simulation control: ${required}`);
}

for (const required of [
  "WoWSimulationImport.parseSimulationResultJson",
  "character.simulation = importedSimulation"
]) {
  if (!app.includes(required)) throw new Error(`App is missing simulation integration: ${required}`);
}

console.log("Step 14 simulation UI contract passed.");
