// Browser-safe helpers for consuming normalized Blizzard character imports.
// No Blizzard credentials or API calls belong in this file.

function validateImportedCharacter(value) {
  const character = value && typeof value === "object" ? value : null;
  const equipment = character?.equipment;
  const required = ["id", "name", "realm", "class", "activeSpec", "equipment"];
  const missing = required.filter(key => character?.[key] == null);

  if (!character || missing.length) {
    return { valid: false, errors: missing.length ? [`Missing required character fields: ${missing.join(", ")}`] : ["Character data must be an object."] };
  }

  if (!character.realm?.name || !character.class?.name || !character.activeSpec?.name) {
    return { valid: false, errors: ["Character realm, class, and active specialization are required."] };
  }

  if (!Array.isArray(equipment)) {
    return { valid: false, errors: ["Character equipment must be an array."] };
  }

  return { valid: true, errors: [], character };
}

function parseImportedCharacterJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, errors: ["The selected file is not valid JSON."] };
  }
  return validateImportedCharacter(parsed);
}

function formatCharacterStatistics(statistics = {}) {
  const labels = {
    Strength: "Strength", Agility: "Agility", Intellect: "Intellect", Stamina: "Stamina",
    CriticalStrike: "Critical Strike", Haste: "Haste", Mastery: "Mastery", Versatility: "Versatility"
  };
  return Object.entries(statistics || {})
    .filter(([key, value]) => labels[key] && Number.isFinite(Number(value)))
    .map(([key, value]) => ({ key, label: labels[key], value: Number(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function formatImportedCharacterSummary(character) {
  if (!character) return "";
  const realm = character.realm?.name || "Unknown realm";
  const spec = character.activeSpec?.name || "Unknown specialization";
  const cls = character.class?.name || "Unknown class";
  const level = character.level != null ? ` • Level ${character.level}` : "";
  const count = Array.isArray(character.equipment) ? character.equipment.length : 0;
  return `${character.name} — ${cls} / ${spec} — ${realm}${level} • ${count} equipped items`;
}

if (typeof window !== "undefined") {
  window.WoWCharacterImport = {
    validateImportedCharacter,
    parseImportedCharacterJson,
    formatImportedCharacterSummary,
    formatCharacterStatistics
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    validateImportedCharacter,
    parseImportedCharacterJson,
    formatImportedCharacterSummary
  };
}
