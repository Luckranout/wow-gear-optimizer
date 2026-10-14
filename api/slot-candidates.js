const { fetchSlotCandidates } = require("../server/blizzard-character");
const { setCorsHeaders } = require("./cors");

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const rawSlots = String(req.query?.slots || "Neck,Shoulders");
  const slots = rawSlots.split(",").map(value => value.trim()).filter(Boolean);
  if (!slots.length || slots.some(slot => !["Neck", "Shoulders"].includes(slot))) {
    return res.status(400).json({ error: "Only Neck and Shoulders candidates can be requested." });
  }

  try {
    const result = await fetchSlotCandidates({
      slots,
      clientId: process.env.BLIZZARD_CLIENT_ID,
      clientSecret: process.env.BLIZZARD_CLIENT_SECRET
    });
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 502;
    return res.status(status).json({
      error: error.publicMessage || "Unable to retrieve Neck and Shoulder candidates from Blizzard."
    });
  }
};
