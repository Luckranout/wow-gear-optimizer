const assert = require("assert");
const characterHandler = require("../api/character");
const realmsHandler = require("../api/realms");
const { setCorsHeaders } = require("../api/cors");

function mockResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function run() {
  const allowedOrigins = [
    "https://luckranout.github.io",
    "https://wow-gear-optimizer-git-step-35-chara-de9f80-wo-w-gear-optimizer.vercel.app",
    "https://wow-gear-optimizer-nwj9-git-step-35-229feb-wo-w-gear-optimizer.vercel.app"
  ];
  for (const origin of allowedOrigins) {
    const res = mockResponse();
    setCorsHeaders({ headers: { origin } }, res);
    assert.strictEqual(res.headers["Access-Control-Allow-Origin"], origin, "approved website origin should be allowed");
    assert.strictEqual(res.headers.Vary, "Origin");
  }
  const blocked = mockResponse();
  setCorsHeaders({ headers: { origin: "https://unrelated-site.vercel.app" } }, blocked);
  assert.strictEqual(blocked.headers["Access-Control-Allow-Origin"], undefined, "unrelated Vercel origins must not be allowed");
  assert.strictEqual(blocked.headers.Vary, "Origin");

  for (const [name, handler] of [["character", characterHandler], ["realms", realmsHandler]]) {
    const res = mockResponse();
    await handler({ method: "POST", query: {}, headers: { origin: allowedOrigins[1] } }, res);
    assert.strictEqual(res.statusCode, 405, name + " endpoint must reject non-GET requests");
    assert.strictEqual(res.headers.Allow, "GET", name + " endpoint must advertise GET only");
    assert.strictEqual(res.headers["Access-Control-Allow-Origin"], allowedOrigins[1], name + " endpoint must allow an approved preview origin");
    assert.strictEqual(res.headers.Vary, "Origin", name + " endpoint must vary by Origin");
  }

  const missingCharacterParams = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "Burning Legion" }, headers: {} }, missingCharacterParams);
  assert.strictEqual(missingCharacterParams.statusCode, 400, "character endpoint must reject missing character name");
  assert.strictEqual(missingCharacterParams.body.error, "Realm and character name are required.");

  const missingRealmParams = mockResponse();
  await characterHandler({ method: "GET", query: {}, headers: {} }, missingRealmParams);
  assert.strictEqual(missingRealmParams.statusCode, 400, "character endpoint must reject missing realm and name");

  const oversizedRealm = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "R".repeat(101), character: "Failing" }, headers: {} }, oversizedRealm);
  assert.strictEqual(oversizedRealm.statusCode, 400, "character endpoint must reject oversized realm values");
  assert.strictEqual(oversizedRealm.body.error, "Realm or character name is too long.");

  const oversizedCharacter = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "Burning Legion", character: "C".repeat(65) }, headers: {} }, oversizedCharacter);
  assert.strictEqual(oversizedCharacter.statusCode, 400, "character endpoint must reject oversized character values");
  assert.strictEqual(oversizedCharacter.body.error, "Realm or character name is too long.");

  console.log("Character and realm API request-guard tests passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
