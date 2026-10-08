const assert=require("assert");
const {createSetCraftedGuidance}=require("../coach");
const x=createSetCraftedGuidance({character:{equipment:{"Head":{isSetPiece:true}}},dataset:{setBonuses:[{id:1}],embellishments:[{id:2}]}});
assert.strictEqual(x.setPieces,1);
assert.ok(x.bonusLine.includes("1 set-bonus"));
assert.ok(x.embellishmentLine.includes("1 embellishment"));
assert.ok(x.recommendation.length>10);
console.log("Set guidance tests passed.");
