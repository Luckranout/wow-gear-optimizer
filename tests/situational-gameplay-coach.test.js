const assert = require("assert");
const { createSituationalGuidance, createCharacterCoach } = require("../coach");
const tank=createSituationalGuidance({profile:{role:"Tank"}});
const dps=createSituationalGuidance({profile:{role:"Damage"}});
for(const key of ["incomingDamage","lowHealth","movement","targetSwap","multipleTargets","cooldownReady","resourceHigh","outOfRange","interruption","note"]){
  assert.ok(tank[key] && String(tank[key]).length>10,key);
}
assert.notStrictEqual(tank.incomingDamage,dps.incomingDamage);
const unsupported=createCharacterCoach({character:{className:"Mage",specialization:"Frost",equipment:{}},report:{},goal:"Mythic+"});
assert.strictEqual(unsupported.gameplay.supported,false);
assert.ok(unsupported.situations.note.includes("not invented"));
console.log("Situational gameplay coach tests passed.");
