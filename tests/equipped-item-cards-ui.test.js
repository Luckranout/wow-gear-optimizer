const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
const server = fs.readFileSync("server/blizzard-character.js", "utf8");
const endpoint = fs.readFileSync("api/item-media.js", "utf8");
const { normalizeEquippedItem } = require("../server/blizzard-character");

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

for (const needle of ["normalizeImportedEquipment", "displayItemLevel(value)", "display_string", "item.itemLevel", "item.name", "loadEquippedItemIcon", "/api/item-media?id=", "slot-item-name"]) {
  if (!app.includes(needle)) throw new Error(`Equipment UI missing expected behavior: ${needle}`);
}
if (!styles.includes(".slot-icon img")) throw new Error("Equipment UI must display item artwork.");
if (!server.includes("/data/wow/media/item/")) throw new Error("Item icons must be retrieved from Blizzard item media.");
if (!server.includes('asset.key === "icon"')) throw new Error("Item media must use Blizzard's icon asset.");
if (!endpoint.includes("setCorsHeaders")) throw new Error("Item media API must use shared CORS handling.");
if (!endpoint.includes("BLIZZARD_CLIENT_SECRET")) throw new Error("Blizzard credentials must remain server-side.");
console.log("Equipped item cards UI contract passed.");
