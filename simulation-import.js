// Simulation result import adapter.
// Browser-safe: parses user-provided JSON only. It does not call SimulationCraft,
// Blizzard, Raidbots, or any external service.

function getSimulationCraftPlayer(input) {
  if (Array.isArray(input?.players) && input.players.length) return input.players[0];
  if (input?.player && typeof input.player === "object") return input.player;
  return null;
}

function getSimulationCraftPatch(input) {
  return input?.sim?.options?.dbc?.Live?.wow_version ||
    input?.sim?.dbc?.Live?.wow_version ||
    input?.version ||
    null;
}

function getSimulationCraftGeneratedAt(input) {
  if (input?.generatedAt || input?.generated_at) return input.generatedAt || input.generated_at;
  if (Number.isFinite(Number(input?.timestamp))) {
    return new Date(Number(input.timestamp) * 1000).toISOString();
  }
  return null;
}

function normalizeSimulationResult(value) {
  const input = value && typeof value === "object" ? value : {};
  const player = getSimulationCraftPlayer(input);
  const isSimulationCraft = Array.isArray(input.players) || input.report_version || input.git_revision;

  const source = input.source ||
    input.simulator ||
    (isSimulationCraft ? "SimulationCraft" : "Simulation-derived");

  const scaleFactors =
    input.scaleFactors ||
    input.scale_factors ||
    input.stats?.scaleFactors ||
    input.stats?.scale_factors ||
    input.player?.scaleFactors ||
    input.player?.scale_factors ||
    player?.scaleFactors ||
    player?.scale_factors ||
    null;

  if (!scaleFactors || typeof scaleFactors !== "object" || Array.isArray(scaleFactors)) {
    throw new Error("Simulation result does not contain scale factors.");
  }

  const normalized = {};
  for (const [key, rawValue] of Object.entries(scaleFactors)) {
    const valueNumber = Number(rawValue);
    if (!Number.isFinite(valueNumber)) continue;
    normalized[key] = valueNumber;
  }

  if (!Object.keys(normalized).length) {
    throw new Error("Simulation result contains no valid scale factors.");
  }

  return {
    source,
    method: input.method || (isSimulationCraft ? "scale-factors" : "scale-factors"),
    patch: input.patch || getSimulationCraftPatch(input),
    specialization: input.specialization || input.spec || player?.specialization || null,
    characterId: input.characterId ?? input.character_id ?? null,
    generatedAt: getSimulationCraftGeneratedAt(input),
    scaleFactors: normalized
  };
}

function parseSimulationResultJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Simulation result is not valid JSON.");
  }
  return normalizeSimulationResult(parsed);
}

if (typeof window !== "undefined") {
  window.WoWSimulationImport = {
    normalizeSimulationResult,
    parseSimulationResultJson
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    normalizeSimulationResult,
    parseSimulationResultJson
  };
}
