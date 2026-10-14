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

function normalizeEquipmentSlot(slot) {
  const name = String(normalizeName(slot?.name || slot) || "").trim();
  const type = String(slot?.type || "").toUpperCase();
  const aliases = {
    WRIST: "Wrists", WRISTS: "Wrists", HAND: "Hands", HANDS: "Hands",
    FINGER: "Finger", TRINKET: "Trinket", MAIN_HAND: "Main Hand", OFF_HAND: "Off Hand",
    HEAD: "Head", NECK: "Neck", SHOULDER: "Shoulders", SHOULDERS: "Shoulders",
    BACK: "Back", CHEST: "Chest", WAIST: "Waist", LEGS: "Legs", FEET: "Feet"
  };
  return aliases[type] || aliases[name.toUpperCase()] || name;
}

function normalizeEquippedItem(item) {
  const itemRef = item.item || {};
  const quality = item.quality || {};
  const slot = item.slot || {};
  const rawLevel = item.level;
  // Blizzard can return item level as a structured object. Extract a finite
  // numeric value instead of allowing the UI to render it as "[object Object]".
  const itemLevel = typeof rawLevel === "number" && Number.isFinite(rawLevel)
    ? rawLevel
    : rawLevel && typeof rawLevel === "object"
      ? ["value", "effective", "display_string", "base"].map(key => rawLevel[key]).find(value =>
          typeof value === "number" && Number.isFinite(value)
        ) ?? null
      : null;
  return {
    id: resourceId(itemRef),
    name: normalizeName(item.name),
    slot: normalizeEquipmentSlot(slot),
    slotType: slot.type || null,
    itemLevel,
    quality: { id: resourceId(quality), name: normalizeName(quality.name || quality) },
    stats: item.stats || [],
    enchantments: item.enchantments || [],
    sockets: item.sockets || [],
    gems: item.gems || [],
    spells: item.spells || [],
    set: item.set || null,
    context: item.context ?? null,
    modifiers: item.modifiers || [],
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
  const normalized = {};
  const aliases = {
    strength: "Strength", agility: "Agility", intellect: "Intellect", stamina: "Stamina",
    critical_strike: "CriticalStrike", criticalstrike: "CriticalStrike",
    haste: "Haste", mastery: "Mastery", versatility: "Versatility",
    armor: "Armor", dodge: "Dodge", parry: "Parry", block: "Block",
    leech: "Leech", speed: "Speed", avoidance: "Avoidance",
    lifesteal: "Lifesteal", mana: "Mana", health: "Health",
    attack_power: "AttackPower", spell_power: "SpellPower"
  };
  for (const [rawKey, rawValue] of Object.entries(statistics)) {
    if (["_links", "character"].includes(rawKey)) continue;
    const key = aliases[rawKey.toLowerCase()] || rawKey;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      normalized[key] = rawValue;
      continue;
    }
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) continue;
    // Blizzard exposes primary stats as base/effective and rating stats as
    // rating/rating_bonus. Prefer effective or rating; never coerce an object.
    const preferred = ["effective", "rating", "value", "base"];
    const valueKey = preferred.find(candidate =>
      typeof rawValue[candidate] === "number" && Number.isFinite(rawValue[candidate])
    );
    if (valueKey) normalized[key] = rawValue[valueKey];
  }
  return normalized;
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

async function fetchItemMedia({ itemId, clientId, clientSecret }) {
  const id = Number(itemId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const error = new Error("A valid item ID is required.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  const token = await getAccessToken(clientId, clientSecret);
  const url = `${API_BASE}/data/wow/media/item/${id}?namespace=static-us&locale=${LOCALE}`;
  const data = await requestJson(url, token);
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const icon = assets.find(asset => asset.key === "icon" && typeof asset.value === "string")?.value || null;
  return { itemId: id, icon };
}


const SLOT_CANDIDATE_CACHE_MS = 30 * 60 * 1000;
const SLOT_CANDIDATE_LIMIT = 300;
const slotCandidateCache = new Map();

function normalizeBlizzardItemSearchResult(result) {
  const item = result?.data && typeof result.data === "object" ? result.data : result;
  if (!item || !Number.isSafeInteger(Number(item.id))) return null;
  const localized = value => normalizeName(value);
  const inventoryType = item.inventory_type || {};
  const itemClass = item.item_class || {};
  const itemSubclass = item.item_subclass || {};
  const stats = Array.isArray(item.stats) ? item.stats : [];
  const slotAliases = {
    NECK: "Neck", SHOULDER: "Shoulders", SHOULDERS: "Shoulders"
  };
  const inventoryName = localized(inventoryType.name) || "";
  const inventoryTypeCode = String(inventoryType.type || "").toUpperCase();
  const slot = slotAliases[inventoryTypeCode] ||
    (inventoryName.toLowerCase() === "neck" ? "Neck" :
      ["shoulder", "shoulders"].includes(inventoryName.toLowerCase()) ? "Shoulders" : null);
  return {
    id: Number(item.id),
    name: localized(item.name),
    level: Number.isFinite(Number(item.level)) ? Number(item.level) : null,
    itemLevel: Number.isFinite(Number(item.level)) ? Number(item.level) : null,
    slot,
    inventoryType: { id: resourceId(inventoryType), name: inventoryName, type: inventoryTypeCode || null },
    itemClass: { id: resourceId(itemClass), name: localized(itemClass.name) },
    itemSubclass: { id: resourceId(itemSubclass), name: localized(itemSubclass.name) },
    quality: { id: resourceId(item.quality), name: localized(item.quality?.name) },
    isEquippable: item.is_equippable === true,
    stats,
    source: "Live Blizzard Item Search API"
  };
}

async function fetchSlotCandidates({ slots = ["Neck", "Shoulders"], clientId, clientSecret }) {
  const allowedSlots = new Set(["Neck", "Shoulders"]);
  const requested = [...new Set((Array.isArray(slots) ? slots : []).map(String))]
    .filter(slot => allowedSlots.has(slot));
  if (!requested.length) {
    const error = new Error("Request Neck, Shoulders, or both.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }

  const cacheKey = requested.slice().sort().join(",");
  const cached = slotCandidateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true };

  const token = await getAccessToken(clientId, clientSecret);
  const inventoryTypes = { Neck: "NECK", Shoulders: "SHOULDER" };
  const itemsById = new Map();
  const counts = {};

  for (const slot of requested) {
    const params = new URLSearchParams({
      namespace: "static-us",
      locale: LOCALE,
      "inventory_type.type": inventoryTypes[slot],
      orderby: "-level",
      _pageSize: "100"
    });
    let page = 1;
    let pageCount = 1;
    let scanned = 0;
    while (page <= pageCount && scanned < SLOT_CANDIDATE_LIMIT) {
      params.set("_page", String(page));
      const url = `${API_BASE}/data/wow/search/item?${params.toString()}`;
      const response = await requestJson(url, token);
      const results = Array.isArray(response.results) ? response.results : [];
      pageCount = Math.max(1, Number(response.pageCount) || 1);
      for (const result of results) {
        const normalized = normalizeBlizzardItemSearchResult(result);
        if (!normalized || normalized.slot !== slot || !normalized.name) continue;
        itemsById.set(normalized.id, normalized);
      }
      scanned += results.length;
      page += 1;
    }
    counts[slot] = { scanned, returned: [...itemsById.values()].filter(item => item.slot === slot).length };
  }

  const value = {
    items: [...itemsById.values()].sort((a, b) =>
      (b.itemLevel || 0) - (a.itemLevel || 0) || a.id - b.id
    ),
    counts,
    source: "Blizzard Game Data API",
    fetchedAt: new Date().toISOString(),
    cached: false
  };
  slotCandidateCache.set(cacheKey, { value, expiresAt: Date.now() + SLOT_CANDIDATE_CACHE_MS });
  return value;
}

module.exports = { slugify, normalizeEquippedItem, normalizeStatistics, normalizeCharacterTalents, normalizeCharacter, fetchCharacter, fetchRealms, fetchItemMedia, fetchSlotCandidates, normalizeBlizzardItemSearchResult };
