const specs = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Demon Hunter": ["Havoc", "Vengeance", "Devourer"],
  "Druid": ["Balance", "Feral", "Guardian", "Restoration"],
  "Evoker": ["Devastation", "Preservation", "Augmentation"],
  "Hunter": ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage": ["Arcane", "Fire", "Frost"],
  "Monk": ["Brewmaster", "Mistweaver", "Windwalker"],
  "Paladin": ["Holy", "Protection", "Retribution"],
  "Priest": ["Discipline", "Holy", "Shadow"],
  "Rogue": ["Assassination", "Outlaw", "Subtlety"],
  "Shaman": ["Elemental", "Enhancement", "Restoration"],
  "Warlock": ["Affliction", "Demonology", "Destruction"],
  "Warrior": ["Arms", "Fury", "Protection"]
};

const slots = [
  "Head", "Neck", "Shoulders", "Back",
  "Chest", "Wrists", "Hands", "Waist",
  "Legs", "Feet", "Ring 1", "Ring 2",
  "Trinket 1", "Trinket 2", "Main Hand", "Off Hand"
];

const classSelect = document.querySelector("#classSelect");
const specSelect = document.querySelector("#specSelect");
const goalSelect = document.querySelector("#goalSelect");
const slotGrid = document.querySelector("#slotGrid");
const resultMessage = document.querySelector("#resultMessage");
const importStatus = document.querySelector("#importStatus");
const statsGrid = document.querySelector("#statsGrid");
const upgradeResults = document.querySelector("#upgradeResults");
const loadoutResults = document.querySelector("#loadoutResults");
const optimizationSource = document.querySelector("#optimizationSource");
const characterNameInput = document.querySelector("#characterNameInput");
const realmInput = document.querySelector("#realmInput");
const lookupCharacterBtn = document.querySelector("#lookupCharacterBtn");
let retailDataset = null;
let importedCharacter = null;

async function loadCurrentRetailData() {
  try {
    retailDataset = await WoWData.loadRetailDataset();
    document.querySelector(".status").textContent =
      `● ${retailDataset.expansion} Season ${retailDataset.season} data loaded`;
    return true;
  } catch (error) {
    resultMessage.textContent = `Current Retail data could not be loaded: ${error.message}`;
    return false;
  }
}

function renderSlots() {
  slotGrid.innerHTML = slots.map(slot => `
    <div class="slot">
      <div class="slot-name">${slot}</div>
      <div class="slot-status">${importedCharacter?.equipment?.find(item => {
        const normalized = WoWOptimizer.normalizeImportedEquipment(importedCharacter.equipment);
        return normalized[slot]?.id === item.id;
      }) ? "Imported character gear" : "Awaiting character import"}</div>
    </div>
  `).join("");
}

function renderCharacterStats(statistics = {}) {
  const stats = WoWCharacterImport.formatCharacterStatistics(statistics);
  statsGrid.innerHTML = stats.length
    ? stats.map(stat => `
        <div class="stat-card">
          <div class="stat-label">${stat.label}</div>
          <div class="stat-value">${stat.value.toLocaleString()}</div>
        </div>
      `).join("")
    : '<div class="stat-empty">No imported character statistics available.</div>';
}

function formatGearScore(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderUpgradeResults(upgrades = []) {
  if (!upgrades.length) {
    upgradeResults.innerHTML = '<div class="result-empty">No direct gear upgrades are available in the current dataset for the imported character.</div>';
    return;
  }
  const sourceLabel = "Goal/spec-weighted";
  upgradeResults.innerHTML = upgrades.map(upgrade => `
    <article class="upgrade-card">
      <div class="upgrade-card-top">
        <div>
          <div class="upgrade-slot">${upgrade.slot}</div>
          <h3>${upgrade.recommendedItem?.name || "Recommended upgrade"}</h3>
        </div>
        <div class="upgrade-badge">${sourceLabel}</div>
      </div>
      <div class="upgrade-comparison">
        <div>
          <span>Current</span>
          <strong>${upgrade.currentItem?.name || "Empty slot"}</strong>
          <small>Score ${formatGearScore(upgrade.currentScore)}</small>
        </div>
        <div class="upgrade-arrow">→</div>
        <div>
          <span>Recommended</span>
          <strong>${upgrade.recommendedItem?.name || "Unknown item"}</strong>
          <small>Score ${formatGearScore(upgrade.recommendedScore)}</small>
        </div>
      </div>
      <div class="upgrade-improvement">+${formatGearScore(upgrade.improvement)} weighted score</div>
    </article>
  `).join("");
}
function renderOptimizedLoadout(equipment = {}, score = 0) {
  const entries = Object.entries(equipment).filter(([, item]) => item);
  if (!entries.length) {
    loadoutResults.innerHTML = '<div class="result-empty">No optimized loadout is available from the current dataset.</div>';
    return;
  }
  const sourceLabel = "Goal/spec-weighted";
  loadoutResults.innerHTML = entries.map(([slot, item]) => `
    <div class="loadout-row">
      <div class="loadout-slot">${slot}</div>
      <div class="loadout-item">${item.name || "Unnamed item"}</div>
      <div class="loadout-ilvl">iLvl ${item.itemLevel ?? item.level ?? "—"}</div>
    </div>
  `).join("") + `<div class="loadout-summary"><strong>Optimized weighted score: ${formatGearScore(score)}</strong><span>${sourceLabel}</span></div>`;
}
function setSelectValue(select, value) {
  if (!value) return;
  const option = [...select.options].find(item => item.value === value || item.textContent === value);
  if (option) select.value = option.value;
}

function applyLiveCharacter(character) {
  importedCharacter = character;
  const profile = WoWOptimizer.createCharacterProfileFromImport({
    importedCharacter,
    goal: goalSelect.value
  });
  setSelectValue(classSelect, profile.className);
  classSelect.disabled = true;
  specSelect.disabled = false;
  specSelect.innerHTML = `<option value="${profile.specialization}">${profile.specialization}</option>`;
  specSelect.value = profile.specialization;
  importStatus.classList.remove("error");
  importStatus.textContent = WoWCharacterImport.formatImportedCharacterSummary(character) +
    " • Live Blizzard data retrieved " + new Date(character.fetchedAt || Date.now()).toLocaleTimeString();
  renderCharacterStats(profile.statistics);
  renderSlots();
  resultMessage.textContent = "Live character data loaded. Run the optimizer to evaluate the current gear.";
}

async function lookupCharacter() {
  const characterName = characterNameInput.value.trim();
  const realm = realmInput.value.trim();
  if (!characterName || !realm) {
    importStatus.classList.add("error");
    importStatus.textContent = "Enter both a character name and realm.";
    return;
  }
  lookupCharacterBtn.disabled = true;
  importStatus.classList.remove("error");
  importStatus.textContent = "Looking up your character from Blizzard...";
  try {
    const response = await fetch(`/api/character?realm=${encodeURIComponent(realm)}&character=${encodeURIComponent(characterName)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Character lookup failed.");
    applyLiveCharacter(data);
  } catch (error) {
    importedCharacter = null;
    importStatus.classList.add("error");
    importStatus.textContent = error.message;
    renderSlots();
    renderCharacterStats({});
  } finally {
    lookupCharacterBtn.disabled = false;
  }
}
lookupCharacterBtn.addEventListener("click", lookupCharacter);
characterNameInput.addEventListener("keydown", event => { if (event.key === "Enter") lookupCharacter(); });
realmInput.addEventListener("keydown", event => { if (event.key === "Enter") lookupCharacter(); });

classSelect.addEventListener("change", () => {
  const selected = classSelect.value;
  specSelect.innerHTML = "";
  if (!selected) {
    specSelect.disabled = true;
    specSelect.innerHTML = "<option>Select class first</option>";
    return;
  }
  specSelect.disabled = false;
  specSelect.innerHTML = '<option value="">Select specialization</option>' +
    specs[selected].map(spec => `<option>${spec}</option>`).join("");
});

goalSelect.addEventListener("change", () => {
  if (importedCharacter) {
    importStatus.textContent =
      WoWCharacterImport.formatImportedCharacterSummary(importedCharacter) +
      ` • Goal: ${goalSelect.value}`;
  }
});

document.querySelector("#optimizeBtn").addEventListener("click", () => {
  if (!retailDataset) {
    resultMessage.textContent = "Current Retail data is still loading. Try again in a moment.";
    return;
  }

  let character;
  if (importedCharacter) {
    character = WoWOptimizer.createCharacterProfileFromImport({
      importedCharacter,
      goal: goalSelect.value
    });
  } else {
    const cls = classSelect.value;
    const spec = specSelect.value;
    if (!cls || !spec) {
      resultMessage.textContent =
        "Import a character or select a class and specialization before optimizing.";
      return;
    }
    character = WoWOptimizer.createCharacterProfile();
    character.className = cls;
    character.specialization = spec;
    character.goal = goalSelect.value;
    character.simulation = importedSimulation;
  }

  const report = WoWOptimizer.createOptimizationReport({
    character,
    availableItems: retailDataset.items || [],
    dataset: retailDataset
  });

  renderCharacterStats(report.currentStats.trackedStats);
  optimizationSource.textContent = `Using native goal/spec weights • ${character.goal}`;

  renderUpgradeResults(report.topUpgrades);
  renderOptimizedLoadout(report.optimizedEquipment, report.totalScore);


  const label = importedCharacter
    ? `${character.characterName} • ${character.className} • ${character.specialization}`
    : `${character.className} • ${character.specialization}`;

  resultMessage.textContent = report.topUpgrades.length
    ? `${label} • ${character.goal} — ${report.topUpgrades.length} direct gear upgrades found and ranked by the active stat weights.`
    : `${label} • ${character.goal} — no direct gear upgrades are available in the current dataset.`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  importedCharacter = null;
  importedSimulation = null;
  characterNameInput.value = "";
  realmInput.value = "";
  importStatus.classList.remove("error");
  importStatus.textContent = "No character imported.";
  renderCharacterStats({});
  classSelect.disabled = false;
  classSelect.value = "";
  specSelect.disabled = true;
  specSelect.innerHTML = "<option>Select class first</option>";
  goalSelect.value = "Mythic+";
  optimizationSource.textContent = "Optimization source will appear after the optimizer runs.";
  renderUpgradeResults([]);
  renderOptimizedLoadout({});
  resultMessage.textContent = "Look up a character or choose a class and specialization, then run the optimizer.";
  renderSlots();
});

renderSlots();
loadCurrentRetailData();
