const assert = require("node:assert/strict");
const catalog = require("../server/blizzard-item-catalog");

async function main() {
  const original = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BLIZZARD_CLIENT_ID: process.env.BLIZZARD_CLIENT_ID,
    BLIZZARD_CLIENT_SECRET: process.env.BLIZZARD_CLIENT_SECRET
  };
  process.env.SUPABASE_URL = "https://db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.BLIZZARD_CLIENT_ID = "test-client";
  process.env.BLIZZARD_CLIENT_SECRET = "test-secret";
  catalog._test.resetTokenCache();
  catalog._test.resetItemCache();

  let persisted = null;
  let blizzardCalls = 0;
  let tokenCalls = 0;
  const fetchMock = async (url, options = {}) => {
    if (url.startsWith("https://db.example.test/rest/v1/wow_items?")) {
      if (options.method === "POST") {
        const row = JSON.parse(options.body);
        persisted = row;
        return new Response("", { status: 201 });
      }
      return new Response(JSON.stringify(persisted ? [persisted] : []), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }
    if (url === "https://oauth.battle.net/token") {
      tokenCalls++;
      return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }
    if (url.includes("/data/wow/item/")) {
      blizzardCalls++;
      return new Response(JSON.stringify({
        id: 12345,
        name: { en_US: "Test Sword" },
        level: { value: 344 },
        is_equippable: true,
        quality: { id: 4, name: { en_US: "Epic" } },
        item_class: { id: 2, name: { en_US: "Weapon" } },
        item_subclass: { id: 7, name: { en_US: "Sword" } },
        inventory_type: { type: "WEAPON", name: { en_US: "One-Hand" } }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error("Unexpected request: " + url);
  };

  try {
    const first = await catalog.getItem(12345, { fetch: fetchMock, env: process.env });
    assert.equal(first.item.name, "Test Sword");
    assert.equal(first.item.itemLevel, 344);
    assert.equal(first.item.isEquippable, true);
    assert.equal(first.item.seasonEligibility, "unverified", "item detail must not imply season verification");
    assert.equal(first.persistentStorage, true);
    assert.equal(first.cache, "miss");
    assert.equal(blizzardCalls, 1);
    assert.ok(persisted && persisted.record.id === 12345, "item record is written to durable storage");
    assert.ok(Date.parse(persisted.expires_at) > Date.now(), "stored record has a future expiry");

    catalog._test.resetItemCache(); // Force the next request through durable storage, not process memory.
    const second = await catalog.getItem(12345, { fetch: fetchMock, env: process.env });
    assert.equal(second.cache, "hit");
    assert.equal(second.item.name, "Test Sword");
    assert.equal(blizzardCalls, 1, "a persisted cache hit must not call Blizzard again");
    assert.equal(tokenCalls, 1, "OAuth token is reused during the test");

    const normalized = catalog.normalizeBlizzardItem({
      id: 8, name: { en_US: "No source proof" }, is_equippable: true
    }, 8);
    assert.equal(normalized.seasonEligibility, "unverified");
    assert.equal(normalized.seasonScope, "unknown");

    const outageFetch = async (url, options = {}) => {
      if (url.startsWith("https://db.example.test/rest/v1/wow_items?")) {
        return new Response("database unavailable", { status: 503 });
      }
      if (url === "https://oauth.battle.net/token") {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/data/wow/item/")) {
        return new Response(JSON.stringify({
          id: 54321, name: { en_US: "Storage Outage Item" }, is_equippable: true
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error("Unexpected outage request: " + url);
    };
    const duringOutage = await catalog.getItem(54321, { fetch: outageFetch, env: process.env });
    assert.equal(duringOutage.item.name, "Storage Outage Item", "database outage must not block live Blizzard lookup");
    assert.equal(duringOutage.persistentStorage, false, "database outage must not be reported as durable persistence");

    process.env.SUPABASE_URL = "";
    const noStorage = await catalog.readStoredItem(9, fetchMock);
    assert.equal(noStorage.configured, false, "missing Supabase config is reported instead of pretending persistence worked");

    // Before Supabase is configured, repeated optimizer requests should reuse
    // fetched metadata within a warm serverless process rather than hammering Blizzard.
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    catalog._test.resetItemCache();
    let uncachedBlizzardCalls = 0;
    const noStorageFetch = async (url) => {
      if (url === "https://oauth.battle.net/token") {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/data/wow/item/")) {
        uncachedBlizzardCalls++;
        return new Response(JSON.stringify({
          id: 777, name: { en_US: "Process Cached Item" }, is_equippable: true
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error("Unexpected no-storage request: " + url);
    };
    const firstLocal = await catalog.getItem(777, { fetch: noStorageFetch, env: process.env });
    const secondLocal = await catalog.getItem(777, { fetch: noStorageFetch, env: process.env });
    assert.equal(firstLocal.persistentStorage, false, "process memory is not reported as durable storage");
    assert.equal(secondLocal.cache, "memory-hit", "second request reuses process cache");
    assert.equal(uncachedBlizzardCalls, 1, "process cache avoids duplicate Blizzard item fetches");
    // Slot requests use Blizzard search to discover IDs before hydrating details.
    catalog._test.resetTokenCache();
    const searchUrls = [];
    const searchFetch = async (url) => {
      searchUrls.push(String(url));
      if (url === "https://oauth.battle.net/token") return new Response(JSON.stringify({ access_token: "search-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (String(url).includes("/data/wow/search/item?")) return new Response(JSON.stringify({ results: [{ data: { id: 111 } }, { data: { id: 222 } }, { data: { id: 111 } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      throw new Error("Unexpected item-search request: " + url);
    };
    const discoveredIds = await catalog.searchItemIds(["HEAD"], { fetch: searchFetch, env: { BLIZZARD_CLIENT_ID: "id", BLIZZARD_CLIENT_SECRET: "secret" }, limit: 10 });
    assert.deepEqual(discoveredIds, [222, 111], "Blizzard search IDs are deduplicated and returned newest-first");
    assert.ok(searchUrls.some(url => String(url).includes("inventory_type.type=HEAD")), "request includes the requested slot inventory type");

    // Multi-type slots must not let the first inventory query consume the
    // entire result budget before shields/holdables (or other types) are searched.
    const mixedSearchUrls = [];
    const mixedSearchFetch = async (url) => {
      const value = String(url);
      mixedSearchUrls.push(value);
      if (value === "https://oauth.battle.net/token") return new Response(JSON.stringify({ access_token: "mixed-search-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (value.includes("/data/wow/search/item?")) {
        const id = value.includes("inventory_type.type=SHIELD") ? 999 : 111;
        return new Response(JSON.stringify({ results: [{ data: { id } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error("Unexpected mixed item-search request: " + url);
    };
    catalog._test.resetTokenCache();
    const mixedIds = await catalog.searchItemIds(["WEAPON", "SHIELD"], {
      fetch: mixedSearchFetch,
      env: { BLIZZARD_CLIENT_ID: "id", BLIZZARD_CLIENT_SECRET: "secret" },
      limit: 2
    });
    assert.deepEqual(mixedIds, [999, 111], "each requested inventory type contributes IDs within the shared limit");
    assert.ok(mixedSearchUrls.some(url => url.includes("inventory_type.type=SHIELD")), "shield search is not skipped when weapon results exist");

  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    catalog._test.resetTokenCache();
    catalog._test.resetItemCache();
  }
  console.log("On-demand Blizzard item persistence tests passed.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
