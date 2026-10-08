const assert=require("assert");
const {createEncounterGuidance,createCharacterCoach}=require("../coach");
const empty=createEncounterGuidance();
assert.strictEqual(empty.available,false);
const encounter=createEncounterGuidance({encounter:{name:"Example Boss",description:"A test encounter.",mechanics:[
{name:"Move",type:"movement"}, {name:"Cast",type:"interrupt"}, {name:"Hit",type:"damage"}, {name:"Swap",type:"target"}
]}});
assert.strictEqual(encounter.available,true);
assert.strictEqual(encounter.title,"Example Boss");
assert.strictEqual(encounter.mechanics.length,4);
assert.ok(encounter.mechanics[0].action.includes("Move"));
assert.ok(encounter.mechanics[1].action.includes("interrupt"));
const coach=createCharacterCoach({character:{className:"Warrior",specialization:"Fury",equipment:{}},report:{},goal:"Raid",encounter:{name:"Boss",mechanics:[]}});
assert.strictEqual(coach.encounter.title,"Boss");
console.log("Encounter-aware coach tests passed.");
