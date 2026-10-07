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
    result.scaleFactors.negative !== -1) {
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

const simc = i.normalizeSimulationResult({
  version: "1210-01",
  report_version: "2.0.0",
  timestamp: 1791414671,
  git_revision: "e3fa778",
  sim: {
    options: {
      dbc: {
        Live: { wow_version: "12.1.0.69933" }
      }
    }
  },
  players: [{
    name: "Failing",
    specialization: "Protection Warrior",
    scale_factors: {
      Str: 0.5241146953001533,
      Sta: 0.001302633849309427,
      AP: 0.5185370226240442,
      Crit: 0.08993453542203045,
      Haste: 0.08913253576780998,
      Mastery: 0.08082691429506685,
      Vers: 0.07343150499695836,
      Armor: -0.0010908238520395478,
      BonusArmor: -0.00023382356484331738,
      Wdps: 3.1226708231236839
    }
  }]
});
if (simc.source !== "SimulationCraft" ||
    simc.method !== "scale-factors" ||
    simc.patch !== "12.1.0.69933" ||
    simc.specialization !== "Protection Warrior" ||
    simc.generatedAt !== "2026-10-07T23:11:11.000Z" ||
    simc.scaleFactors.Str !== 0.5241146953001533 ||
    simc.scaleFactors.Armor !== -0.0010908238520395478 ||
    simc.scaleFactors.Wdps !== 3.1226708231236839) {
  throw new Error("Real SimulationCraft JSON normalization failed");
}

const parsed = i.parseSimulationResultJson('{"source":"SimulationCraft","scaleFactors":{"Strength":1,"Haste":0.9}}');
if (parsed.source !== "SimulationCraft" || parsed.scaleFactors.Haste !== 0.9) {
  throw new Error("Simulation JSON parsing failed");
}

for (const invalid of [
  "{}",
  '{"scaleFactors":{}}',
  '{"scaleFactors":{"Haste":"bad"}}',
  "not json"
]) {
  let failed = false;
  try { i.parseSimulationResultJson(invalid); } catch { failed = true; }
  if (!failed) throw new Error("Invalid simulation input should be rejected");
}

console.log("Step 17 real SimulationCraft import adapter passed.");
