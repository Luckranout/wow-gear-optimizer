const { setCorsHeaders } = require("./cors");
const { getItem } = require("../server/blizzard-item-catalog");

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const rawId = String(req.query?.id || "").trim();
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    return res.status(400).json({ error: "A positive item ID is required." });
  }
  try {
    const result = await getItem(Number(rawId));
    if (!result.item) return res.status(404).json({ itemId: Number(rawId), status: "not-found" });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      item: result.item,
      cache: result.cache,
      persistentStorage: result.persistentStorage,
      seasonEligibility: "unverified"
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.publicMessage || "Unable to retrieve this item from Blizzard."
    });
  }
};
