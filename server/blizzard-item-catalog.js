const API_BASE = "https://us.api.blizzard.com";
const TOKEN_URL = "https://oauth.battle.net/token";
const LOCALE = "en_US";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
let tokenCache = null;
const memoryItemCache = new Map();
const MEMORY_CACHE_MAX_ITEMS = 500;

function storageConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
}

async function supabaseRequest(path, options = {}, fetchImpl = globalThis.fetch) {
  const config = storageConfig();
  if (!config) return { configured: false, data: null };
  const response = await fetchImpl(config.url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const error = new Error("Supabase item storage returned HTTP " + response.status);
    error.statusCode = 502;
    throw error;
  }
  const text = await response.text();
  return { configured: true, data: text ? JSON.parse(text) : null };
}

async function readStoredItem(id, fetchImpl = globalThis.fetch) {
  const result = await supabaseRequest(
    "wow_items?id=eq." + id + "&select=id,record,fetched_at,expires_at",
    { method: "GET" },
    fetchImpl
  );
  if (!result.configured) return { item: null, configured: false };
  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (!row || !row.record) return { item: null, configured: true };
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    return { item: null, configured: true };
  }
  return { item: row.record, configured: true };
}

async function storeItem(item, fetchImpl = globalThis.fetch) {
  const now = new Date();
  const row = {
    id: item.id,
    record: item,
    fetched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_SECONDS * 1000).toISOString()
  };
  const result = await supabaseRequest("wow_items?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row)
  }, fetchImpl);
  return result.configured;
}

async function getBlizzardToken(env = process.env, fetchImpl = globalThis.fetch) {
  const clientId = env.BLIZZARD_CLIENT_ID;
  const clientSecret = env.BLIZZARD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const error = new Error("Blizzard API credentials are not configured.");
    error.statusCode = 500;
    error.publicMessage = "Blizzard item lookup is not configured yet.";
    throw error;
  }
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) {
    const error = new Error("Blizzard OAuth failed.");
    error.statusCode = 502;
    error.publicMessage = "Blizzard item service is temporarily unavailable.";
    throw error;
  }
  const data = await response.json();
  tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 86400) * 1000 };
  return tokenCache.value;
}

function normalizeBlizzardItem(raw, id) {
  const inventoryType = raw.inventory_type || {};
  const itemClass = raw.item_class || {};
  const itemSubclass = raw.item_subclass || {};
  const quality = raw.quality || {};
  const stats = (Array.isArray(raw.preview_item?.stats) ? raw.preview_item.stats : Array.isArray(raw.stats) ? raw.stats : [])
    .map(stat => ({
      name: stat.type?.name?.en_US || stat.type?.name || stat.name || "",
      value: Number(stat.value ?? stat.amount ?? 0)
    }))
    .filter(stat => stat.name && Number.isFinite(stat.value));
  return {
    id,
    name: raw.name?.en_US || raw.name || ("Item " + id),
    itemLevel: Number(raw.level?.value ?? raw.level ?? raw.preview_item?.level?.value ?? 0) || null,
    quality: { id: quality.id ?? null, name: quality.name?.en_US || quality.name || "" },
    itemClass: { id: itemClass.id ?? null, name: itemClass.name?.en_US || itemClass.name || "" },
    itemSubclass: { id: itemSubclass.id ?? null, name: itemSubclass.name?.en_US || itemSubclass.name || "" },
    inventoryType: { type: inventoryType.type || "", name: inventoryType.name?.en_US || inventoryType.name || "" },
    isEquippable: Boolean(raw.is_equippable),
    stats,
    source: "Blizzard static item API",
    fetchedAt: new Date().toISOString(),
    seasonScope: "unknown",
    seasonEligibility: "unverified",
    verificationNote: "Blizzard item details confirm item metadata, not current-season eligibility."
  };
}

async function fetchFromBlizzard(id, env = process.env, fetchImpl = globalThis.fetch) {
  const token = await getBlizzardToken(env, fetchImpl);
  const url = API_BASE + "/data/wow/item/" + id + "?namespace=static-us&locale=" + LOCALE;
  const response = await fetchImpl(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error("Blizzard item request returned HTTP " + response.status);
    error.statusCode = 502;
    error.publicMessage = "Blizzard item service is temporarily unavailable.";
    throw error;
  }
  return normalizeBlizzardItem(await response.json(), id);
}

async function getItem(id, options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const env = options.env || process.env;
  const useMemoryCache = options.memoryCache !== false;
  const now = Date.now();
  if (useMemoryCache) {
    const cached = memoryItemCache.get(Number(id));
    if (cached && cached.expiresAt > now) {
      // Refresh insertion order so the bounded cache behaves like LRU.
      memoryItemCache.delete(Number(id));
      memoryItemCache.set(Number(id), cached);
      return { item: cached.item, cache: "memory-hit", persistentStorage: false };
    }
    if (cached) memoryItemCache.delete(Number(id));
  }
  // Storage is an optimization, not a dependency for live item lookup. A
  // temporary database outage must not prevent the optimizer from querying Blizzard.
  let stored = { item: null, configured: Boolean(storageConfig(env)), storageError: false };
  try {
    stored = await readStoredItem(id, fetchImpl);
  } catch (_) {
    stored = { item: null, configured: Boolean(storageConfig(env)), storageError: true };
  }
  if (stored.item) {
    if (useMemoryCache) rememberItem(stored.item);
    return { item: stored.item, cache: "hit", persistentStorage: true };
  }
  const item = await fetchFromBlizzard(id, env, fetchImpl);
  if (!item) return { item: null, cache: "miss", persistentStorage: stored.configured && !stored.storageError };
  let persisted = false;
  try { persisted = await storeItem(item, fetchImpl); } catch (_) { persisted = false; }
  if (useMemoryCache) rememberItem(item);
  return { item, cache: "miss", persistentStorage: persisted };
}

function rememberItem(item) {
  const id = Number(item?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  memoryItemCache.delete(id);
  memoryItemCache.set(id, { item, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
  while (memoryItemCache.size > MEMORY_CACHE_MAX_ITEMS) {
    memoryItemCache.delete(memoryItemCache.keys().next().value);
  }
}

module.exports = {
  storageConfig, supabaseRequest, readStoredItem, storeItem, getBlizzardToken,
  normalizeBlizzardItem, fetchFromBlizzard, getItem,
  _test: { resetTokenCache() { tokenCache = null; }, resetItemCache() { memoryItemCache.clear(); }, CACHE_TTL_SECONDS, MEMORY_CACHE_MAX_ITEMS }
};
