// Simulation result import adapter.
// Browser-safe: parses user-provided JSON only. It does not call SimulationCraft,
// Blizzard, Raidbots, or any external service.

function normalizeSimulationResult(value) {
  const input = value && typeof value === "object" ? value : {};
  const source = input.source || input.simulator || "Simulation-derived";
  const scaleFactors =
    input.scaleFactors ||
    input.scale_factors ||
    input.stats?.scaleFactors ||
    input.stats?.scale_factors ||
    input.player?.scaleFactors ||
    input.player?.scale_factors ||
    null;

  if (!scaleFactors || typeof scaleFactors !== "object" || Array.isArray(scaleFactors)) {
    throw new Error("Simulation result does not contain scale factors.");
  }

  const normalized = {};
  for (const [key, rawValue] of Object.entries(scaleFactors)) {
    const valueNumber = Number(rawValue);
    if (!Number.isFinite(valueNumber) || valueNumber < 0) continue;
    normalized[key] = valueNumber;
  }

  if (!Object.keys(normalized).length) {
    throw new Error("Simulation result contains no valid non-negative scale factors.");
  }

  return {
    source,
    method: input.method || "scale-factors",
    patch: input.patch || input.version || null,
    specialization: input.specialization || input.spec || null,
    characterId: input.characterId ?? input.character_id ?? null,
    generatedAt: input.generatedAt || input.generated_at || null,
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
