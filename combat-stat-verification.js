(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WoWCombatStatVerification = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function getSlot(itemOrSlot) {
    if (typeof itemOrSlot === "string") return itemOrSlot;
    return itemOrSlot?.slot ||
      itemOrSlot?.inventoryType?.name ||
      itemOrSlot?.inventoryType?.type ||
      itemOrSlot?.inventoryType ||
      "";
  }

  function requiresPrimaryStat(itemOrSlot) {
    const slot = String(getSlot(itemOrSlot)).toLowerCase();
    if (/neck|necklace|amulet|back|cloak|finger|ring|trinket/.test(slot)) return false;
    return /head|shoulder|chest|robe|wrist|hand|waist|leg|feet|weapon|shield|holdable/.test(slot);
  }

  function getStats(record) {
    return record?.stats ?? record?.statValues ?? record?.stat_values ?? record?.attributes;
  }

  function hasPositiveStats(values) {
    if (Array.isArray(values)) {
      return values.some(stat => Number(stat?.value ?? stat?.amount ?? stat) > 0);
    }
    if (values && typeof values === "object") {
      return Object.values(values).some(value => Number(value?.value ?? value?.amount ?? value) > 0);
    }
    return false;
  }

  function hasPrimaryStat(record) {
    const values = getStats(record);
    const entries = Array.isArray(values)
      ? values
      : values && typeof values === "object"
        ? Object.entries(values).map(([name, value]) => ({ name, value }))
        : [];
    return entries.some(stat => {
      const rawName = stat?.type?.name || stat?.name || stat?.type || stat?.stat || "";
      const name = String(rawName).replace(/[\s_-]/g, "").toLowerCase();
      return ["strength", "agility", "intellect"].includes(name) &&
        Number(stat?.value ?? stat?.amount ?? stat) > 0;
    });
  }

  function hasVerifiedCombatStats(item) {
    const variants = Array.isArray(item?.variants)
      ? item.variants.filter(variant => Number(variant?.itemLevel ?? variant?.level) > 0)
      : [];
    if (requiresPrimaryStat(item)) {
      if (variants.length) {
        return variants.some(variant => hasPrimaryStat(variant) && hasPositiveStats(getStats(variant)));
      }
      return hasPrimaryStat(item) && hasPositiveStats(getStats(item));
    }
    return hasPositiveStats(getStats(item)) ||
      variants.some(variant => hasPositiveStats(getStats(variant)));
  }

  function filterVerifiedVariants(item, variants) {
    const needsPrimary = requiresPrimaryStat(item);
    return (Array.isArray(variants) ? variants : []).filter(variant =>
      Number(variant?.itemLevel ?? variant?.level) > 0 &&
      hasPositiveStats(getStats(variant)) &&
      (!needsPrimary || hasPrimaryStat(variant))
    );
  }

  return { getSlot, requiresPrimaryStat, hasPositiveStats, hasPrimaryStat, hasVerifiedCombatStats, filterVerifiedVariants };
});
