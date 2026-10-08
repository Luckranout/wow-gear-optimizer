const assert=require("assert");
const {createSpendingGuidance}=require("../coach");
const x=createSpendingGuidance({report:{upgradePlans:[{slot:"Head",title:"Upgrade Head",status:"ready",resources:"20 crests",weeklyFit:"Fits this week"}]}});
assert.ok(x.next.includes("Head"));
assert.strictEqual(x.steps.length,1);
assert.ok(x.rule.includes("scarce currency"));
const empty=createSpendingGuidance({report:{}});
assert.strictEqual(empty.steps.length,0);
console.log("Upgrade spending tests passed.");
