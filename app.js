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
const characterDetailsPanel = document.querySelector("#characterDetailsPanel");
const characterDetailName = document.querySelector("#characterDetailName");
const characterDetailRealm = document.querySelector("#characterDetailRealm");
const characterDetailLevel = document.querySelector("#characterDetailLevel");
const characterDetailRace = document.querySelector("#characterDetailRace");
const characterDetailClass = document.querySelector("#characterDetailClass");
const characterDetailSpec = document.querySelector("#characterDetailSpec");
const characterDetailFaction = document.querySelector("#characterDetailFaction");
const characterDetailGuild = document.querySelector("#characterDetailGuild");
const characterDetailAchievementPoints = document.querySelector("#characterDetailAchievementPoints");
const characterDetailAverageItemLevel = document.querySelector("#characterDetailAverageItemLevel");
const characterDetailEquippedItemLevel = document.querySelector("#characterDetailEquippedItemLevel");
const characterTalentsList = document.querySelector("#characterTalentsList");
const characterEquipmentList = document.querySelector("#characterEquipmentList");
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
    realmInput.innerHTML = "";
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = DEFAULT_REALM_NAME;
    realmInput.appendChild(placeholderOption);
    data.realms
      .filter(realm => realm && realm.name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(realm => {
        const option = document.createElement("option");
        option.value = String(realm.name);
        option.textContent = String(realm.name);
        realmInput.appendChild(option);
      });
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
      encounterSelect.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "No encounter selected";
      encounterSelect.appendChild(placeholder);
      encounters.forEach(item => {
        const option = document.createElement("option");
        option.value = String(item.id ?? item.name ?? "");
        option.textContent = String(item.name || item.title || "Encounter");
        encounterSelect.appendChild(option);
      });
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
  statsGrid.replaceChildren();
  if (!stats.length) {
    const empty = document.createElement("div");
    empty.className = "stat-empty";
    empty.textContent = "No imported character statistics available.";
    statsGrid.appendChild(empty);
    return;
  }
  stats.forEach(stat => {
    const card = document.createElement("div");
    card.className = "stat-card";
    const label = document.createElement("div");
    label.className = "stat-label";
    label.textContent = String(stat.label ?? "Stat");
    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = Number(stat.value).toLocaleString();
    card.append(label, value);
    statsGrid.appendChild(card);
  });
}

function setCharacterDetailText(element, value) {
  if (element) element.textContent = value == null || value === "" ? "—" : String(value);
}

function formatCharacterDetailItem(item) {
  const quality = item?.quality?.name || "";
  const itemLevel = item?.itemLevel ?? item?.level;
  const parts = [];
  if (itemLevel != null) parts.push(`iLvl ${itemLevel}`);
  if (quality) parts.push(quality);
  return parts.join(" • ") || "Item details returned";
}

function formatCharacterDetailEnhancements(item) {
  const details = [];
  const enchantments = Array.isArray(item?.enchantments) ? item.enchantments.filter(entry => entry?.name || entry?.displayString) : [];
  const gems = Array.isArray(item?.gems) ? item.gems.filter(entry => entry?.name) : [];
  if (enchantments.length) {
    details.push(`Enchant: ${enchantments.map(entry => entry.name || entry.displayString).join(", ")}`);
  }
  if (gems.length) {
    details.push(`Gems: ${gems.map(entry => entry.name).join(", ")}`);
  }
  if (!details.length) {
    const enchantCount = Array.isArray(item?.enchantments) ? item.enchantments.length : 0;
    const gemCount = Array.isArray(item?.gems) ? item.gems.length : 0;
    if (enchantCount) details.push(`${enchantCount} enchantment${enchantCount === 1 ? "" : "s"}`);
    if (gemCount) details.push(`${gemCount} gem${gemCount === 1 ? "" : "s"}`);
  }
  return details.join(" • ");
}

function renderCharacterDetails(character) {
  if (!characterDetailsPanel) return;
  characterDetailsPanel.hidden = false;

  setCharacterDetailText(characterDetailName, character?.name);
  setCharacterDetailText(characterDetailRealm, character?.realm?.name);
  setCharacterDetailText(characterDetailLevel, character?.level);
  setCharacterDetailText(characterDetailRace, character?.race?.name);
  setCharacterDetailText(characterDetailClass, character?.class?.name);
  setCharacterDetailText(characterDetailSpec, character?.activeSpec?.name);
  setCharacterDetailText(characterDetailFaction, character?.faction);
  setCharacterDetailText(characterDetailGuild, character?.guild);
  setCharacterDetailText(characterDetailAchievementPoints, character?.achievementPoints);
  setCharacterDetailText(characterDetailAverageItemLevel, character?.averageItemLevel);
  setCharacterDetailText(characterDetailEquippedItemLevel, character?.equippedItemLevel);

  const talents = Array.isArray(character?.talents) ? character.talents : [];
  characterTalentsList.innerHTML = "";
  if (!talents.length) {
    const empty = document.createElement("li");
    empty.textContent = "No talent data returned.";
    characterTalentsList.appendChild(empty);
  } else {
    talents.forEach(talent => {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = talent?.name || "Unnamed talent";
      item.appendChild(name);
      if (talent?.rank != null) {
        const rank = document.createElement("span");
        rank.textContent = `Rank ${talent.rank}`;
        item.appendChild(rank);
      }
      characterTalentsList.appendChild(item);
    });
  }

  const equipment = Array.isArray(character?.equipment) ? character.equipment : [];
  characterEquipmentList.innerHTML = "";
  if (!equipment.length) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "No equipment data returned.";
    characterEquipmentList.appendChild(empty);
  } else {
    equipment.forEach(item => {
      const card = document.createElement("article");
      card.className = "character-equipment-card";

      const header = document.createElement("div");
      header.className = "character-equipment-header";

      const slot = document.createElement("span");
      slot.className = "character-equipment-slot";
      slot.textContent = typeof item?.slot === "string" ? item.slot : (item?.slot?.name || "Equipment");
      header.appendChild(slot);

      const name = document.createElement("h4");
      name.textContent = item?.name || "Unnamed item";
      header.appendChild(name);

      const detail = document.createElement("div");
      detail.className = "character-equipment-detail";
      detail.textContent = formatCharacterDetailItem(item);

      const stats = Array.isArray(item?.stats)
        ? item.stats.filter(stat => stat?.type && stat?.value != null)
        : [];
      if (stats.length) {
        const statLine = document.createElement("div");
        statLine.className = "character-equipment-stats";
        statLine.textContent = stats.map(stat => `${stat.type}: ${Number(stat.value).toLocaleString()}`).join(" • ");
        detail.appendChild(statLine);
      }

      const enhancements = formatCharacterDetailEnhancements(item);
      if (enhancements) {
        const enhancement = document.createElement("small");
        enhancement.textContent = enhancements;
        detail.appendChild(document.createTextNode(" • "));
        detail.appendChild(enhancement);
      }

      card.appendChild(header);
      card.appendChild(detail);
      characterEquipmentList.appendChild(card);
    });
  }
}

function clearCharacterDetails() {
  if (!characterDetailsPanel) return;
  characterDetailsPanel.hidden = true;
  characterTalentsList.innerHTML = "";
  characterEquipmentList.innerHTML = "";
}

function formatGearScore(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderTextList(selector, values, emptyMessage) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  const items = Array.isArray(values) ? values : [];
  const entries = items.length ? items : [emptyMessage];
  entries.forEach(value => {
    const item = document.createElement("li");
    item.textContent = String(value ?? "");
    list.appendChild(item);
  });
}

function appendCoachListItem(list, fields) {
  const item = document.createElement("li");
  fields.forEach(field => {
    if (field == null || field.value == null || field.value === "") return;
    const element = document.createElement(field.tag || "span");
    element.textContent = String(field.value);
    item.appendChild(element);
  });
  list.appendChild(item);
}

function renderCoachStructuredList(selector, entries, emptyMessage, getFields) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  if (!Array.isArray(entries) || !entries.length) {
    const empty = document.createElement("li");
    empty.textContent = emptyMessage;
    list.appendChild(empty);
    return;
  }
  entries.forEach(entry => appendCoachListItem(list, getFields(entry)));
}

function renderUpgradeResults(upgrades = []) {
  upgradeResults.replaceChildren();
  if (!upgrades.length) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "No direct gear upgrades are available in the current dataset for the imported character.";
    upgradeResults.appendChild(empty);
    return;
  }
  const sourceLabel = "Goal/spec-weighted";
  upgrades.forEach(upgrade => {
    const card = document.createElement("article");
    card.className = "upgrade-card";
    const top = document.createElement("div");
    top.className = "upgrade-card-top";
    const heading = document.createElement("div");
    const slot = document.createElement("div");
    slot.className = "upgrade-slot";
    slot.textContent = upgrade.slot || "Equipment";
    const title = document.createElement("h3");
    title.textContent = upgrade.recommendedItem?.name || "Recommended upgrade";
    heading.append(slot, title);
    const badge = document.createElement("div");
    badge.className = "upgrade-badge";
    badge.textContent = sourceLabel;
    top.append(heading, badge);
    card.appendChild(top);

    const comparison = document.createElement("div");
    comparison.className = "upgrade-comparison";
    const current = document.createElement("div");
    const currentLabel = document.createElement("span");
    currentLabel.textContent = "Current";
    const currentName = document.createElement("strong");
    currentName.textContent = upgrade.currentItem?.name || "Empty slot";
    const currentScore = document.createElement("small");
    currentScore.textContent = `Score ${formatGearScore(upgrade.currentScore)}`;
    current.append(currentLabel, currentName, currentScore);
    const arrow = document.createElement("div");
    arrow.className = "upgrade-arrow";
    arrow.textContent = "→";
    const recommended = document.createElement("div");
    const recommendedLabel = document.createElement("span");
    recommendedLabel.textContent = "Recommended";
    const recommendedName = document.createElement("strong");
    recommendedName.textContent = upgrade.recommendedItem?.name || "Unknown item";
    const recommendedScore = document.createElement("small");
    recommendedScore.textContent = `Score ${formatGearScore(upgrade.recommendedScore)}`;
    recommended.append(recommendedLabel, recommendedName, recommendedScore);
    comparison.append(current, arrow, recommended);
    card.appendChild(comparison);

    const improvement = document.createElement("div");
    improvement.className = "upgrade-improvement";
    improvement.textContent = `+${formatGearScore(upgrade.improvement)} weighted score`;
    card.appendChild(improvement);
    upgradeResults.appendChild(card);
  });
}
function renderCharacterCoach(report, character) {
  document.querySelector("#characterCoachPanel").hidden = false;
  const encounter = retailDataset?.encounters?.find(item =>
    String(item.id ?? item.name) === String(encounterSelect?.value || "")
  ) || null;
  const coach = WoWCharacterCoach.createCharacterCoach({ character, report, goal: goalSelect.value, encounter, dataset: retailDataset });
  document.querySelector("#coachTitle").textContent = `${coach.identity.name} • ${coach.identity.specialization || "Character"}`;
  document.querySelector("#coachHeadline").textContent = coach.summary.nextAction;
  const coachIdentity = document.querySelector("#coachIdentity");
  coachIdentity.innerHTML = "";
  const coachIdentityName = document.createElement("strong");
  coachIdentityName.textContent = coach.identity.name || "Character";
  const coachIdentityBuild = document.createElement("span");
  coachIdentityBuild.textContent = [coach.identity.className, coach.identity.specialization, coach.identity.role].filter(Boolean).join(" • ");
  const coachIdentityGoal = document.createElement("small");
  coachIdentityGoal.textContent = coach.identity.goal || "";
  coachIdentity.append(coachIdentityName, coachIdentityBuild, coachIdentityGoal);
  document.querySelector("#coachSummary").textContent = coach.summary.headline;
  document.querySelector("#coachContentLabel").textContent = coach.content.label;
  document.querySelector("#coachContentFocus").textContent = coach.content.focus;
  renderTextList("#coachContentPriorities", coach.content.priorities, "No curated priorities are available.");
  document.querySelector("#coachContentDefensive").textContent = coach.content.defensive;
  document.querySelector("#coachContentCooldowns").textContent = coach.content.cooldowns;
  renderTextList("#coachContentMistakes", coach.content.mistakes, "No curated mistakes are available.");
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
  renderCoachStructuredList("#coachEncounterMechanics", coach.encounter.mechanics, "No encounter-specific mechanics are available for the current selection.", item => [
    { tag: "strong", value: item.name },
    { tag: "span", value: item.action },
    { tag: "small", value: item.description }
  ]);
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
  renderCoachStructuredList("#coachSpecialRanked", coach.specialItems.ranked, "No direct trinket or weapon upgrade is ranked.", item => [
    { tag: "strong", value: `${item.slot}: ${item.name}` },
    { tag: "span", value: `+${formatGearScore(item.improvement)} weighted score` }
  ]);
  document.querySelector("#coachSpecialNote").textContent = coach.specialItems.note;
  document.querySelector("#coachSpendNext").textContent = coach.spending.next;
  renderCoachStructuredList("#coachSpendSteps", coach.spending.steps, "No immediate upgrade-spending action is identified.", item => [
    { tag: "strong", value: `${item.slot}: ${item.title}` },
    { tag: "span", value: item.status },
    { tag: "small", value: `${item.resources} • ${item.weeklyFit}` }
  ]);
  document.querySelector("#coachSpendRule").textContent = coach.spending.rule;
  document.querySelector("#coachNextAction").textContent = coach.summary.nextAction;
  document.querySelector("#coachStatsSource").textContent = coach.summary.statSource;
  renderTextList("#coachStrengths", coach.strengths, "No specific strengths can be established from the current data.");
  renderTextList("#coachAttention", coach.attention, "No immediate attention items were identified from the current data.");
  renderCoachStructuredList("#coachPriorities", coach.priorities, "No immediate gear action. Use the gameplay plan below and re-run the optimizer after your next gear change.", item => [
    { tag: "strong", value: `${item.section} — ${item.slot}` },
    { tag: "span", value: item.title },
    { tag: "small", value: item.explanation }
  ]);
  renderCoachStructuredList("#coachGearPlan", coach.gearPlan, "No direct gear replacement is available in the current dataset.", item => [
    { tag: "strong", value: `${item.slot}: ${item.title}` },
    { tag: "span", value: `Current: ${item.current}` },
    { tag: "small", value: item.explanation }
  ]);
  renderCoachStructuredList("#coachUpgradePlan", coach.upgradePlan, "No next-track upgrade is currently identified.", item => [
    { tag: "strong", value: `${item.slot}: ${item.title}` },
    { tag: "span", value: item.status },
    { tag: "small", value: `${item.resources} • ${item.weeklyFit}` }
  ]);
  document.querySelector("#coachLoop").textContent = coach.gameplay.loop;
  document.querySelector("#coachTalentSummary").textContent = coach.gameplay.talentSummary;
  renderTextList("#coachTalentAdjustments", coach.gameplay.talentAdjustments, "No additional talent-specific adjustment is active.");
  document.querySelector("#coachWhy").textContent = coach.gameplay.why;
  document.querySelector("#coachDefensive").textContent = coach.gameplay.defensive;
  renderTextList("#coachGameplay", coach.gameplay.beginnerPriority, "Detailed gameplay priorities are not yet curated for this specialization.");
  document.querySelector("#coachCooldowns").textContent = coach.gameplay.cooldownGuidance;
  renderTextList("#coachMistakes", coach.gameplay.commonMistakes, "No curated mistakes are available yet.");
  renderTextList("#coachPreCombat", coach.gameplay.preCombat, "No curated pre-combat checklist is available yet.");
}

function renderOptimizedLoadout(equipment = {}, score = 0) {
  const entries = Object.entries(equipment).filter(([, item]) => item);
  loadoutResults.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "No optimized loadout is available from the current dataset.";
    loadoutResults.appendChild(empty);
    return;
  }
  const sourceLabel = "Goal/spec-weighted";
  entries.forEach(([slotName, item]) => {
    const row = document.createElement("div");
    row.className = "loadout-row";
    const slot = document.createElement("div");
    slot.className = "loadout-slot";
    slot.textContent = slotName;
    const name = document.createElement("div");
    name.className = "loadout-item";
    name.textContent = item.name || "Unnamed item";
    const itemLevel = document.createElement("div");
    itemLevel.className = "loadout-ilvl";
    itemLevel.textContent = `iLvl ${item.itemLevel ?? item.level ?? "—"}`;
    row.append(slot, name, itemLevel);
    loadoutResults.appendChild(row);
  });
  const summary = document.createElement("div");
  summary.className = "loadout-summary";
  const total = document.createElement("strong");
  total.textContent = `Optimized weighted score: ${formatGearScore(score)}`;
  const source = document.createElement("span");
  source.textContent = sourceLabel;
  summary.append(total, source);
  loadoutResults.appendChild(summary);
}
function clearOptimizationResults() {
  upgradeResults.innerHTML = '<div class="result-empty">Run the optimizer after a successful character lookup.</div>';
  loadoutResults.innerHTML = '<div class="result-empty">No optimized loadout has been calculated.</div>';
  optimizationSource.textContent = "Optimization source will appear after the optimizer runs.";
  document.querySelector("#characterCoachPanel").hidden = true;
}

function setSelectValue(select, value) {
  if (!value) return;
  const option = [...select.options].find(item => item.value === value || item.textContent === value);
  if (option) select.value = option.value;
}

function applyLiveCharacter(character) {
  importedCharacter = character;
  clearOptimizationResults();
  const profile = WoWOptimizer.createCharacterProfileFromImport({
    importedCharacter,
    goal: goalSelect.value
  });
  setSelectValue(classSelect, profile.className);
  classSelect.disabled = true;
  specSelect.disabled = false;
  specSelect.innerHTML = "";
  const liveSpecOption = document.createElement("option");
  liveSpecOption.value = String(profile.specialization);
  liveSpecOption.textContent = String(profile.specialization);
  specSelect.appendChild(liveSpecOption);
  specSelect.value = profile.specialization;
  importStatus.classList.remove("error");
  importStatus.textContent = WoWCharacterImport.formatImportedCharacterSummary(character) +
    " • Live Blizzard data retrieved " + new Date(character.fetchedAt || Date.now()).toLocaleTimeString();
  renderCharacterStats(profile.statistics);
  renderCharacterDetails(character);
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
    clearCharacterDetails();
    renderSlots();
    renderCharacterStats({});
    clearOptimizationResults();
    resultMessage.textContent = "Character lookup failed. Previous optimization results were cleared.";
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
  optimizationSource.textContent = `Using native goal/spec weights • ${character.goal}`;

  renderUpgradeResults(report.topUpgrades);
  renderOptimizedLoadout(report.optimizedEquipment, report.totalScore);
  renderCharacterCoach(report, character);


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
  clearOptimizationResults();
  renderUpgradeResults([]);
  renderOptimizedLoadout({});
  clearCharacterDetails();
  resultMessage.textContent = "Look up a character or choose a class and specialization, then run the optimizer.";
  renderSlots();
});

renderSlots();
loadRealmOptions();
loadCurrentRetailData();
