const assert = require("assert");
const characterHandler = require("../api/character");
const realmsHandler = require("../api/realms");

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
  for (const [name, handler] of [["character", characterHandler], ["realms", realmsHandler]]) {
    const res = mockResponse();
    await handler({ method: "POST", query: {} }, res);
    assert.strictEqual(res.statusCode, 405, name + " endpoint must reject non-GET requests");
    assert.strictEqual(res.headers.Allow, "GET", name + " endpoint must advertise GET only");
    assert.strictEqual(res.headers["Access-Control-Allow-Origin"], "https://luckranout.github.io", name + " endpoint must restrict browser origin");
    assert.strictEqual(res.headers.Vary, "Origin", name + " endpoint must vary by origin");
  }

  const missingCharacterParams = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "Burning Legion" } }, missingCharacterParams);
  assert.strictEqual(missingCharacterParams.statusCode, 400, "character endpoint must reject missing character name");
  assert.strictEqual(missingCharacterParams.body.error, "Realm and character name are required.");

  const missingRealmParams = mockResponse();
  await characterHandler({ method: "GET", query: {} }, missingRealmParams);
  assert.strictEqual(missingRealmParams.statusCode, 400, "character endpoint must reject missing realm and name");

  const oversizedRealm = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "R".repeat(101), character: "Failing" } }, oversizedRealm);
  assert.strictEqual(oversizedRealm.statusCode, 400, "character endpoint must reject oversized realm values");
  assert.strictEqual(oversizedRealm.body.error, "Realm or character name is too long.");

  const oversizedCharacter = mockResponse();
  await characterHandler({ method: "GET", query: { realm: "Burning Legion", character: "C".repeat(65) } }, oversizedCharacter);
  assert.strictEqual(oversizedCharacter.statusCode, 400, "character endpoint must reject oversized character values");
  assert.strictEqual(oversizedCharacter.body.error, "Realm or character name is too long.");

  console.log("Character and realm API request-guard tests passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
