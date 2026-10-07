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
const characterFile = document.querySelector("#characterFile");
const importStatus = document.querySelector("#importStatus");
const statsGrid = document.querySelector("#statsGrid");
const simulationFile = document.querySelector("#simulationFile");
const simulationStatus = document.querySelector("#simulationStatus");
const simulationResults = document.querySelector("#simulationResults");
const optimizationSource = document.querySelector("#optimizationSource");
const simulationExportBtn = document.querySelector("#simulationExportBtn");
let importedSimulation = null;
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

function renderSimulationResults(simulation = null) {
  if (!simulation || !simulation.scaleFactors) {
    simulationResults.innerHTML = '<div class="stat-empty">Import SimulationCraft results to see the derived stat weights.</div>';
    return;
  }
  const entries = Object.entries(simulation.scaleFactors)
    .sort((a, b) => b[1] - a[1]);
  simulationResults.innerHTML = entries.map(([stat, value]) => `
    <div class="stat-card">
      <div class="stat-label">${stat}</div>
      <div class="stat-value">${Number(value).toFixed(4)}</div>
    </div>
  `).join("");
}

function setSelectValue(select, value) {
  if (!value) return;
  const option = [...select.options].find(item => item.value === value || item.textContent === value);
  if (option) select.value = option.value;
}

function applyImportedCharacter(character) {
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
  importStatus.textContent = WoWCharacterImport.formatImportedCharacterSummary(character);
  renderCharacterStats(profile.statistics);
  renderSlots();
  resultMessage.textContent = importedSimulation
    ? "Character imported with simulation results. Run the optimizer to evaluate this character using those scale factors."
    : "Character imported. Run the optimizer to evaluate this character's current equipment.";
}

characterFile.addEventListener("change", async () => {
  const file = characterFile.files?.[0];
  if (!file) return;

  const parsed = WoWCharacterImport.parseImportedCharacterJson(await file.text());
  if (!parsed.valid) {
    importedCharacter = null;
    importStatus.textContent = parsed.errors.join(" ");
    importStatus.classList.add("error");
    renderSlots();
    return;
  }

  importStatus.classList.remove("error");
  applyImportedCharacter(parsed.character);
});

simulationExportBtn.addEventListener("click", () => {
  if (!importedCharacter) {
    simulationStatus.classList.add("error");
    simulationStatus.textContent = "Import a character before exporting a SimulationCraft profile.";
    return;
  }
  try {
    const profile = WoWSimulationExport.createSimulationCraftProfile(importedCharacter);
    const blob = new Blob([profile], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${importedCharacter.name || "character"}-optimizer.simc`;
    link.click();
    URL.revokeObjectURL(url);
    simulationStatus.classList.remove("error");
    simulationStatus.textContent = "SimulationCraft profile exported.";
  } catch (error) {
    simulationStatus.classList.add("error");
    simulationStatus.textContent = error.message;
  }
});

simulationFile.addEventListener("change", async () => {
  const file = simulationFile.files?.[0];
  if (!file) return;
  try {
    importedSimulation = WoWSimulationImport.parseSimulationResultJson(await file.text());
    simulationStatus.classList.remove("error");
    simulationStatus.textContent =
      `Loaded ${importedSimulation.source} scale factors for ${importedSimulation.specialization || "unspecified specialization"}.`;
    renderSimulationResults(importedSimulation);
    if (importedCharacter) {
      resultMessage.textContent = "Simulation results loaded. Run the optimizer to use the simulation-derived weights.";
    }
  } catch (error) {
    importedSimulation = null;
    simulationStatus.classList.add("error");
    simulationStatus.textContent = error.message;
  }
});

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
    character.simulation = importedSimulation;
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
  optimizationSource.textContent = report.optimizationContext.source === "SimulationCraft"
    ? `Using SimulationCraft scale factors • ${report.optimizationContext.specialization || character.specialization || "spec not specified"} • patch ${report.optimizationContext.patch || "unspecified"}`
    : `Using baseline goal/spec weights • ${character.goal}`;

  const availableUpgrades = report.topUpgrades
    .map(upgrade => `${upgrade.slot}: ${upgrade.recommendedItem?.name || "Recommended upgrade"}`)
    .join(" • ");

  const label = importedCharacter
    ? `${character.characterName} • ${character.className} • ${character.specialization}`
    : `${character.className} • ${character.specialization}`;

  resultMessage.textContent = availableUpgrades
    ? `${label} • ${character.goal} — ${report.upgradePlans.length} upgrade plans evaluated. Top available upgrades: ${availableUpgrades}`
    : `${label} • ${character.goal} — ${report.upgradePlans.length} upgrade plans evaluated. No matching gear upgrades are available in the current dataset.`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  importedCharacter = null;
  importedSimulation = null;
  characterFile.value = "";
  simulationFile.value = "";
  importStatus.classList.remove("error");
  importStatus.textContent = "No character imported.";
  simulationStatus.classList.remove("error");
  simulationStatus.textContent = "No simulation results imported.";
  renderSimulationResults(null);
  renderCharacterStats({});
  classSelect.disabled = false;
  classSelect.value = "";
  specSelect.disabled = true;
  specSelect.innerHTML = "<option>Select class first</option>";
  goalSelect.value = "Mythic+";
  optimizationSource.textContent = "Optimization source will appear after the optimizer runs.";
  resultMessage.textContent = "Import a character or choose a class and specialization, then run the optimizer.";
  renderSlots();
});

renderSlots();
loadCurrentRetailData();
