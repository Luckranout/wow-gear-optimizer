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
if (!app.includes('const placeholder = `<option value="">${DEFAULT_REALM_NAME}</option>`;')) throw new Error("Realm placeholder must be rendered as an empty-value option.");
if (index.includes('id="simulationFile"')) throw new Error("SimulationCraft upload must not be part of the customer lookup flow.");
if (index.includes('id="simulationExportBtn"')) throw new Error("SimulationCraft export must not be part of the customer lookup flow.");
for (const needle of ["/api/character?", "Looking up your character from Blizzard", "applyLiveCharacter"]) {
  if (!app.includes(needle)) throw new Error(`Missing live lookup behavior: ${needle}`);
}
console.log("Live character lookup UI contract passed.");
// Regression coverage includes default-field focus behavior.


if (!index.includes('window.WOW_API_BASE_URL = "https://wow-gear-optimizer-nwj9.vercel.app"')) throw new Error("GitHub Pages must point at the production API.");
const realmsApi = fs.readFileSync("api/realms.js", "utf8");
const characterApi = fs.readFileSync("api/character.js", "utf8");
if (!realmsApi.includes("Access-Control-Allow-Origin")) throw new Error("Realm API must allow the GitHub Pages origin.");
if (!characterApi.includes("Access-Control-Allow-Origin")) throw new Error("Character API must allow the GitHub Pages origin.");

if (!app.includes('const placeholder = `<option value="">${DEFAULT_REALM_NAME}</option>`;')) throw new Error("Realm placeholder must remain an empty-value option.");
if (!app.includes('.filter(realm => realm && realm.name)')) throw new Error("Realm loader must retain valid named Blizzard realms.");
if (!styles.includes(".import-box .form-grid select { min-width: 0; width: 100%; }")) throw new Error("Realm selector must fit its mobile container.");
if (!styles.includes("min-height: 48px; font-size: 16px;")) throw new Error("Mobile realm selector must be comfortably tappable.");

if (styles.includes("\\n@media (max-width: 520px) { .import-box .form-grid { grid-template-columns:1fr; } }")) throw new Error("Mobile realm media query must be separated by a real newline, not a literal escape.");
