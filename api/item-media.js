const { fetchItemMedia } = require("../server/blizzard-character");
const { setCorsHeaders } = require("./cors");

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const itemId = String(req.query?.id || "").trim();
  if (!/^\d+$/.test(itemId) || Number(itemId) <= 0) {
    return res.status(400).json({ error: "A valid item ID is required." });
  }

  try {
    const result = await fetchItemMedia({
      itemId,
      clientId: process.env.BLIZZARD_CLIENT_ID,
      clientSecret: process.env.BLIZZARD_CLIENT_SECRET
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 502;
    return res.status(status).json({ error: error.publicMessage || "Unable to retrieve this item icon." });
  }
};
