const { fetchCharacter } = require("../server/blizzard-character");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://luckranout.github.io");
  res.setHeader("Vary", "Origin");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const realm = String(req.query?.realm || "").trim();
  const character = String(req.query?.character || "").trim();
  if (!realm || !character) {
    return res.status(400).json({ error: "Realm and character name are required." });
  }

  try {
    const result = await fetchCharacter({
      realm,
      character,
      clientId: process.env.BLIZZARD_CLIENT_ID,
      clientSecret: process.env.BLIZZARD_CLIENT_SECRET
    });
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 502;
    return res.status(status).json({ error: error.publicMessage || "Unable to look up that character." });
  }
};
