const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

for (const required of [
  'id="simulationJsonInput"',
  'id="applySimulationBtn"',
  'id="clearSimulationBtn"',
  'id="simulationImportStatus"',
  'simulation-import.js'
]) {
  if (!index.includes(required)) throw new Error(`UI is missing simulation control: ${required}`);
}

for (const required of [
  "WoWSimulationImport.parseSimulationResultJson",
  "character.simulation = importedSimulation",
  "importedSimulation = parsed",
  "optimizationSource.textContent",
  "report.recommendationStatus",
  "No simulation weights applied."
]) {
  if (!app.includes(required)) throw new Error(`App is missing simulation integration: ${required}`);
}

console.log("Simulation import UI contract passed.");
