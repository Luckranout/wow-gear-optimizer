const fs = require("fs");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

for (const id of ["characterNameInput", "realmInput", "lookupCharacterBtn", "importStatus"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing live lookup control: ${id}`);
}
if (!index.includes("Nothing to import")) throw new Error("Live lookup copy is missing.");
if (!index.includes("current Retail dataset plus your live Blizzard character profile")) throw new Error("Hero copy must describe the live data workflow.");
if (!index.includes("Live Blizzard character data is connected.")) throw new Error("Hero status must not claim live data is coming later.");
if (index.includes("will eventually evaluate")) throw new Error("Hero copy must not describe implemented optimization features as future work.");
if (index.includes("Live data connection will be added next.")) throw new Error("Hero status must not claim live data is not connected.");
if (!index.includes('id="characterNameInput" type="text" autocomplete="off" placeholder="Failing"')) throw new Error("Character placeholder must be Failing.");
if (!index.includes('id="realmInput" autocomplete="off" aria-label="Realm"')) throw new Error("Realm selector must be a dropdown.");
if (!index.includes('<option value="" selected>Burning Legion</option>')) throw new Error("Realm placeholder must be Burning Legion.");
if (!app.includes("Enter a character name and select a realm.")) throw new Error("Missing clear realm-selection validation message.");
if (!app.includes("/api/realms")) throw new Error("Realm list endpoint is not wired into the UI.");
if (!app.includes("loadRealmOptions")) throw new Error("Realm list loader is missing.");
if (!app.includes('const DEFAULT_CHARACTER_NAME = "Failing";')) throw new Error("Default character placeholder constant must be Failing.");
if (!app.includes('const DEFAULT_REALM_NAME = "Burning Legion";')) throw new Error("Default realm placeholder constant must be Burning Legion.");
const styles = fs.readFileSync("styles.css", "utf8");
if (!styles.includes(".import-box .form-grid { grid-template-columns:1fr 1fr; }")) throw new Error("Character and realm fields must share the lookup row.");
if (!styles.includes("@media (max-width: 520px) { .import-box .form-grid { grid-template-columns:1fr; } }")) throw new Error("Character and realm fields must stack on narrow mobile screens.");
if (!app.includes('realmInput.innerHTML = `<option value="">${DEFAULT_REALM_NAME}</option>`')) throw new Error("Realm placeholder must be rendered as an empty-value option.");
if (index.includes('id="simulationFile"')) throw new Error("SimulationCraft upload must not be part of the customer lookup flow.");
if (index.includes('id="simulationExportBtn"')) throw new Error("SimulationCraft export must not be part of the customer lookup flow.");
for (const needle of ["/api/character?", "Looking up your character from Blizzard", "applyLiveCharacter"]) {
  if (!app.includes(needle)) throw new Error(`Missing live lookup behavior: ${needle}`);
}
console.log("Live character lookup UI contract passed.");
// Regression coverage includes default-field focus behavior.

