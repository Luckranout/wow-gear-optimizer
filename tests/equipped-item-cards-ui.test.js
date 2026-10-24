const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const server = fs.readFileSync("server/blizzard-character.js", "utf8");
const endpoint = fs.readFileSync("api/item-media.js", "utf8");
const { normalizeEquippedItem } = require("../server/blizzard-character");
const { normalizeEquipmentSockets } = require("../equipment-sockets");

const objectLevelItem = normalizeEquippedItem({
  item: { id: 12345 }, name: { en_US: "Test Item" }, slot: { type: "HEAD" },
  level: { value: 642, display_string: "642" }
});
if (objectLevelItem.itemLevel !== 642) {
  throw new Error(`Structured Blizzard item level should normalize to 642; got ${String(objectLevelItem.itemLevel)}`);
}
const numericLevelItem = normalizeEquippedItem({
  item: { id: 12346 }, name: "Numeric Item", slot: { type: "NECK" }, level: 639
});
if (numericLevelItem.itemLevel !== 639) throw new Error("Numeric item levels must remain numeric.");


const socketed = normalizeEquipmentSockets({
  sockets: [{ socket_type: { name: "Prismatic Socket" }, item: { id: 192999, name: "Quick Ruby" } }]
});
if (socketed.status !== "available" || socketed.sockets[0].gemName !== "Quick Ruby") {
  throw new Error("Equipped socket data should expose the actual gem name when Blizzard provides it.");
}
const emptySocket = normalizeEquipmentSockets({ sockets: [{ socket_type: { name: "Prismatic Socket" } }] });
if (emptySocket.sockets[0].state !== "empty") throw new Error("A socket placement with no gem must be identified as empty.");
if (!app.includes('? "No socket equipped"')) throw new Error("A known socket placement without a gem must display No socket equipped.");
const gemSummary = require("../equipment-sockets").summarizeEquipmentGems([
  { sockets: [
    { item: { id: 1, name: "Ruby", stats: [{ name: "Strength", value: 10 }] } },
    {},
    { item: { id: 2, name: "Sapphire" } }
  ] }
]);
if (gemSummary.installed !== 2 || gemSummary.empty !== 1 || gemSummary.socketsKnown !== 3) {
  throw new Error("Gem summary must count installed gems and empty sockets separately.");
}
if (gemSummary.stats.Strength !== 10) throw new Error("Gem summary must total only explicitly provided gem stats.");
const unavailableSockets = normalizeEquipmentSockets({});
if (unavailableSockets.status !== "unavailable") throw new Error("Missing socket data must not be reported as no sockets.");
if (!app.includes("renderItemSockets(item)") || !app.includes('if (normalized.status !== "available" || !normalized.sockets.length) return ""')) {
  throw new Error("Equipment cards must render known socket data and omit socket UI when no socket entries are returned.");
}

for (const needle of ["normalizeImportedEquipment", "displayItemLevel(value)", "display_string", "item.itemLevel", "item.name", "loadEquippedItemIcon", "/api/item-media?id=", "slot-item-name"]) {
  if (!app.includes(needle)) throw new Error(`Equipment UI missing expected behavior: ${needle}`);
}
if (!styles.includes(".slot-icon img")) throw new Error("Equipment UI must display item artwork.");
if (!server.includes("/data/wow/media/item/")) throw new Error("Item icons must be retrieved from Blizzard item media.");
if (!server.includes('asset.key === "icon"')) throw new Error("Item media must use Blizzard's icon asset.");
if (!endpoint.includes("setCorsHeaders")) throw new Error("Item media API must use shared CORS handling.");
if (!endpoint.includes("BLIZZARD_CLIENT_SECRET")) throw new Error("Blizzard credentials must remain server-side.");
console.log("Equipped item cards UI contract passed.");


// Item icons should expose a keyboard-accessible hover/focus tooltip with Blizzard-style
// text ordering and explicitly supplied stats; the tooltip itself does not add custom artwork.
for (const required of [
  "renderItemHoverTooltip(item)",
  "item-hover-name",
  "item-hover-level",
  "item-hover-stats",
  "item-hover-stat",
  "renderWowheadItemLink(item"
]) {
  if (!app.includes(required)) throw new Error("Item hover tooltip missing behavior: " + required);
}
if (!styles.includes(".slot-icon-wrap:hover .item-hover-tooltip") ||
    !styles.includes(".compare-icon-wrap:focus-within .item-hover-tooltip") ||
    !styles.includes(".item-hover-name.item-quality-epic")) {
  throw new Error("Item tooltip must appear on hover/focus and use Blizzard rarity colors.");
}
console.log("Blizzard-style item tooltip UI contract passed.");

for (const required of [
  "loadBlizzardTooltipData()",
  "data/blizzard-tooltip-lines.json",
  "renderCapturedBlizzardTooltip(item, captured)",
  "tooltipColorStyle(line?.leftColor)"
]) {
  if (!app.includes(required)) throw new Error("Captured Blizzard tooltip data integration missing: " + required);
}
if (!styles.includes(".item-hover-tooltip-blizzard") ||
    !styles.includes(".item-hover-blizzard-line-type-22")) {
  throw new Error("Captured Blizzard tooltip rows must preserve tooltip-specific line layout.");
}
console.log("Captured Blizzard tooltip data integration contract passed.");

if (!app.includes('data-wowhead="item=') ||
    !app.includes('https://www.wowhead.com/item=') ||
    !app.includes('class="wowhead-item-link ')) {
  throw new Error("Equipped and recommended item icons must use Wowhead's live item tooltip renderer.");
}
const page = fs.readFileSync("index.html", "utf8");
if (!page.includes("https://wow.zamimg.com/js/tooltips.js") ||
    !page.includes("hide: { extra: true }")) {
  throw new Error("Wowhead tooltips must load with non-game-only tooltip details hidden.");
}
console.log("Wowhead live item tooltip integration contract passed.");

if (!app.includes("function getItemQualityClass(item)") ||
    !app.includes('4: "epic"') ||
    !app.includes('"item-quality-" + qualityName') ||
    !styles.includes(".item-hover-name.item-quality-epic")) {
  throw new Error("Tooltip item names should map supplied item quality to World of Warcraft rarity colors.");
}
console.log("WoW item-quality tooltip styling regression passed.");
