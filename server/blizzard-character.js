const API_BASE = "https://us.api.blizzard.com";
const TOKEN_URL = "https://oauth.battle.net/token";
const PROFILE_NAMESPACE = "profile-us";
const DYNAMIC_NAMESPACE = "dynamic-us";
const LOCALE = "en_US";

let cachedToken = null;
let cachedRealms = null;

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeName(value) {
  if (value && typeof value === "object") {
    return value[LOCALE] || value.en_US || Object.values(value)[0] || "";
  }
  return value || "";
}

function resourceId(value) {
  if (value && typeof value === "object") return value.id ?? null;
  return Number.isInteger(value) ? value : null;
}

function normalizeEquippedItem(item) {
  const itemRef = item.item || {};
  const quality = item.quality || {};
  const slot = item.slot || {};
  return {
    id: resourceId(itemRef),
    name: normalizeName(item.name),
    slot: normalizeName(slot.name || slot),
    slotType: slot.type || null,
    itemLevel: item.level ?? null,
    quality: { id: resourceId(quality), name: normalizeName(quality.name || quality) },
    stats: item.stats || [],
    enchantments: item.enchantments || [],
    sockets: item.sockets || [],
    gems: item.gems || [],
    spells: item.spells || [],
    set: item.set || null,
    context: item.context ?? null,
    modifiers: item.modifiers || [],
    bonusList: item.bonus_list || item.bonusList || [],
    upgrade: item.upgrade || null
  };
}

function normalizeCharacterTalents(specializations) {
  if (!specializations || typeof specializations !== "object") return [];
  const entries = Array.isArray(specializations.specializations)
    ? specializations.specializations
    : Array.isArray(specializations)
      ? specializations
      : [];
  const active = entries.find(entry => entry.active) || entries[0] || {};
  const talents = Array.isArray(active.talents) ? active.talents : [];
  return talents.map(talent => ({
    id: resourceId(talent.id || talent.talent),
    name: normalizeName(talent.name || talent.talent?.name),
    rank: Number(talent.rank ?? talent.points ?? 0),
    raw: talent
  })).filter(talent => talent.id != null || talent.name);
}

function normalizeStatistics(statistics) {
  if (!statistics || typeof statistics !== "object") return {};

  // Blizzard's character statistics endpoint returns many stats as nested
  // objects (for example strength.effective and melee_crit.rating), not
  // top-level numbers. Flatten only documented numeric fields and avoid
  // converting arbitrary objects to NaN or silently dropping real stats.
  const readNumber = (value, keys) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object") return null;
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    }
    return null;
  };
  const result = {};
  const direct = {
    Health: ["health", ["effective", "value", "base"]],
    Strength: ["strength", ["effective", "value", "base"]],
    Agility: ["agility", ["effective", "value", "base"]],
    Intellect: ["intellect", ["effective", "value", "base"]],
    Stamina: ["stamina", ["effective", "value", "base"]],
    Armor: ["armor", ["effective", "value", "base"]],
    Versatility: ["versatility", ["rating", "effective", "value", "base"]],
    Mastery: ["mastery", ["rating", "effective", "value", "base"]],
    Leech: ["lifesteal", ["rating", "effective", "value", "base"]],
    Speed: ["speed", ["rating", "effective", "value", "base"]],
    Avoidance: ["avoidance", ["rating", "effective", "value", "base"]],
    Dodge: ["dodge", ["rating", "effective", "value", "base"]],
    Parry: ["parry", ["rating", "effective", "value", "base"]],
    Block: ["block", ["rating", "effective", "value", "base"]]
  };
  for (const [label, [sourceKey, fields]] of Object.entries(direct)) {
    const value = readNumber(statistics[sourceKey], fields);
    if (value !== null) result[label] = value;
  }

  const crit = readNumber(statistics.melee_crit ?? statistics.crit, ["rating", "effective", "value", "base"]);
  const haste = readNumber(statistics.melee_haste ?? statistics.haste, ["rating", "effective", "haste_rating", "value", "base"]);
  if (crit !== null) result.CriticalStrike = crit;
  if (haste !== null) result.Haste = haste;

  // Keep already-normalized numeric fields compatible with imported test data.
  const consumedKeys = new Set([
    "_links", "character", "health", "strength", "agility", "intellect", "stamina",
    "armor", "versatility", "mastery", "lifesteal", "speed", "avoidance",
    "dodge", "parry", "block", "melee_crit", "crit", "melee_haste", "haste"
  ]);
  for (const [key, value] of Object.entries(statistics)) {
    if (consumedKeys.has(key) || result[key] !== undefined) continue;
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function normalizeCharacter(profile, equipment, statistics, specializations) {
  const activeSpec = profile.active_spec || {};
  const characterClass = profile.character_class || {};
  const race = profile.race || {};
  const realm = profile.realm || {};
  const items = (equipment.equipped_items || []).map(normalizeEquippedItem).filter(item => item.id != null);
  return {
    id: profile.id ?? null,
    name: profile.name,
    realm: { id: resourceId(realm), name: normalizeName(realm.name), slug: realm.slug || "" },
    level: profile.level ?? null,
    class: { id: resourceId(characterClass), name: normalizeName(characterClass.name) },
    race: { id: resourceId(race), name: normalizeName(race.name) },
    activeSpec: { id: resourceId(activeSpec), name: normalizeName(activeSpec.name) },
    statistics: normalizeStatistics(statistics),
    talents: normalizeCharacterTalents(specializations),
    equipment: items,
    equipmentCount: items.length,
    fetchedAt: new Date().toISOString(),
    source: "Blizzard WoW Profile API"
  };
}

async function getAccessToken(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    const error = new Error("Blizzard API credentials are not configured.");
    error.statusCode = 500;
    error.publicMessage = "Character lookup is not configured yet.";
    throw error;
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) {
    const error = new Error("Blizzard OAuth failed.");
    error.statusCode = 502;
    error.publicMessage = "Blizzard character service is temporarily unavailable.";
    throw error;
  }
  const data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 86400) * 1000 };
  return cachedToken.value;
}

async function requestJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) {
    const error = new Error(`Blizzard profile request failed with HTTP ${response.status}.`);
    error.statusCode = response.status === 404 ? 404 : 502;
    error.publicMessage = response.status === 404
      ? "Character not found. Check the character name and realm."
      : "Blizzard character service is temporarily unavailable.";
    throw error;
  }
  return response.json();
}

async function fetchRealms({ clientId, clientSecret }) {
  if (cachedRealms && cachedRealms.expiresAt > Date.now()) return cachedRealms.value;
  const token = await getAccessToken(clientId, clientSecret);
  const url = API_BASE + "/data/wow/realm/index?namespace=" + DYNAMIC_NAMESPACE + "&locale=" + LOCALE;
  const data = await requestJson(url, token);
  const realms = (Array.isArray(data.realms) ? data.realms : [])
    .map(realm => ({
      id: resourceId(realm),
      name: normalizeName(realm.name),
      slug: realm.slug || ""
    }))
    .filter(realm => realm.name && realm.slug)
    .sort((a, b) => a.name.localeCompare(b.name));
  cachedRealms = { value: realms, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return realms;
}

async function fetchCharacter({ realm, character, clientId, clientSecret }) {
  const realmSlug = slugify(realm);
  const characterName = encodeURIComponent(String(character).trim().toLowerCase());
  if (!realmSlug || !characterName) {
    const error = new Error("Realm and character name are required.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  const token = await getAccessToken(clientId, clientSecret);
  const base = `${API_BASE}/profile/wow/character/${realmSlug}/${characterName}?namespace=${PROFILE_NAMESPACE}&locale=${LOCALE}`;
  const equipment = `${API_BASE}/profile/wow/character/${realmSlug}/${characterName}/equipment?namespace=${PROFILE_NAMESPACE}&locale=${LOCALE}`;
  const statistics = `${API_BASE}/profile/wow/character/${realmSlug}/${characterName}/statistics?namespace=${PROFILE_NAMESPACE}&locale=${LOCALE}`;
  const specializations = `${API_BASE}/profile/wow/character/${realmSlug}/${characterName}/specializations?namespace=${PROFILE_NAMESPACE}&locale=${LOCALE}`;
  const [profile, equipped, stats, specializationData] = await Promise.all([
    requestJson(base, token),
    requestJson(equipment, token),
    requestJson(statistics, token),
    requestJson(specializations, token)
  ]);
  return normalizeCharacter(profile, equipped, stats, specializationData);
}

module.exports = { slugify, normalizeEquippedItem, normalizeStatistics, normalizeCharacterTalents, normalizeCharacter, fetchCharacter, fetchRealms };
