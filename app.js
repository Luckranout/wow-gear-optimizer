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
const encounterSelect = document.querySelector("#encounterSelect");
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
const API_BASE_URL = String(window.WOW_API_BASE_URL || "").replace(/\/$/, "");
const DEFAULT_CHARACTER_NAME = "Failing";
const DEFAULT_REALM_NAME = "Burning Legion";
let retailDataset = null;
let importedCharacter = null;

async function loadRealmOptions() {
  if (!realmInput || realmInput.tagName !== "SELECT") return false;
  try {
    const response = await fetch(`${API_BASE_URL}/api/realms`);
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.realms) || !data.realms.length) {
      throw new Error(data?.error || "No Blizzard realms were returned.");
    }
    const currentRealm = realmInput.value;
    const placeholder = `<option value="">${DEFAULT_REALM_NAME}</option>`;
    const options = data.realms
      .filter(realm => realm && realm.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(realm => `<option value="${realm.name}">${realm.name}</option>`)
      .join("");
    realmInput.innerHTML = placeholder + options;
    if (currentRealm && [...realmInput.options].some(option => option.value === currentRealm)) {
      realmInput.value = currentRealm;
    } else {
      realmInput.value = "";
    }
    return true;
  } catch (error) {
    importStatus.classList.add("error");
    importStatus.textContent = `Realm list could not be loaded. The default realm remains available. ${error.message}`;
    return false;
  }
}

async function loadCurrentRetailData() {
  try {
    retailDataset = await WoWData.loadRetailDataset();
    if (encounterSelect) {
      const encounters = Array.isArray(retailDataset.encounters) ? retailDataset.encounters : [];
      encounterSelect.innerHTML = '<option value="">No encounter selected</option>' +
        encounters.map(item => `<option value="${item.id ?? item.name}">${item.name || item.title || "Encounter"}</option>`).join("");
      encounterSelect.disabled = encounters.length === 0;
    }
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
function renderCharacterCoach(report, character) {
  const encounter = retailDataset?.encounters?.find(item =>
    String(item.id ?? item.name) === String(encounterSelect?.value || "")
  ) || null;
  const coach = WoWCharacterCoach.createCharacterCoach({ character, report, goal: goalSelect.value, encounter, dataset: retailDataset });
  document.querySelector("#coachTitle").textContent = `${coach.identity.name} • ${coach.identity.specialization || "Character"}`;
  document.querySelector("#coachHeadline").textContent = coach.summary.nextAction;
  document.querySelector("#coachIdentity").innerHTML = `<strong>${coach.identity.name}</strong><span>${coach.identity.className} • ${coach.identity.specialization} • ${coach.identity.role}</span><small>${coach.identity.goal}</small>`;
  document.querySelector("#coachSummary").textContent = coach.summary.headline;
  document.querySelector("#coachContentLabel").textContent = coach.content.label;
  document.querySelector("#coachContentFocus").textContent = coach.content.focus;
  document.querySelector("#coachContentPriorities").innerHTML = coach.content.priorities.map(item => `<li>${item}</li>`).join("");
  document.querySelector("#coachContentDefensive").textContent = coach.content.defensive;
  document.querySelector("#coachContentCooldowns").textContent = coach.content.cooldowns;
  document.querySelector("#coachContentMistakes").innerHTML = coach.content.mistakes.map(item => `<li>${item}</li>`).join("");
  document.querySelector("#coachPrepFood").textContent = coach.preparation.food;
  document.querySelector("#coachPrepFlask").textContent = coach.preparation.flask;
  document.querySelector("#coachPrepPotions").textContent = coach.preparation.potions;
  document.querySelector("#coachPrepTrinkets").textContent = coach.preparation.trinkets;
  document.querySelector("#coachPrepEnchants").textContent = coach.preparation.enchants;
  document.querySelector("#coachPrepRacial").textContent = coach.preparation.racials;
  document.querySelector("#coachPrepProfessions").textContent = coach.preparation.professions;
  document.querySelector("#coachSituationIncoming").textContent = coach.situations.incomingDamage;
  document.querySelector("#coachSituationHealth").textContent = coach.situations.lowHealth;
  document.querySelector("#coachSituationMovement").textContent = coach.situations.movement;
  document.querySelector("#coachSituationTarget").textContent = coach.situations.targetSwap;
  document.querySelector("#coachSituationAoE").textContent = coach.situations.multipleTargets;
  document.querySelector("#coachSituationCooldown").textContent = coach.situations.cooldownReady;
  document.querySelector("#coachSituationResource").textContent = coach.situations.resourceHigh;
  document.querySelector("#coachSituationRange").textContent = coach.situations.outOfRange;
  document.querySelector("#coachSituationInterrupt").textContent = coach.situations.interruption;
  document.querySelector("#coachSituationNote").textContent = coach.situations.note;
  document.querySelector("#coachEncounterTitle").textContent = coach.encounter.title;
  document.querySelector("#coachEncounterSummary").textContent = coach.encounter.summary;
  document.querySelector("#coachEncounterMechanics").innerHTML = coach.encounter.mechanics.length
    ? coach.encounter.mechanics.map(item => `<li><strong>${item.name}</strong><span>${item.action}</span>${item.description ? `<small>${item.description}</small>` : ""}</li>`).join("")
    : "<li>No encounter-specific mechanics are available for the current selection.";
  document.querySelector("#coachBuildHeadline").textContent = coach.buildSynthesis.headline;
  document.querySelector("#coachBuildTalent").textContent = coach.buildSynthesis.talentLine;
  document.querySelector("#coachBuildStats").textContent = coach.buildSynthesis.statLine + " " + coach.buildSynthesis.statSnapshot;
  document.querySelector("#coachBuildGear").textContent = coach.buildSynthesis.gearLine;
  document.querySelector("#coachBuildNext").textContent = coach.buildSynthesis.next;
  document.querySelector("#coachSetLine").textContent = coach.setCrafted.setLine;
  document.querySelector("#coachBonusLine").textContent = coach.setCrafted.bonusLine;
  document.querySelector("#coachEmbellishmentLine").textContent = coach.setCrafted.embellishmentLine;
  document.querySelector("#coachCraftedLine").textContent = coach.setCrafted.craftedLine;
  document.querySelector("#coachSetRecommendation").textContent = coach.setCrafted.recommendation;
  document.querySelector("#coachSpecialTrinkets").textContent = coach.specialItems.trinketLine;
  document.querySelector("#coachSpecialWeapons").textContent = coach.specialItems.weaponLine;
  document.querySelector("#coachSpecialRanked").innerHTML = coach.specialItems.ranked.length
    ? coach.specialItems.ranked.map(item => `<li><strong>${item.slot}: ${item.name}</strong><span>+${formatGearScore(item.improvement)} weighted score</span></li>`).join("")
    : "<li>No direct trinket or weapon upgrade is ranked.</li>";
  document.querySelector("#coachSpecialNote").textContent = coach.specialItems.note;
  document.querySelector("#coachSpendNext").textContent = coach.spending.next;
  document.querySelector("#coachSpendSteps").innerHTML = coach.spending.steps.length
    ? coach.spending.steps.map(item => `<li><strong>${item.slot}: ${item.title}</strong><span>${item.status}</span><small>${item.resources} • ${item.weeklyFit}</small></li>`).join("")
    : "<li>No immediate upgrade-spending action is identified.</li>";
  document.querySelector("#coachSpendRule").textContent = coach.spending.rule;
  document.querySelector("#coachNextAction").textContent = coach.summary.nextAction;
  document.querySelector("#coachStatsSource").textContent = coach.summary.statSource;
  document.querySelector("#coachStrengths").innerHTML = coach.strengths.length ? coach.strengths.map(item => `<li>${item}</li>`).join("") : "<li>No specific strengths can be established from the current data.</li>";
  document.querySelector("#coachAttention").innerHTML = coach.attention.length ? coach.attention.map(item => `<li>${item}</li>`).join("") : "<li>No immediate attention items were identified from the current data.</li>";
  document.querySelector("#coachPriorities").innerHTML = coach.priorities.length ? coach.priorities.map(item => `<li><strong>${item.section} — ${item.slot}</strong><span>${item.title}</span><small>${item.explanation}</small></li>`).join("") : "<li><strong>No immediate gear action.</strong><span>Use the gameplay plan below and re-run the optimizer after your next gear change.</span></li>";
  document.querySelector("#coachGearPlan").innerHTML = coach.gearPlan.length ? coach.gearPlan.map(item => `<li><strong>${item.slot}: ${item.title}</strong><span>Current: ${item.current}</span><small>${item.explanation}</small></li>`).join("") : "<li>No direct gear replacement is available in the current dataset.</li>";
  document.querySelector("#coachUpgradePlan").innerHTML = coach.upgradePlan.length ? coach.upgradePlan.map(item => `<li><strong>${item.slot}: ${item.title}</strong><span>${item.status}</span><small>${item.resources} • ${item.weeklyFit}</small></li>`).join("") : "<li>No next-track upgrade is currently identified.</li>";
  document.querySelector("#coachLoop").textContent = coach.gameplay.loop;
  document.querySelector("#coachTalentSummary").textContent = coach.gameplay.talentSummary;
  document.querySelector("#coachTalentAdjustments").innerHTML = coach.gameplay.talentAdjustments.length ? coach.gameplay.talentAdjustments.map(item => `<li>${item}</li>`).join("") : "<li>No additional talent-specific adjustment is active.</li>";
  document.querySelector("#coachWhy").textContent = coach.gameplay.why;
  document.querySelector("#coachDefensive").textContent = coach.gameplay.defensive;
  document.querySelector("#coachGameplay").innerHTML = coach.gameplay.beginnerPriority.length ? coach.gameplay.beginnerPriority.map(item => `<li>${item}</li>`).join("") : "<li>Detailed gameplay priorities are not yet curated for this specialization.</li>";
  document.querySelector("#coachCooldowns").textContent = coach.gameplay.cooldownGuidance;
  document.querySelector("#coachMistakes").innerHTML = coach.gameplay.commonMistakes.length ? coach.gameplay.commonMistakes.map(item => `<li>${item}</li>`).join("") : "<li>No curated mistakes are available yet.</li>";
  document.querySelector("#coachPreCombat").innerHTML = coach.gameplay.preCombat.length ? coach.gameplay.preCombat.map(item => `<li>${item}</li>`).join("") : "<li>No curated pre-combat checklist is available yet.</li>";
}

function renderOptimizedLoadout(equipment = {}, score = 0, currentEquipment = {}) {
  // This panel is a target recommendation, not a copy of the character's current gear.
  // Render every supported slot exactly once and explicitly flag missing candidates.
  const entries = slots.map(slot => [slot, equipment[slot] || null, currentEquipment[slot] || null]);
  const sourceLabel = "Recommended target • goal/spec-weighted catalog scoring";
  loadoutResults.innerHTML = entries.map(([slot, item, current]) => {
    if (!item) return `
      <div class="loadout-row" data-equipment-slot="${slot}">
        <div class="loadout-slot">${slot}</div>
        <div class="loadout-item">No verified candidate available</div>
        <div class="loadout-ilvl">Current: ${current?.name || "Empty slot"}</div>
      </div>
    `;
    const sameItem = current && (
      (item.id != null && current.id != null && String(item.id) === String(current.id)) ||
      (item.name && current.name && item.name.trim().toLowerCase() === current.name.trim().toLowerCase())
    );
    return `
      <div class="loadout-row" data-equipment-slot="${slot}">
        <div class="loadout-slot">${slot}</div>
        <div class="loadout-item">${item.name || "Unnamed item"}</div>
        <div class="loadout-ilvl">Target iLvl ${item.itemLevel ?? item.level ?? "—"}</div>
        <div class="loadout-status">${sameItem ? "Already equipped • keep this item" : "Target gear • aim to obtain/equip"}</div>
        <div class="loadout-current">Currently equipped: ${current?.name || "Empty slot"}</div>
      </div>
    `;
  }).join("") + `<div class="loadout-summary"><strong>Recommended target score: ${formatGearScore(score)}</strong><span>${sourceLabel}. Recommendations are limited to items and stat data currently available in the catalog.</span></div>`;
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
    importStatus.textContent = "Enter a character name and select a realm.";
    return;
  }
  lookupCharacterBtn.disabled = true;
  importStatus.classList.remove("error");
  importStatus.textContent = "Looking up your character from Blizzard...";
  try {
    const response = await fetch(`${API_BASE_URL}/api/character?realm=${encodeURIComponent(realm)}&character=${encodeURIComponent(characterName)}`);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      if (!data && response.status === 404 && !API_BASE_URL) {
        throw new Error("Live character lookup is not available on this static deployment. Open the server-backed deployment to use Blizzard lookup.");
      }
      throw new Error(data?.error || `Character lookup failed (HTTP ${response.status}).`);
    }
    if (!data) throw new Error("Character lookup returned an unexpected response.");
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

encounterSelect?.addEventListener("change", () => {
  if (importedCharacter) document.querySelector("#optimizeBtn").click();
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
  optimizationSource.textContent = report.optimizationContext.source === "SimulationCraft"
    ? `Simulation-derived stat weights • ${character.goal} • not a full stat projection`
    : `Static heuristic ranking • ${character.goal} • not spec-specific simulation`;

  renderUpgradeResults(report.topUpgrades);
  renderOptimizedLoadout(report.optimizedEquipment, report.totalScore, WoWOptimizer.normalizeImportedEquipment(importedCharacter?.equipment || []));
  renderCharacterCoach(report, character);
  const resultPlaceholder = document.querySelector("#resultPlaceholder");
  if (resultPlaceholder) resultPlaceholder.style.display = "none";


  const label = importedCharacter
    ? `${character.characterName} • ${character.className} • ${character.specialization}`
    : `${character.className} • ${character.specialization}`;

  resultMessage.textContent = report.topUpgrades.length
    ? `${label} • ${character.goal} — ${report.topUpgrades.length} gear candidates ranked. This is a ranking aid, not a verified best-in-slot result or numeric projected-stat calculation.`
    : `${label} • ${character.goal} — no direct gear candidates ranked from the currently available dataset. This does not prove that no upgrades exist in game.`;
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
  const resultPlaceholder = document.querySelector("#resultPlaceholder");
  if (resultPlaceholder) resultPlaceholder.style.display = "";
  resultMessage.textContent = "Look up a character or choose a class and specialization, then run the optimizer.";
  renderSlots();
});

renderSlots();
loadRealmOptions();
loadCurrentRetailData();
