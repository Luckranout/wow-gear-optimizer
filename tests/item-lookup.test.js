const assert = require("node:assert/strict");
const handler = require("../api/item-lookup");
const { parseTooltip, createResponse } = (() => ({
  parseTooltip: handler._test.parseTooltip,
  createResponse: () => ({
    statusCode: 200, headers: {}, body: null,
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; }
  })
}))();

const html = "<table><tr><td>Item Level 334</td></tr><tr><td>+36 Agility</td><td>+565 Stamina</td><td>+40 Critical Strike</td><td>+21 Haste</td></tr></table>";
const variant = parseTooltip({tooltip:{html}},268240,6);
assert.equal(variant.itemLevel,334);
assert.equal(variant.upgradeRank,6);
assert.equal(variant.stats.Agility,36);
assert.equal(variant.stats.Stamina,565);
assert.equal(variant.stats.CriticalStrike,40);
assert.equal(variant.stats.Haste,21);
assert.equal(variant.lookupStatus,"verified");
assert.equal(parseTooltip({tooltip:{html:"<td>+40 Haste</td>"}},268240,6),null,"must not infer item level");
assert.equal(parseTooltip({tooltip:{html:"<td>Item Level 334</td>"}},268240,6),null,"must not accept missing stats");

(async()=>{
  handler._test.cache.clear();
  handler._test.setFetch(async url => {
    assert.match(url,/\/tooltip\/item\/268240\?/);
    assert.match(url,/upgd=6/);
    return {ok:true,json:async()=>({tooltip:{html}})};
  });
  const res=createResponse();
  await handler({method:"GET",query:{id:"268240",rank:"6"},headers:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.status,"verified");
  assert.equal(res.body.variants[0].itemLevel,334);
  const invalid=createResponse();
  await handler({method:"GET",query:{id:"nope"},headers:{}},invalid);
  assert.equal(invalid.statusCode,400);
  console.log("Wowhead live item lookup parsing and endpoint tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
