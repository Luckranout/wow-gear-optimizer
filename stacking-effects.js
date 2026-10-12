/**
 * Generic model for temporary/stacking item effects.
 *
 * This module deliberately does not infer undocumented mechanics. Effects are
 * scoreable only when their per-stack value and expected active-stack fraction
 * are explicitly supplied from a verified source or a separately validated model.
 */
"use strict";

const SUPPORTED_EFFECT_TYPES = new Set([
  "stacking_stat",
  "temporary_stat",
  "proc_damage",
  "on_use_stat"
]);

function validateEffect(effect) {
  const errors = [];
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    return { valid: false, errors: ["effect must be an object"] };
  }
  if (!SUPPORTED_EFFECT_TYPES.has(effect.type)) errors.push("unsupported or missing effect type");
  if (!effect.source || typeof effect.source !== "string") errors.push("source must identify the evidence source");
  if (!effect.mechanicVerified) errors.push("mechanics are not verified");
  if (effect.type === "stacking_stat" || effect.type === "temporary_stat" || effect.type === "on_use_stat") {
    if (!effect.stat || typeof effect.stat !== "string") errors.push("stat is required");
    if (!Number.isFinite(effect.valuePerStack) || effect.valuePerStack < 0) errors.push("valuePerStack must be a non-negative number");
    if (!Number.isInteger(effect.maxStacks) || effect.maxStacks < 1) errors.push("maxStacks must be a positive integer");
    if (!Number.isFinite(effect.expectedStackFraction) || effect.expectedStackFraction < 0 || effect.expectedStackFraction > 1) {
      errors.push("expectedStackFraction must be explicitly provided between 0 and 1");
    }
    if (!Number.isFinite(effect.uptime) || effect.uptime < 0 || effect.uptime > 1) {
      errors.push("uptime must be explicitly provided between 0 and 1");
    }
  }
  return { valid: errors.length === 0, errors };
}

function evaluateStatEffect(effect) {
  const validation = validateEffect(effect);
  if (!validation.valid) {
    return { scoreable: false, expectedBonus: null, validationErrors: validation.errors };
  }
  if (!["stacking_stat", "temporary_stat", "on_use_stat"].includes(effect.type)) {
    return { scoreable: false, expectedBonus: null, validationErrors: ["effect type requires a dedicated damage/rotation model"] };
  }
  const expectedActiveStacks = effect.maxStacks * effect.expectedStackFraction;
  const expectedBonus = effect.valuePerStack * expectedActiveStacks * effect.uptime;
  return {
    scoreable: true,
    stat: effect.stat,
    expectedBonus,
    maxBonus: effect.valuePerStack * effect.maxStacks,
    expectedActiveStacks,
    uptime: effect.uptime,
    source: effect.source
  };
}

function evaluateItemEffects(effects = []) {
  if (!Array.isArray(effects)) throw new TypeError("effects must be an array");
  return effects.map(effect => ({ effectId: effect && effect.id || null, ...evaluateStatEffect(effect) }));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SUPPORTED_EFFECT_TYPES, validateEffect, evaluateStatEffect, evaluateItemEffects };
}
