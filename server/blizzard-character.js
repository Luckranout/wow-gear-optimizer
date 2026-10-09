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
    stats: Array.isArray(item.stats) ? item.stats.map(stat => ({
      type: normalizeName(stat.type || stat.stat),
      value: stat.value ?? null
    })).filter(stat => stat.type || stat.value != null) : [],
    enchantments: Array.isArray(item.enchantments) ? item.enchantments.map(enchantment => ({
      id: resourceId(enchantment),
      name: normalizeName(enchantment.name || enchantment.enchantment?.name),
      displayString: normalizeName(enchantment.display_string || enchantment.displayString)
    })).filter(enchantment => enchantment.id != null || enchantment.name || enchantment.displayString) : [],
    sockets: Array.isArray(item.sockets) ? item.sockets : [],
    gems: Array.isArray(item.gems) ? item.gems.map(gem => ({
      id: resourceId(gem.item || gem),
      name: normalizeName(gem.name || gem.item?.name),
      raw: gem
    })).filter(gem => gem.id != null || gem.name) : [],
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
  const activeLoadout = Array.isArray(active.loadouts)
    ? (active.loadouts.find(loadout => loadout.is_active) || active.loadouts[0] || {})
    : {};
  const loadoutGroups = [
    ["Class", activeLoadout.selected_class_talents],
    ["Spec", activeLoadout.selected_spec_talents],
    ["Hero", activeLoadout.selected_hero_talents]
  ];
  const selected = loadoutGroups.flatMap(([source, talents]) =>
    (Array.isArray(talents) ? talents : []).map(talent => ({
      source,
      id: resourceId(talent.id || talent.tooltip?.talent),
      name: normalizeName(talent.name || talent.tooltip?.talent?.name),
      rank: Number(talent.rank ?? talent.points ?? 0),
      raw: talent
    }))
  );
  const legacy = Array.isArray(active.talents)
    ? active.talents.map(talent => ({
        source: "Legacy",
        id: resourceId(talent.id || talent.talent),
        name: normalizeName(talent.name || talent.talent?.name),
        rank: Number(talent.rank ?? talent.points ?? 0),
        raw: talent
      }))
    : [];
  const normalizedSelected = selected.filter(talent => talent.id != null || talent.name);
  if (normalizedSelected.length) return normalizedSelected;
  return legacy.filter(talent => talent.id != null || talent.name);
}

function normalizeStatistics(statistics) {
  if (!statistics || typeof statistics !== "object") return {};
  return Object.fromEntries(Object.entries(statistics).filter(([key]) => !["_links", "character"].includes(key)));
}

function normalizeCharacter(profile, equipment, statistics, specializations) {
  const activeSpec = profile.active_spec || {};
  const characterClass = profile.character_class || {};
  const race = profile.race || {};
  const realm = profile.realm || {};
  const faction = profile.faction || {};
  const guild = profile.guild || {};
  const items = (equipment.equipped_items || []).map(normalizeEquippedItem).filter(item => item.id != null);
  return {
    id: profile.id ?? null,
    name: profile.name,
    realm: { id: resourceId(realm), name: normalizeName(realm.name), slug: realm.slug || "" },
    level: profile.level ?? null,
    class: { id: resourceId(characterClass), name: normalizeName(characterClass.name) },
    race: { id: resourceId(race), name: normalizeName(race.name) },
    activeSpec: { id: resourceId(activeSpec), name: normalizeName(activeSpec.name) },
    faction: normalizeName(faction.name || faction),
    guild: normalizeName(guild.name || guild),
    achievementPoints: profile.achievement_points ?? null,
    averageItemLevel: profile.average_item_level ?? null,
    equippedItemLevel: profile.equipped_item_level ?? null,
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
