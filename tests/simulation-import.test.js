const i = require("../simulation-import.js");

const result = i.normalizeSimulationResult({
  source: "SimulationCraft",
  method: "scale-factors",
  patch: "12.1",
  specialization: "Arms",
  character_id: 777,
  generated_at: "2026-10-07T00:00:00Z",
  scale_factors: {
    strength: 1.7,
    haste_rating: 1.25,
    critical_strike: 0.55,
    invalid: "bad",
    negative: -1
  }
});

if (result.source !== "SimulationCraft" ||
    result.specialization !== "Arms" ||
    result.characterId !== 777 ||
    result.scaleFactors.strength !== 1.7 ||
    result.scaleFactors.haste_rating !== 1.25 ||
    result.scaleFactors.invalid !== undefined ||
    result.scaleFactors.negative !== undefined) {
  throw new Error("Simulation result normalization failed");
}

const nested = i.normalizeSimulationResult({
  player: {
    scale_factors: {
      strength: 1,
      haste: 0.8
    }
  },
  spec: "Arms"
});
if (nested.scaleFactors.strength !== 1 || nested.specialization !== "Arms") {
  throw new Error("Nested simulation scale-factor parsing failed");
}

const parsed = i.parseSimulationResultJson('{"source":"SimulationCraft","scaleFactors":{"Strength":1,"Haste":0.9}}');
if (parsed.source !== "SimulationCraft" || parsed.scaleFactors.Haste !== 0.9) {
  throw new Error("Simulation JSON parsing failed");
}

for (const invalid of [
  "{}",
  '{"scaleFactors":{}}',
  '{"scaleFactors":{"Haste":-1}}',
  "not json"
]) {
  let failed = false;
  try { i.parseSimulationResultJson(invalid); } catch { failed = true; }
  if (!failed) throw new Error("Invalid simulation input should be rejected");
}

console.log("Step 13 simulation import adapter passed.");
