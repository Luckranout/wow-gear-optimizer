const fs = require("fs");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const optimizer = fs.readFileSync("optimizer.js", "utf8");

for (const id of [
  "coachContentLabel",
  "coachContentFocus",
  "coachContentPriorities",
  "coachContentDefensive",
  "coachContentCooldowns",
  "coachContentMistakes"
]) assert.ok(index.includes(`id="${id}"`), `missing ${id}`);

assert.ok(index.includes("Solo / Open World"), "missing Solo / Open World goal");
assert.ok(app.includes("coach.content"), "app does not render content coaching");
assert.ok(optimizer.includes('solo: "Solo / Open World"'), "optimizer does not define solo goal");

console.log("Content-aware UI tests passed.");
