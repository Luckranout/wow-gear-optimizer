#!/usr/bin/env node
"use strict";

// Convert WoW's SavedVariables Lua file for WoWTooltipExporter into ordinary JSON.
// Usage: node scripts/convert-wow-tooltip-export.js input.lua [output.json]

const fs = require("node:fs");
const path = require("node:path");

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (source.startsWith("--", i)) {
      const end = source.indexOf("\n", i + 2);
      i = end < 0 ? source.length : end + 1;
      continue;
    }
    if ("{}[]=,;".includes(ch)) { tokens.push({ type: ch, value: ch }); i++; continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = "";
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          i++;
          const escaped = source[i++];
          const map = { n: "\n", r: "\r", t: "\t", "\\": "\\", '"': '"', "'": "'" };
          if (escaped === "x") {
            const hex = source.slice(i, i + 2);
            if (!/^[\da-f]{2}$/i.test(hex)) throw new Error("Invalid Lua hex escape.");
            value += String.fromCharCode(parseInt(hex, 16));
            i += 2;
          } else if (escaped >= "0" && escaped <= "9") {
            let digits = escaped;
            for (let count = 0; count < 2 && /\d/.test(source[i] || ""); count++) digits += source[i++];
            value += String.fromCharCode(Number(digits) % 256);
          } else {
            value += Object.prototype.hasOwnProperty.call(map, escaped) ? map[escaped] : escaped;
          }
        } else {
          value += source[i++];
        }
      }
      if (source[i] !== quote) throw new Error("Unterminated Lua string.");
      i++;
      tokens.push({ type: "string", value });
      continue;
    }
    const number = source.slice(i).match(/^-?(?:\d+\.\d+|\d+|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
    const identifier = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) { tokens.push({ type: "identifier", value: identifier[0] }); i += identifier[0].length; continue; }
    throw new Error("Unsupported Lua syntax near: " + source.slice(i, i + 30));
  }
  return tokens;
}

function parseSavedVariables(source) {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (type) => {
    const token = tokens[pos];
    if (!token || (type && token.type !== type)) {
      throw new Error("Expected " + (type || "token") + " at token " + pos + ".");
    }
    pos++;
    return token;
  };

  function parseValue() {
    const token = peek();
    if (!token) throw new Error("Unexpected end of SavedVariables file.");
    if (token.type === "string" || token.type === "number") return take().value;
    if (token.type === "{") return parseTable();
    if (token.type === "identifier") {
      const value = take().value;
      if (value === "true") return true;
      if (value === "false") return false;
      if (value === "nil") return null;
      throw new Error("Unexpected Lua identifier value: " + value);
    }
    throw new Error("Unexpected token " + token.type + " at token " + pos + ".");
  }

  function parseTable() {
    take("{");
    const object = {};
    let arrayIndex = 1;
    while (peek() && peek().type !== "}") {
      let key;
      let explicitKey = false;
      if (peek().type === "[") {
        take("[");
        key = parseValue();
        take("]");
        take("=");
        explicitKey = true;
      } else if (peek().type === "identifier" && tokens[pos + 1]?.type === "=") {
        key = take("identifier").value;
        take("=");
        explicitKey = true;
      }
      const value = parseValue();
      if (explicitKey) object[String(key)] = value;
      else object[String(arrayIndex++)] = value;
      if (peek()?.type === "," || peek()?.type === ";") take();
      else if (peek()?.type !== "}") throw new Error("Expected comma or closing brace at token " + pos + ".");
    }
    take("}");
    const keys = Object.keys(object);
    if (keys.length && keys.every((key, index) => key === String(index + 1))) {
      return keys.map(key => object[key]);
    }
    return object;
  }

  let root = null;
  while (pos < tokens.length) {
    const variable = take("identifier").value;
    take("=");
    const value = parseValue();
    if (variable === "WoWTooltipExporterDB") root = value;
    if (peek()?.type === ";") take();
  }
  if (!root || typeof root !== "object") throw new Error("Could not find WoWTooltipExporterDB in the input.");
  return root;
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/convert-wow-tooltip-export.js input.lua [output.json]");
    process.exitCode = 2;
    return;
  }
  const output = process.argv[3] || input.replace(/\.lua$/i, ".json");
  const parsed = parseSavedVariables(fs.readFileSync(input, "utf8"));
  const items = parsed.items && typeof parsed.items === "object" ? parsed.items : {};
  const itemCount = Object.keys(items).length;
  fs.writeFileSync(output, JSON.stringify({ source: path.basename(input), exportedAt: new Date().toISOString(), items }, null, 2) + "\n");
  console.log("Converted " + itemCount + " item record(s) to " + output);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseSavedVariables, tokenize };
