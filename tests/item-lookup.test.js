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

const html = "<table><tr><td>Item Level 334</td></tr><tr><td>+36 Agility</td><td>+565 Stamina</td><td>+40 Critical Strike</td><td>+21 Haste</td></tr><tr><td>Use: Gain 422 Mastery for 10 sec.</td><td>(1 Min, 30 Sec Cooldown)</td></tr></table>";
const variant = parseTooltip({tooltip:{html}},268240,6);
assert.equal(variant.itemLevel,334);
assert.equal(variant.upgradeRank,6);
assert.equal(variant.stats.Agility,36);
assert.equal(variant.stats.Stamina,565);
assert.equal(variant.stats.CriticalStrike,40);
assert.equal(variant.stats.Haste,21);

const nameFirstHtml = "<table><tr><td>Item Level 334</td></tr><tr><td>Strength 1,234</td><td>Stamina 2,932</td><td>Versatility 59</td><td>Mastery 91</td></tr></table>";
const nameFirstVariant = parseTooltip({tooltip:{html:nameFirstHtml}},251144,6);
assert.equal(nameFirstVariant.stats.Strength,1234,"name-first Wowhead stat labels retain primary stat");
assert.equal(nameFirstVariant.stats.Stamina,2932,"name-first Wowhead stat labels retain stamina");
assert.equal(nameFirstVariant.stats.Versatility,59);
assert.equal(nameFirstVariant.stats.Mastery,91);
assert.equal(variant.lookupStatus,"verified");
assert.match(variant.wowheadTooltipText,/Item Level 334/);
assert.match(variant.wowheadTooltipText,/Gain 422 Mastery/);
assert.equal(variant.trinketEffect.durationSeconds,10);
assert.equal(variant.trinketEffect.cooldownSeconds,90);
assert.equal(variant.trinketEffect.temporaryStats.Mastery,422);
assert.equal(variant.stats.Mastery,undefined,"temporary on-use stats must not be counted as passive stats");
assert.match(variant.wowheadTooltipText,/Item Level 334/);
assert.match(variant.wowheadTooltipText,/Gain 422 Mastery/);
assert.equal(variant.trinketEffect.durationSeconds,10);
assert.equal(variant.trinketEffect.cooldownSeconds,90);
assert.equal(variant.trinketEffect.temporaryStats.Mastery,422);
assert.equal(variant.stats.Mastery,undefined,"temporary on-use stats must not be counted as passive stats");
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
