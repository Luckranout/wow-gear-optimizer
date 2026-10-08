const { fetchRealms } = require("../server/blizzard-character");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const realms = await fetchRealms({
      clientId: process.env.BLIZZARD_CLIENT_ID,
      clientSecret: process.env.BLIZZARD_CLIENT_SECRET
    });
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ realms, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const status = error.statusCode || 502;
    return res.status(status).json({ error: error.publicMessage || "Unable to load Blizzard realms." });
  }
};
