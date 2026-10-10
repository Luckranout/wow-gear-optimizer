const ALLOWED_ORIGINS = new Set([
  "https://luckranout.github.io",
  "https://wow-gear-optimizer.vercel.app",
  "https://wow-gear-optimizer-nwj9.vercel.app"
]);

// Preview deployments for this repository use Vercel's generated project URLs.
// Match only the two known project-name patterns, not arbitrary *.vercel.app sites.
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/(?:wow-gear-optimizer|wow-gear-optimizer-nwj9)-git-[a-z0-9-]+-wo-w-gear-optimizer\.vercel\.app$/i;

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  if (origin && (ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
}

module.exports = { setCorsHeaders };
