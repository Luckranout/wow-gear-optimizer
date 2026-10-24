"use strict";
const assert = require("node:assert/strict");
const { parseSavedVariables } = require("../scripts/convert-wow-tooltip-export");
const lua = [
  "-- SavedVariables sample",
  "WoWTooltipExporterDB = {",
  "  items = {",
  '    ["212405"] = { itemID = 212405, capturedAt = "2026-10-24T12:00:00Z", hyperlink = "item:212405", hasDynamicData = false,',
  "      lines = {",
  '        { type = 22, leftText = "Example Sword", rightText = nil, leftColor = { r = 1, g = 0.5, b = 0.25, a = 1 }, wrapText = false },',
  '        { type = 31, leftText = "Item Level 250", rightText = "+12", leftColor = { r = 1, g = 1, b = 1 } },',
  "      },",
  "    },",
  '    ["212406"] = { itemID = 212406, error = "Tooltip unavailable" },',
  "  },",
  "}",
].join("\\n");
const parsed = parseSavedVariables(lua);
assert.equal(Object.keys(parsed.items).length, 2);
assert.equal(parsed.items["212405"].itemID, 212405);
assert.equal(parsed.items["212405"].lines.length, 2);
assert.equal(parsed.items["212405"].lines[0].leftText, "Example Sword");
assert.equal(parsed.items["212405"].lines[0].leftColor.r, 1);
assert.equal(parsed.items["212405"].lines[1].rightText, null);
assert.equal(parsed.items["212406"].error, "Tooltip unavailable");
console.log("WoW tooltip SavedVariables converter tests passed.");
