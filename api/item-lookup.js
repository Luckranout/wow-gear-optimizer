const { setCorsHeaders } = require("./cors");

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();
const STAT_NAMES = {
  "strength": "Strength", "agility": "Agility", "intellect": "Intellect",
  "stamina": "Stamina", "critical strike": "CriticalStrike", "crit": "CriticalStrike",
  "haste": "Haste", "mastery": "Mastery", "versatility": "Versatility",
  "armor": "Armor", "leech": "Leech", "avoidance": "Avoidance", "speed": "Speed"
};

function parseTooltip(payload, id, rank) {
  const tooltip = payload && payload.tooltip;
  const html = typeof tooltip === "string" ? tooltip :
    tooltip && (tooltip.html || tooltip.content || tooltip.text);
  if (typeof html !== "string" || !html.trim()) return null;
  const decodeEntities = value => value
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/g, "&")
    .replace(/&plus;/g, "+").replace(/&#43;/g, "+").replace(/&minus;/g, "-")
    .replace(/&ndash;|&mdash;/g, "-").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  const tooltipText = decodeEntities(html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:tr|td|div|p|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  const plain = tooltipText.replace(/\s+/g, " ").trim();
  const levelMatch = plain.match(/\bItem\s+Level\s+(\d+)\b/i);
  if (!levelMatch) return null;
  const effectMatch = plain.match(/(?:Use|Equip|Chance on hit):?\s*(.+?)(?=\s+(?:Requires Level|Classes:|Races:|Sell Price:|Dropped by:)|$)/i);
  const effectText = effectMatch ? effectMatch[0].trim() : "";
  // Active effect stats are not passive item stats; keep them out of the gear-stat score.
  const passivePlain = effectText ? plain.replace(effectText, " ") : plain;
  const stats = {};
  const statNames = "Strength|Agility|Intellect|Stamina|Critical Strike|Crit|Haste|Mastery|Versatility|Armor|Leech|Avoidance|Speed";
  // Wowhead can render the same passive stat either as "+123 Strength" or
  // "Strength +123" depending on tooltip source/locale. Accept both forms;
  // never infer a missing stat from item level or a base-item placeholder.
  const statPatterns = [
    new RegExp("([+\\-−]?\\s*\\d[\\d,]*)\\s+(" + statNames + ")\\b", "gi"),
    new RegExp("\\b(" + statNames + ")\\s+(\\d[\\d,]*)(?![\\d,])", "gi")
  ];
  for (const statPattern of statPatterns) {
    let match;
    while ((match = statPattern.exec(passivePlain))) {
      const nameFirst = /^[A-Za-z]/.test(match[1]);
      const statName = nameFirst ? match[1] : match[2];
      const rawValue = nameFirst ? match[2] : match[1];
      const key = STAT_NAMES[statName.toLowerCase()];
      const value = Number(rawValue.replace(/[,+\\s]/g, "").replace("−", "-"));
      if (key && Number.isFinite(value) && value !== 0) stats[key] = value;
    }
  }
  if (!Object.keys(stats).length) return null;
  const durationMatch = effectText.match(/(?:for|lasting)\s+(\d+)\s*(sec(?:ond)?s?|min(?:ute)?s?)/i);
  const cooldownMatch = plain.match(/(?:(\d+)\s*min(?:ute)?s?\s*,?\s*)?(\d+)\s*sec(?:ond)?s?\s*cooldown/i) ||
    plain.match(/cooldown\s*:?\s*(?:(\d+)\s*min(?:ute)?s?\s*,?\s*)?(\d+)\s*sec(?:ond)?s?/i);
  const toSeconds = (amount, unit) => Number(amount) * (/^min/i.test(unit) ? 60 : 1);
  const durationSeconds = durationMatch ? toSeconds(durationMatch[1], durationMatch[2]) : null;
  const cooldownSeconds = cooldownMatch ? Number(cooldownMatch[1] || 0) * 60 + Number(cooldownMatch[2]) : null;
  const temporaryStats = {};
  if (effectText) {
    const temporaryStatPattern = /(?:gain(?:ing)?|grants?|increases?\s+(?:your\s+)?)\s*(?:\+\s*)?(\d[\d,]*)\s+(Strength|Agility|Intellect|Stamina|Critical Strike|Crit|Haste|Mastery|Versatility)\b/gi;
    let effectStat;
    while ((effectStat = temporaryStatPattern.exec(effectText))) {
      const statName = STAT_NAMES[effectStat[2].toLowerCase()];
      if (statName) temporaryStats[statName] = Number(effectStat[1].replace(/,/g, ""));
    }
  }
  const trinketEffect = effectText ? {
    text: effectText, durationSeconds, cooldownSeconds, temporaryStats,
    scoringMethod: Object.keys(temporaryStats).length && durationSeconds && cooldownSeconds
      ? "weighted temporary stats multiplied by duration/cooldown uptime"
      : "effect displayed; not numerically scored because reliable structured values are incomplete"
  } : null;
  return {
    id: Number(id), itemLevel: Number(levelMatch[1]), level: Number(levelMatch[1]),
    upgradeRank: Number(rank), stats,
    wowheadTooltipText: tooltipText,
    wowheadEffectText: effectText || null,
    trinketEffect,
    statsSource: "Wowhead live tooltip",
    variantSource: "Wowhead live tooltip explicitly resolved upgrade rank " + rank,
    sourceUrl: "https://www.wowhead.com/item=" + Number(id) + "&upgd=" + Number(rank),
    variantKey: "wowhead:upgd" + Number(rank) + ":ilvl" + Number(levelMatch[1]),
    lookupStatus: "verified"
  };
}

async function lookup(id, rank, fetchImpl = globalThis.fetch) {
  const key = id + ":" + rank;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const url = "https://nether.wowhead.com/tooltip/item/" + id +
    "?dataEnv=1&locale=0&upgd=" + rank;
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "WoW-Gear-Optimizer/1.0" }
  });
  if (!response.ok) throw new Error("Wowhead HTTP " + response.status);
  const payload = await response.json();
  const variant = parseTooltip(payload, id, rank);
  if (variant) cache.set(key, { value: variant, expires: Date.now() + CACHE_TTL_MS });
  return variant;
}

async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const id = Number(req.query?.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "A positive item ID is required." });
  }
  const requestedRank = req.query?.rank == null || req.query.rank === "" ? null : Number(req.query.rank);
  if (requestedRank !== null && (!Number.isInteger(requestedRank) || requestedRank < 1 || requestedRank > 20)) {
    return res.status(400).json({ error: "Upgrade rank must be an integer from 1 to 20." });
  }
  try {
    const ranks = requestedRank === null ? [1, 2, 3, 4, 5, 6] : [requestedRank];
    const results = await Promise.all(ranks.map(async rank => {
      try { return await lookup(id, rank, handler._test.fetch || globalThis.fetch); }
      catch (_) { return null; }
    }));
    const variants = results.filter(Boolean);
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({
      itemId: id, source: "wowhead-live-tooltip", status: variants.length ? "verified" : "unavailable",
      variants, unresolvedRanks: ranks.filter((rank, index) => !results[index])
    });
  } catch (_) {
    return res.status(502).json({ itemId: id, status: "unavailable", error: "Wowhead live lookup failed." });
  }
}
handler._test = { parseTooltip, lookup, cache, setFetch(fetchImpl) { handler._test.fetch = fetchImpl; } };
module.exports = handler;
