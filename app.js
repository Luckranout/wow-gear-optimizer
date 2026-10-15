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
const secondaryRatingNotice = document.querySelector("#secondaryRatingNotice");
const optimizationSource = document.querySelector("#optimizationSource");
const characterNameInput = document.querySelector("#characterNameInput");
const realmInput = document.querySelector("#realmInput");
const lookupCharacterBtn = document.querySelector("#lookupCharacterBtn");
const API_BASE_URL = String(window.WOW_API_BASE_URL || "").replace(/\/$/, "");
const DEFAULT_CHARACTER_NAME = "Failing";
const DEFAULT_REALM_NAME = "Burning Legion";
let retailDataset = null;
let importedCharacter = null;
let importedSimulation = null;
const simulationJsonInput = document.querySelector("#simulationJsonInput");
const simulationImportStatus = document.querySelector("#simulationImportStatus");

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
    // WoWData loads the optional tier catalogue. Core gear loading remains
    // usable even when that enhancement is unavailable; the report shows coverage.
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

const itemMediaCache = new Map();

function displayItemLevel(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) {
    const match = value.match(/\d+(?:\.\d+)?/);
    return match ? match[0] : null;
  }
  if (value && typeof value === "object") {
    for (const key of ["value", "effective", "display_string", "displayString", "base"]) {
      const candidate = value[key];
      if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
      if (typeof candidate === "string" && candidate.trim()) {
        const match = candidate.match(/\d+(?:\.\d+)?/);
        if (match) return match[0];
      }
    }
  }
  return null;
}

function escapeSlotText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}


function getItemQualityClass(item) {
  const quality = item?.quality;
  const rawName = typeof quality === "string" ? quality : quality?.name;
  const name = String(rawName || "").toLowerCase();
  const id = Number(typeof quality === "object" ? quality?.id : item?.qualityId);
  const qualityById = { 0: "poor", 1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "legendary", 6: "artifact", 7: "heirloom", 8: "wow-token" };
  const qualityName = name || qualityById[id] || "";
  return ["poor", "common", "uncommon", "rare", "epic", "legendary", "artifact", "heirloom", "wow-token"].includes(qualityName)
    ? "item-quality-" + qualityName
    : "item-quality-unknown";
}

function renderItemHoverTooltip(item) {
  if (!item) return "";
  const level = displayItemLevel(item.itemLevel ?? item.level);
  const stats = typeof getLoadoutItemStats === "function" ? getLoadoutItemStats(item) : {};
  const statRows = Object.entries(stats).map(([name, value]) =>
    '<div class="item-hover-stat"><span>' + escapeSlotText(name) + '</span><strong>' + escapeSlotText(value.toLocaleString()) + '</strong></div>'
  ).join("");
  const qualityClass = getItemQualityClass(item);
  return '<div class="item-hover-tooltip" role="tooltip">' +
    '<div class="item-hover-heading">' +
      '<img class="item-hover-image" data-item-tooltip-image-id="' + escapeSlotText(item.id || "") + '" alt="" />' +
      '<div><a class="item-hover-name ' + qualityClass + '" href="https://www.wowhead.com/item=' + encodeURIComponent(String(item.id || "")) + '" target="_blank" rel="noopener noreferrer">' + escapeSlotText(item.name || "Unknown item") + '</a>' +
      '<span>' + (level ? 'Item level ' + escapeSlotText(level) : 'Item level unavailable') + '</span></div>' +
    '</div>' +
    '<div class="item-hover-stats">' + (statRows || '<span class="item-hover-no-stats">Verified stats unavailable</span>') + '</div>' +
  '</div>';
}

async function loadEquippedItemIcon(itemId) {
  if (!itemId) return null;
  if (!itemMediaCache.has(itemId)) {
    const request = fetch(`${API_BASE_URL}/api/item-media?id=${encodeURIComponent(itemId)}`)
      .then(async response => {
        if (!response.ok) return null;
        const data = await response.json();
        return typeof data.icon === "string" && /^https:\/\//i.test(data.icon) ? data.icon : null;
      })
      .catch(() => null);
    itemMediaCache.set(itemId, request);
  }
  return itemMediaCache.get(itemId);
}

function renderItemSockets(item) {
  const normalized = window.WoWEquipmentSockets?.normalizeEquipmentSockets(item) || { status: "unavailable", sockets: [] };
  // If Blizzard returned no socket/gem entries, don't show a warning on every
  // ordinary item card. Only render socket UI when there is actual socket data.
  if (normalized.status !== "available" || !normalized.sockets.length) return "";
  return `<div class="slot-sockets"><span class="slot-sockets-heading">Gem sockets</span>${normalized.sockets.map(socket => {
    const detail = socket.state === "empty"
      ? "No socket equipped"
      : socket.gemName
        ? socket.gemName
        : socket.gemId
          ? `Gem equipped (ID ${socket.gemId}; name unavailable)`
          : "Gem equipped (name unavailable)";
    return `<div class="slot-socket"><span class="slot-socket-label">${escapeSlotText(socket.label)}</span><span class="slot-socket-value">${escapeSlotText(detail)}</span></div>`;
  }).join("")}</div>`;
}

function renderGemSummary(equipment = []) {
  const summary = window.WoWEquipmentSockets?.summarizeEquipmentGems(equipment) || {
    installed: 0, empty: 0, socketsKnown: 0, stats: {}, statsKnownGems: 0
  };
  const target = document.querySelector("#gemSummary");
  if (!target) return;
  const counts = summary.socketsKnown
    ? `<div class="gem-summary-counts"><span><strong>${summary.installed}</strong> gems equipped</span><span><strong>${summary.empty}</strong> empty sockets</span><span><strong>${summary.socketsKnown}</strong> known sockets</span></div>`
    : '<p class="gem-summary-note">Socket data is not available for the imported equipment.</p>';
  const statEntries = Object.entries(summary.stats).sort(([a], [b]) => a.localeCompare(b));
  const stats = statEntries.length
    ? `<div class="gem-summary-stats"><strong>Gem stats explicitly supplied in the imported data</strong>${statEntries.map(([name, value]) => `<span>${escapeSlotText(name)}: +${escapeSlotText(value)}</span>`).join("")}</div>`
    : '<p class="gem-summary-note">Individual gem stat bonuses are not included in the available socket data. No values are estimated.</p>';
  const coverage = summary.installed
    ? `<p class="gem-summary-note">Stat details available for ${summary.statsKnownGems} of ${summary.installed} equipped gems. This summary is informational and is not added to character stats or optimizer scoring.</p>`
    : "";
  target.innerHTML = counts + stats + coverage;
}

function renderSlots() {
  const normalized = importedCharacter?.equipment
    ? WoWOptimizer.normalizeImportedEquipment(importedCharacter.equipment)
    : {};
  slotGrid.innerHTML = slots.map(slot => {
    const item = normalized[slot];
    if (!item) {
      return `<div class="slot">
        <div class="slot-name">${escapeSlotText(slot)}</div>
        <div class="slot-empty">No equipped item returned by Blizzard</div>
      </div>`;
    }
    return `<div class="slot" data-item-id="${escapeSlotText(item.id)}">
      <div class="slot-name">${escapeSlotText(slot)}</div>
      <div class="slot-item">
        <div class="slot-icon-wrap"><div class="slot-icon" tabindex="0" aria-label="Item icon for ${escapeSlotText(item.name || slot)}">…</div>${renderItemHoverTooltip(item)}</div>
        <div class="slot-details">
          <div class="slot-item-name">${escapeSlotText(item.name || "Unknown item")}</div>
          <div class="slot-status">${displayItemLevel(item.itemLevel) != null ? `Item level ${escapeSlotText(displayItemLevel(item.itemLevel))}` : "Item level unavailable"}</div>
          ${renderItemSockets(item)}
        </div>
      </div>
    </div>`;
  }).join("");
  renderGemSummary(importedCharacter?.equipment || []);

  const renderToken = importedCharacter;
  [...slotGrid.querySelectorAll(".slot[data-item-id]")].forEach(async card => {
    const itemId = Number(card.dataset.itemId);
    const iconUrl = await loadEquippedItemIcon(itemId);
    if (importedCharacter !== renderToken || !card.isConnected) return;
    const icon = card.querySelector(".slot-icon");
    if (!icon) return;
    if (iconUrl) {
      icon.innerHTML = `<img src="${escapeSlotText(iconUrl)}" alt="" loading="lazy" />`;
      const tooltipImage = card.querySelector(".item-hover-image");
      if (tooltipImage) tooltipImage.src = iconUrl;
      icon.setAttribute("aria-label", "Equipped item icon; hover or focus to view stats");
    } else {
      icon.textContent = "Item";
      icon.setAttribute("aria-label", "Item icon unavailable");
      icon.classList.add("slot-icon-fallback");
    }
  });
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

function getLoadoutItemStats(item) {
  const stats = {};
  const normalizeStatKey = rawName => {
    const words = String(rawName)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\\s+/)
      .filter(Boolean);
    const compact = words.join("");
    // Canonicalize common Blizzard/catalog aliases before comparing.
    const aliases = {
      crit: "criticalstrike",
      critical: "criticalstrike",
      criticalstrike: "criticalstrike",
      haste: "haste",
      mastery: "mastery",
      versatility: "versatility",
      vers: "versatility",
      agi: "agility",
      int: "intellect",
      str: "strength",
      stam: "stamina"
    };
    const canonical = aliases[compact] || compact;
    return canonical.replace(/^[a-z]/, letter => letter.toUpperCase());
  };
  const addStat = (rawName, rawValue) => {
    const value = Number(rawValue);
    if (!rawName || !Number.isFinite(value)) return;
    const key = normalizeStatKey(rawName);
    stats[key] = (stats[key] || 0) + value;
  };

  // Blizzard character equipment can supply stats as an object map, while
  // catalog records often use an array of typed stat entries. Support both so
  // comparisons don't incorrectly label every stat "Comparison incomplete".
  if (Array.isArray(item?.stats)) {
    for (const stat of item.stats) {
      const rawName = stat?.type?.name || stat?.name || stat?.type || stat?.stat;
      addStat(rawName, stat?.value ?? stat?.amount);
    }
  } else if (item?.stats && typeof item.stats === "object") {
    for (const [rawName, rawValue] of Object.entries(item.stats)) addStat(rawName, rawValue);
  }
  return stats;
}

function renderLoadoutStatRows(target, current) {
  const targetStats = getLoadoutItemStats(target);
  const currentStats = getLoadoutItemStats(current);
  const keys = [...new Set([...Object.keys(targetStats), ...Object.keys(currentStats)])].sort();
  // Missing data is an explicit unknown, never a zero-stat item. Do not turn
  // an incomplete catalog/import record into a numeric comparison.
  if (!keys.length || !Object.keys(targetStats).length || !Object.keys(currentStats).length) {
    return '<p class="compare-no-stats">Comparison incomplete — verified stats are unavailable for one or both items. Do not treat this candidate as a confirmed upgrade.</p>';
  }
  return keys.map(key => {
    const targetValue = Object.hasOwn(targetStats, key) ? targetStats[key] : 0;
    const currentValue = Object.hasOwn(currentStats, key) ? currentStats[key] : 0;
    const delta = targetValue - currentValue;
    const formatted = delta > 0 ? '+' + delta.toLocaleString() : delta.toLocaleString();
    const status = delta > 0 ? 'gain' : delta < 0 ? 'loss' : 'same';
    return '<div class="compare-stat"><span>' + escapeSlotText(key) + '</span><strong class="' + status + '">' + formatted + '</strong></div>';
  }).join("");
}

function getLoadoutUpgradeReason(target, current, sameItem = false) {
  if (!target) return "No eligible catalog item with usable stat data was found for this slot.";
  if (sameItem) return "You already have this item equipped, so this slot does not need an upgrade.";
  if (!current) return "No current item was imported for this slot. This is the optimizer's top eligible catalog candidate, but a direct upgrade comparison is not available.";
  const targetLevel = Number(displayItemLevel(target.itemLevel ?? target.level));
  const currentLevel = Number(displayItemLevel(current.itemLevel ?? current.level));
  const levelKnown = Number.isFinite(targetLevel) && Number.isFinite(currentLevel);
  const levelDelta = levelKnown ? targetLevel - currentLevel : null;
  const targetStats = getLoadoutItemStats(target);
  const currentStats = getLoadoutItemStats(current);
  const commonStats = Object.keys(targetStats).filter(key => Object.hasOwn(currentStats, key));
  const gains = commonStats.map(key => ({ key, delta: targetStats[key] - currentStats[key] })).filter(entry => entry.delta > 0).sort((a,b) => b.delta-a.delta);
  const losses = commonStats.map(key => ({ key, delta: targetStats[key] - currentStats[key] })).filter(entry => entry.delta < 0).sort((a,b) => a.delta-b.delta);
  const parts = [];
  if (levelKnown && levelDelta > 0) parts.push("higher item level (+" + levelDelta + ")");
  else if (levelKnown && levelDelta < 0) parts.push("lower item level (" + levelDelta + ")");
  if (gains.length) parts.push("higher " + gains.slice(0, 2).map(entry => entry.key + " (+" + entry.delta.toLocaleString() + ")").join(" and "));
  if (losses.length) parts.push("lower " + losses.slice(0, 2).map(entry => entry.key + " (" + entry.delta.toLocaleString() + ")").join(" and "));
  if (!parts.length) return "It ranked as the top eligible catalog candidate for this slot under the selected goal's available weights, but the item-level/stat comparison is incomplete. Verify the details before replacing your current item.";
  return "Why it is recommended: " + parts.join("; ") + ". The optimizer ranks available items using the selected goal's weights, not a full combat simulation.";
}

function renderLoadoutItemCard(item, label, emptyText) {
  if (!item) return '<section class="compare-item compare-empty"><h4>' + escapeSlotText(label) + '</h4><p>' + escapeSlotText(emptyText) + '</p></section>';
  const itemLevel = displayItemLevel(item.itemLevel ?? item.level);
  const stats = getLoadoutItemStats(item);
  return '<section class="compare-item">' +
    '<h4>' + escapeSlotText(label) + '</h4>' +
    '<div class="compare-item-heading">' +
      '<span class="compare-icon-wrap"><span class="compare-icon" tabindex="0" data-item-icon-id="' + escapeSlotText(item.id || "") + '" aria-label="Item icon; hover or focus to view stats">Item</span>' + renderItemHoverTooltip(item) + '</span>' +
      '<div class="compare-item-meta"><strong>' + escapeSlotText(item.name || "Unnamed item") + '</strong>' +
      '<span>' + (itemLevel ? 'Item level ' + escapeSlotText(itemLevel) : 'Item level unavailable') + '</span></div>' +
    '</div>' +
    '<div class="compare-stats">' + (Object.keys(stats).length
      ? Object.entries(stats).map(([key, value]) => '<div class="compare-stat"><span>' + escapeSlotText(key) + '</span><strong>' + escapeSlotText(value.toLocaleString()) + '</strong></div>').join("")
      : '<p class="compare-no-stats">Verified item stats unavailable.</p>') + '</div>' +
    '</section>';
}

function renderOptimizedLoadout(equipment = {}, score = 0, currentEquipment = {}) {
  const entries = slots.map(slot => [slot, equipment[slot] || null, currentEquipment[slot] || null]);
  loadoutResults.innerHTML = entries.map(([slot, item, current]) => {
    const sameIdentity = item && current && (
      (item.id != null && current.id != null && String(item.id) === String(current.id)) ||
      (item.name && current.name && item.name.trim().toLowerCase() === current.name.trim().toLowerCase())
    );
    const itemLevel = Number(displayItemLevel(item?.itemLevel ?? item?.level));
    const currentLevel = Number(displayItemLevel(current?.itemLevel ?? current?.level));
    const sameLevel = Number.isFinite(itemLevel) && Number.isFinite(currentLevel)
      ? itemLevel === currentLevel
      : itemLevel === currentLevel;
    const targetStats = getLoadoutItemStats(item);
    const equippedStats = getLoadoutItemStats(current);
    const statKeys = [...new Set([...Object.keys(targetStats), ...Object.keys(equippedStats)])];
    const sameStats = statKeys.every(key =>
      Object.hasOwn(targetStats, key) &&
      Object.hasOwn(equippedStats, key) &&
      targetStats[key] === equippedStats[key]
    );
    // Item IDs/names can be shared by different upgrade variants. Only hide
    // the target when the equipped and optimized records are the same variant.
    const sameItem = Boolean(sameIdentity && sameLevel && sameStats);
    const hasTargetStats = Object.keys(targetStats).length > 0;
    const hasEquippedStats = Object.keys(equippedStats).length > 0;
    const incompleteComparison = Boolean(item && current && (!hasTargetStats || !hasEquippedStats));
    const lowerLevelUnverified = Boolean(item && current && Number.isFinite(itemLevel) && Number.isFinite(currentLevel) && itemLevel < currentLevel && incompleteComparison);
    const suppressAsVerifiedUpgrade = incompleteComparison || lowerLevelUnverified;
    const targetLabel = sameItem ? "No better item identified" : suppressAsVerifiedUpgrade ? "Unverified candidate — not a confirmed upgrade" : "Recommended target";
    const targetEmptyText = sameItem ? "No distinct upgrade found in the current catalog" : suppressAsVerifiedUpgrade ? "Required item stats are missing. Keep the equipped item until this comparison can be verified." : "No verified candidate available";
    return '<article class="loadout-compare-row" data-equipment-slot="' + escapeSlotText(slot) + '">' +
      '<h3 class="loadout-compare-slot">' + escapeSlotText(slot) + '</h3>' +
      '<div class="loadout-compare-pair">' +
        renderLoadoutItemCard(sameItem || suppressAsVerifiedUpgrade ? null : item, targetLabel, targetEmptyText) +
        renderLoadoutItemCard(current, "Currently equipped", "No item equipped / imported") +
      '</div>' +
      '<section class="loadout-stat-delta"><h4>Stat changes if equipped</h4>' +
        (sameItem ? '<p class="compare-no-stats">No change — no distinct upgrade was identified in the current item catalog.</p>' : renderLoadoutStatRows(item, current)) +
        '<div class="loadout-upgrade-reason"><strong>Why this recommendation?</strong><p>' + escapeSlotText(sameItem ? "The optimizer selected your current item because it did not identify a distinct better candidate in the available catalog. This is not a new-item recommendation." : suppressAsVerifiedUpgrade ? "This comparison is incomplete because verified stats are missing for one or both items. The candidate is not shown as a confirmed upgrade; retain the equipped item until catalog data is repaired." : getLoadoutUpgradeReason(item, current, sameItem)) + '</p></div>' +
      '</section>' +
    '</article>';
  }).join("") + '<div class="loadout-summary"><strong>Recommended target score: ' + escapeSlotText(formatGearScore(score)) + '</strong><span>Goal/spec-weighted catalog scoring. Item stats are shown only when present in the catalog or character import; unavailable data is not inferred.</span></div>';

  const renderToken = importedCharacter;
  [...loadoutResults.querySelectorAll("[data-item-icon-id]")].forEach(async node => {
    const itemId = Number(node.dataset.itemIconId);
    const iconUrl = await loadEquippedItemIcon(itemId);
    if (importedCharacter !== renderToken || !node.isConnected) return;
    if (iconUrl) {
      node.innerHTML = '<img src="' + escapeSlotText(iconUrl) + '" alt="" loading="lazy">';
      const tooltip = node.parentElement?.querySelector(".item-hover-image");
      if (tooltip) tooltip.src = iconUrl;
      node.setAttribute("aria-label", "Item icon; hover or focus to view stats");
    } else {
      node.classList.add("compare-icon-fallback");
      node.setAttribute("aria-label", "Item icon unavailable");
    }
  });
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

document.querySelector("#applySimulationBtn")?.addEventListener("click", () => {
  if (!simulationJsonInput || !window.WoWSimulationImport) {
    if (simulationImportStatus) simulationImportStatus.textContent = "Simulation import is unavailable in this page build.";
    return;
  }
  try {
    const parsed = window.WoWSimulationImport.parseSimulationResultJson(simulationJsonInput.value);
    const selectedSpec = importedCharacter?.activeSpec?.name || specSelect.value || "";
    if (parsed.specialization && selectedSpec &&
        String(parsed.specialization).trim().toLowerCase() !== String(selectedSpec).trim().toLowerCase()) {
      throw new Error("The simulation specialization (" + parsed.specialization + ") does not match the selected character specialization (" + selectedSpec + ").");
    }
    importedSimulation = parsed;
    if (simulationImportStatus) {
      simulationImportStatus.classList.remove("error");
      simulationImportStatus.textContent = "Applied " + parsed.source + " scale factors" +
        (parsed.specialization ? " for " + parsed.specialization : "") +
        " (" + Object.keys(parsed.scaleFactors).length + " stats).";
    }
  } catch (error) {
    importedSimulation = null;
    if (simulationImportStatus) {
      simulationImportStatus.classList.add("error");
      simulationImportStatus.textContent = "Simulation weights not applied: " + error.message;
    }
  }
});

document.querySelector("#clearSimulationBtn")?.addEventListener("click", () => {
  importedSimulation = null;
  if (simulationJsonInput) simulationJsonInput.value = "";
  if (simulationImportStatus) {
    simulationImportStatus.classList.remove("error");
    simulationImportStatus.textContent = "No simulation weights applied.";
  }
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

document.querySelector("#optimizeBtn").addEventListener("click", async () => {
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

  const prioritySelect = secondaryRatingNotice?.querySelector("#secondaryRatingPriority");
  if (prioritySelect?.value) character.preferredSecondaryStat = prioritySelect.value;

  // Always merge verified per-slot catalog candidates with the retail dataset.
  // A local item for a slot does not prove that slot's catalog is complete; skipping
  // the API in that case caused equipped items to be compared against a tiny pool.
  const availableItems = [...(retailDataset.items || [])];
  const candidateSlots = WoWOptimizer.slots;
  resultMessage.textContent = "Fetching verified Season 2+ candidates for all equipment slots...";
  const requests = await Promise.all(candidateSlots.map(async slot => {
    try {
      const url = `${API_BASE_URL}/api/slot-candidates?slot=${encodeURIComponent(slot)}&class=${encodeURIComponent(character.className)}&specialization=${encodeURIComponent(character.specialization || "")}`;
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok) {
        console.warn(`No on-demand candidates for ${slot}:`, payload.error || response.status);
        return { slot, items: [], failed: true, reason: payload.error || `HTTP ${response.status}` };
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      return { slot, items, failed: false, empty: items.length === 0 };
    } catch (error) {
      console.warn(`Candidate request failed for ${slot}:`, error);
      return { slot, items: [], failed: true, reason: error?.message || "Network or response error" };
    }
  }));
  const failedCandidateSlots = requests.filter(request => request.failed).map(request => request.slot);
  const emptyCandidateSlots = requests.filter(request => !request.failed && request.empty).map(request => request.slot);
  const candidateCoverageNote = [
    failedCandidateSlots.length
      ? ` Candidate coverage warning: could not load verified candidates for ${failedCandidateSlots.length} slot(s): ${failedCandidateSlots.join(", ")}. Results may be incomplete; “no upgrade” is not confirmed for those slots.`
      : "",
    emptyCandidateSlots.length
      ? ` No validated compatible catalog candidates were returned for: ${emptyCandidateSlots.join(", ")}. This does not prove that no upgrade exists in game.`
      : ""
  ].filter(Boolean).join("");
  const byId = new Map();
  for (const item of availableItems.concat(...requests.map(request => request.items))) {
    const key = item?.id != null ? String(item.id) : item?.name;
    if (key != null && !byId.has(key)) byId.set(key, item);
  }
  availableItems.splice(0, availableItems.length, ...byId.values());
  const report = WoWOptimizer.createOptimizationReport({
    character,
    availableItems,
    dataset: retailDataset
  });

  const ratingStatus = report.ratingConstraintStatus;
  if (secondaryRatingNotice) {
    secondaryRatingNotice.hidden = false;
    if (ratingStatus?.requiresUserChoice) {
      secondaryRatingNotice.innerHTML =
        '<strong>Secondary-stat hard-cap warning:</strong> Haste, Crit, Mastery, and Versatility are all above their hard ceilings. Choose which stat you want the optimizer to prioritize while it brings the other stats under their hard ceilings, then run optimization again. ' +
        '<label for="secondaryRatingPriority">Priority stat</label> ' +
        '<select id="secondaryRatingPriority"><option value="">Choose a stat…</option>' +
        '<option value="Haste">Haste</option><option value="CriticalStrike">Critical Strike</option>' +
        '<option value="Mastery">Mastery</option><option value="Versatility">Versatility</option></select> ' +
        '<button type="button" id="applySecondaryRatingPriority">Optimize with priority</button>';
      secondaryRatingNotice.querySelector("#applySecondaryRatingPriority")?.addEventListener("click", () => {
        const select = secondaryRatingNotice.querySelector("#secondaryRatingPriority");
        if (!select?.value) {
          select?.focus();
          resultMessage.textContent = "Choose a secondary stat to prioritize before optimizing.";
          return;
        }
        document.querySelector("#optimizeBtn").click();
      });
    } else if (ratingStatus?.originalViolations?.length) {
      const original = ratingStatus.originalViolations.map(v => v.stat + " (" + v.rating.toLocaleString() + " / " + v.maximum.toLocaleString() + ")").join(", ");
      if (ratingStatus.balanced) {
        secondaryRatingNotice.innerHTML = '<strong>Secondary-stat balance:</strong> The optimizer adjusted the loadout to bring all secondary stats under their hard ceilings. Previous violations: ' + original + '.';
      } else {
        const remaining = (ratingStatus.remainingViolations || []).map(v => v.stat + " (" + v.rating.toLocaleString() + " / " + v.maximum.toLocaleString() + ")").join(", ");
        secondaryRatingNotice.innerHTML = '<strong>Hard-cap warning:</strong> The optimizer reduced the violations but could not bring every stat under its hard ceiling with the available catalog. Still over cap: ' + remaining + '. Add or select more gear options to find a compliant loadout.';
      }
    } else {
      secondaryRatingNotice.hidden = true;
      secondaryRatingNotice.textContent = "";
    }
  }

  renderCharacterStats(report.currentStats.trackedStats);
  optimizationSource.textContent = report.recommendationStatus === "simulation-weighted-ranking-not-full-stat-projection"
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

  const tierCoverage = report.tierSetCoverage;
  const tierCoverageNote = !tierCoverage || tierCoverage.catalogueStatus === "unavailable"
    ? " Tier-set coverage unavailable; set bonuses are not verified."
    : tierCoverage.itemMappingVerified
      ? ` Tier set: ${tierCoverage.setName} piece mapping verified (${tierCoverage.verifiedPieceCount}/${tierCoverage.expectedPieceCount}); numeric bonus scoring remains disabled.`
      : ` Tier-set warning: ${tierCoverage.className || character.className} piece mapping is unverified; do not treat set counts or bonus optimization as complete. ${tierCoverage.verifiedClassCount}/${tierCoverage.totalClassCount} classes have verified mappings.`;
  const coverageNote = candidateCoverageNote + tierCoverageNote;
  resultMessage.textContent = report.topUpgrades.length
    ? `${label} • ${character.goal} — ${report.topUpgrades.length} gear candidates ranked. This is a ranking aid, not a verified best-in-slot result or numeric projected-stat calculation.${coverageNote}`
    : `${label} • ${character.goal} — no direct gear candidates ranked from the currently available dataset. This does not prove that no upgrades exist in game.${coverageNote}`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  importedCharacter = null;
  importedSimulation = null;
  if (simulationJsonInput) simulationJsonInput.value = "";
  if (simulationImportStatus) {
    simulationImportStatus.classList.remove("error");
    simulationImportStatus.textContent = "No simulation weights applied.";
  }
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
