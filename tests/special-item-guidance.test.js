const assert=require("assert");
const {createSpecialItemGuidance}=require("../coach");
const x=createSpecialItemGuidance({character:{equipment:{"Trinket 1":{name:"T1"},"Main Hand":{name:"Sword"}}},report:{topUpgrades:[{slot:"Trinket 1",recommendedItem:{name:"Better T"},improvement:10},{slot:"Main Hand",recommendedItem:{name:"Better W"},improvement:8},{slot:"Head",recommendedItem:{name:"Helm"},improvement:20}]}});
assert.ok(x.trinketLine.includes("1 equipped trinket"));
assert.ok(x.weaponLine.includes("1 equipped weapon"));
assert.strictEqual(x.ranked.length,2);
assert.ok(x.note.includes("complete effect package"));
console.log("Special item guidance tests passed.");
