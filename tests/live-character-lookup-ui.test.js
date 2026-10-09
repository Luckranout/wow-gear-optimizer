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
if (!app.includes('option.textContent = String(item.name || item.title || "Encounter");')) throw new Error("Encounter names must be assigned as DOM text.");
if (!app.includes("encounterSelect.replaceChildren();")) throw new Error("Encounter options must be rebuilt using DOM nodes.");
if (app.includes('encounters.map(item => `<option value="${item.id ?? item.name}">')) throw new Error("Encounter data must not be interpolated into HTML.");
if (!app.includes('const DEFAULT_CHARACTER_NAME = "Failing";')) throw new Error("Default character placeholder constant must be Failing.");
if (!app.includes('const DEFAULT_REALM_NAME = "Burning Legion";')) throw new Error("Default realm placeholder constant must be Burning Legion.");
const styles = fs.readFileSync("styles.css", "utf8");
if (!styles.includes(".import-box .form-grid { grid-template-columns:1fr 1fr; }")) throw new Error("Character and realm fields must share the lookup row.");
if (!styles.includes("@media (max-width: 520px) { .import-box .form-grid { grid-template-columns:1fr; } }")) throw new Error("Character and realm fields must stack on narrow mobile screens.");
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

if (!app.includes('.filter(realm => realm && realm.name)')) throw new Error("Realm loader must retain valid named Blizzard realms.");
if (!styles.includes(".import-box .form-grid select { min-width: 0; width: 100%; }")) throw new Error("Realm selector must fit its mobile container.");
if (!styles.includes("min-height: 48px; font-size: 16px;")) throw new Error("Mobile realm selector must be comfortably tappable.");

for (const id of ["characterDetailsPanel", "characterDetailName", "characterDetailRealm", "characterDetailLevel", "characterDetailRace", "characterDetailClass", "characterDetailSpec", "characterDetailFaction", "characterDetailGuild", "characterDetailAchievementPoints", "characterDetailAverageItemLevel", "characterDetailEquippedItemLevel", "characterTalentsList", "characterEquipmentList"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing live character details element: ${id}`);
}
for (const needle of ["renderCharacterDetails(character);", "clearCharacterDetails();", "character?.talents", "character?.equipment", "item?.quality?.name", "character?.faction", "character?.guild", "character?.achievementPoints", "character?.averageItemLevel", "character?.equippedItemLevel"]) {
  if (!app.includes(needle)) throw new Error(`Missing character details behavior: ${needle}`);
}
for (const needle of [".character-summary-grid", ".character-detail-columns", ".character-equipment-list", "@media (max-width: 520px)"]) {
  if (!styles.includes(needle)) throw new Error(`Missing character details responsive styling: ${needle}`);
}

if (!app.includes('typeof item?.slot === "string" ? item.slot : (item?.slot?.name || "Equipment")')) throw new Error("Character equipment renderer must support normalized string slot names.");
if (!app.includes('name.textContent = item?.name || "Unnamed item";')) throw new Error("Character equipment renderer must display returned item names.");
if (!app.includes('detail.textContent = formatCharacterDetailItem(item);')) throw new Error("Character equipment renderer must display returned item level and quality details.");
console.log("Character details equipment-shape regression coverage passed.");

if (app.includes('.map(realm => `<option value="${realm.name}">${realm.name}</option>`)')) throw new Error("Realm names must not be inserted into HTML markup.");
if (!app.includes('placeholderOption.textContent = DEFAULT_REALM_NAME;')) throw new Error("Realm placeholder must use DOM text content.");
if (!app.includes('option.textContent = String(realm.name);')) throw new Error("Realm names must be assigned as DOM text.");
if (!app.includes('liveSpecOption.textContent = String(profile.specialization);')) throw new Error("Live specialization must be assigned as DOM text.");
console.log("Blizzard-sourced select rendering regression coverage passed.");

if (app.includes('coach.identity.name}</strong>')) throw new Error("Live character coach identity must not inject character data into HTML.");
if (!app.includes('coachIdentityName.textContent = coach.identity.name || "Character";')) throw new Error("Live character coach identity must use DOM text content.");
console.log("Live character identity rendering regression coverage passed.");
