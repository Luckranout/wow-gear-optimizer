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
  const plain = html.replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/(?:tr|td|div|p|li)>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&").replace(/&plus;/g, "+")
    .replace(/&#43;/g, "+").replace(/&minus;/g, "-")
    .replace(/&ndash;|&mdash;/g, "-").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ");
  const levelMatch = plain.match(/\bItem\s+Level\s+(\d+)\b/i);
  if (!levelMatch) return null;
  const effectMatch = plain.match(/(?:Use|Equip|Chance on hit):?\s*(.+?)(?=\s+(?:Requires Level|Classes:|Races:|Sell Price:|Dropped by:)|$)/i);
  const effectText = effectMatch ? effectMatch[0].trim() : "";
  // Active effect stats are not passive item stats; keep them out of the gear-stat score.
  const passivePlain = effectText ? plain.replace(effectText, " ") : plain;
  const stats = {};
  const statPattern = /([+\-−]?\s*\d[\d,]*)\s+(Strength|Agility|Intellect|Stamina|Critical Strike|Crit|Haste|Mastery|Versatility|Armor|Leech|Avoidance|Speed)\b/gi;
  let match;
  while ((match = statPattern.exec(passivePlain))) {
    const key = STAT_NAMES[match[2].toLowerCase()];
    const value = Number(match[1].replace(/[,+\s]/g, "").replace("−", "-"));
    if (key && Number.isFinite(value) && value !== 0) stats[key] = value;
  }
  if (!Object.keys(stats).length) return null;
  return {
    id: Number(id), itemLevel: Number(levelMatch[1]), level: Number(levelMatch[1]),
    upgradeRank: Number(rank), stats,
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
