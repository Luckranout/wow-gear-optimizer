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


if (!index.includes('window.WOW_API_BASE_URL = window.location.hostname.endsWith("github.io") ? "https://wow-gear-optimizer-nwj9.vercel.app" : ""')) throw new Error("GitHub Pages must use the production API while Vercel previews use same-origin API routes.");
const realmsApi = fs.readFileSync("api/realms.js", "utf8");
const characterApi = fs.readFileSync("api/character.js", "utf8");
if (!realmsApi.includes('require("./cors")') || !realmsApi.includes("setCorsHeaders(req, res)")) throw new Error("Realm API must apply the shared CORS policy.");
if (!characterApi.includes('require("./cors")') || !characterApi.includes("setCorsHeaders(req, res)")) throw new Error("Character API must apply the shared CORS policy.");
const corsApi = fs.readFileSync("api/cors.js", "utf8");
if (!corsApi.includes("https://luckranout.github.io")) throw new Error("Shared CORS policy must allow the GitHub Pages origin.");

if (!app.includes('.filter(realm => realm && realm.name)')) throw new Error("Realm loader must retain valid named Blizzard realms.");
if (!styles.includes(".import-box .form-grid select { min-width: 0; width: 100%; }")) throw new Error("Realm selector must fit its mobile container.");
if (!styles.includes("min-height: 48px; font-size: 16px;")) throw new Error("Mobile realm selector must be comfortably tappable.");

for (const id of ["characterDetailsPanel", "characterDetailName", "characterDetailRealm", "characterDetailLevel", "characterDetailRace", "characterDetailClass", "characterDetailSpec", "characterDetailFaction", "characterDetailGuild", "characterDetailAchievementPoints", "characterDetailAverageItemLevel", "characterDetailEquippedItemLevel", "characterTalentsList", "characterEquipmentList"]) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing live character details element: ${id}`);
}
for (const needle of ["renderCharacterDetails(character);", "clearCharacterDetails();", "clearOptimizationResults();", "Character lookup failed. Previous optimization results were cleared.", "function clearOptimizationResults()", "document.querySelector(\"#characterCoachPanel\").hidden = true;", "document.querySelector(\"#characterCoachPanel\").hidden = false;", "character?.talents", "character?.equipment", "item?.quality?.name", "character?.faction", "character?.guild", "character?.achievementPoints", "character?.averageItemLevel", "character?.equippedItemLevel"]) {
  if (!app.includes(needle)) throw new Error(`Missing character details behavior: ${needle}`);
}
for (const needle of [".character-summary-grid", ".character-detail-columns", ".character-equipment-list", "@media (max-width: 520px)"]) {
  if (!styles.includes(needle)) throw new Error(`Missing character details responsive styling: ${needle}`);
}

if (!app.includes('typeof item?.slot === "string" ? item.slot : (item?.slot?.name || "Equipment")')) throw new Error("Character equipment renderer must support normalized string slot names.");
if (!app.includes('name.textContent = item?.name || "Unnamed item";')) throw new Error("Character equipment renderer must display returned item names.");
if (!app.includes('detail.textContent = formatCharacterDetailItem(item);')) throw new Error("Character equipment renderer must display returned item level and quality details.");
if (!/function applyLiveCharacter\(character\)\s*\{\s*importedCharacter = character;\s*clearOptimizationResults\(\);/.test(app)) throw new Error("Successful character changes must clear old optimizer output.");
console.log("Character details equipment-shape regression coverage passed.");

if (app.includes('.map(realm => `<option value="${realm.name}">${realm.name}</option>`)')) throw new Error("Realm names must not be inserted into HTML markup.");
if (!app.includes('placeholderOption.textContent = DEFAULT_REALM_NAME;')) throw new Error("Realm placeholder must use DOM text content.");
if (!app.includes('option.textContent = String(realm.name);')) throw new Error("Realm names must be assigned as DOM text.");
if (!app.includes('liveSpecOption.textContent = String(profile.specialization);')) throw new Error("Live specialization must be assigned as DOM text.");
console.log("Blizzard-sourced select rendering regression coverage passed.");

if (app.includes('coach.identity.name}</strong>')) throw new Error("Live character coach identity must not inject character data into HTML.");
if (!app.includes('coachIdentityName.textContent = coach.identity.name || "Character";')) throw new Error("Live character coach identity must use DOM text content.");
console.log("Live character identity rendering regression coverage passed.");


for (const needle of [
  "function renderUpgradeResults(upgrades = [])",
  "upgradeResults.replaceChildren();",
  "title.textContent = upgrade.recommendedItem?.name || \"Recommended upgrade\";",
  "currentName.textContent = upgrade.currentItem?.name || \"Empty slot\";",
  "recommendedName.textContent = upgrade.recommendedItem?.name || \"Unknown item\";",
  "function renderOptimizedLoadout(equipment = {}, score = 0)",
  "name.textContent = item.name || \"Unnamed item\";",
  "row.append(slot, name, itemLevel);"
]) {
  if (!app.includes(needle)) throw new Error(`Gear output must render dynamic values as DOM text: ${needle}`);
}
if (app.includes('upgrade.recommendedItem?.name}</h3>')) throw new Error("Recommended gear names must not be interpolated into HTML.");
if (app.includes('${item.name || "Unnamed item"}</div>')) throw new Error("Optimized gear names must not be interpolated into HTML.");
console.log("Gear recommendation and optimized loadout safe-rendering regression coverage passed.");


for (const needle of [
  "function renderTextList(selector, values, emptyMessage)",
  "function renderCoachStructuredList(selector, entries, emptyMessage, getFields)",
  'renderTextList("#coachContentPriorities"',
  'renderTextList("#coachContentMistakes"',
  'renderCoachStructuredList("#coachEncounterMechanics"',
  'renderCoachStructuredList("#coachSpecialRanked"',
  'renderCoachStructuredList("#coachSpendSteps"',
  'renderCoachStructuredList("#coachPriorities"',
  'renderCoachStructuredList("#coachGearPlan"',
  'renderCoachStructuredList("#coachUpgradePlan"',
  'renderTextList("#coachTalentAdjustments"',
  'renderTextList("#coachGameplay"',
  'renderTextList("#coachMistakes"',
  'renderTextList("#coachPreCombat"'
]) {
  if (!app.includes(needle)) throw new Error(`Coach list output must use safe DOM rendering: ${needle}`);
}
for (const unsafe of [
  'coach.encounter.mechanics.map(item => `<li><strong>${item.name}',
  'coach.priorities.map(item => `<li><strong>${item.section}',
  'coach.gearPlan.map(item => `<li><strong>${item.slot}',
  'coach.upgradePlan.map(item => `<li><strong>${item.slot}',
  'coach.gameplay.beginnerPriority.map(item => `<li>${item}</li>`)'
]) {
  if (app.includes(unsafe)) throw new Error(`Unsafe coach HTML interpolation remains: ${unsafe}`);
}
console.log("Character coach dynamic-list safe-rendering regression coverage passed.");


for (const needle of [
  "function renderCharacterStats(statistics = {})",
  "statsGrid.replaceChildren();",
  "label.textContent = String(stat.label ?? \"Stat\");",
  "value.textContent = Number(stat.value).toLocaleString();"
]) {
  if (!app.includes(needle)) throw new Error(`Imported character statistics must render as safe DOM text: ${needle}`);
}
if (app.includes('stats.map(stat => `<div class="stat-card">')) throw new Error("Statistic labels must not be interpolated into HTML.");
console.log("Imported character statistics safe-rendering regression coverage passed.");

const optimizerHandlerStart = app.indexOf('document.querySelector("#optimizeBtn").addEventListener("click"');
const optimizerHandlerEnd = app.indexOf('document.querySelector("#clearBtn").addEventListener("click"', optimizerHandlerStart);
if (optimizerHandlerStart < 0 || optimizerHandlerEnd < 0) throw new Error("Optimizer click handler boundaries are missing.");
const optimizerHandler = app.slice(optimizerHandlerStart, optimizerHandlerEnd);
for (const needle of [
  'resultMessage.textContent = "Optimizing character…";',
  "try {",
  "} catch (error) {",
  "clearOptimizationResults();",
  "renderUpgradeResults([]);",
  "renderOptimizedLoadout({});",
  'optimizationSource.textContent = "Optimization did not complete.";'
]) {
  if (!optimizerHandler.includes(needle)) throw new Error(`Optimizer must reset stale results and surface runtime failures: ${needle}`);
}
if (!optimizerHandler.includes("Optimization failed:")) throw new Error("Optimizer errors must be visible in the result message.");
console.log("Optimizer failure-state regression contract passed.");
