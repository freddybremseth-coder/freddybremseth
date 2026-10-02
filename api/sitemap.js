const SOURCE_URL = "https://realtyflow.chatgenius.pro/api/public/website-content?brand=freddyb&destination=artikler&limit=50";
const SITE = "https://www.freddybremseth.com";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateOnly(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const core = [
    ["/", today, "1.0"],
    ["/eiendomsradgiver-spania.html", today, "0.9"],
    ["/ai-og-salgsstrategi.html", today, "0.9"],
    ["/entreprenor-og-strategi.html", today, "0.86"],
    ["/foredrag-og-radgivning.html", today, "0.84"],
    ["/olivenolje-og-dona-anna.html", today, "0.8"],
    ["/struktur.html", today, "0.82"],
    ["/artikler/", today, "0.82"],
    ["/avtale", today, "0.7"],
    ["/en/", today, "0.72"],
    ["/es/", today, "0.72"],
    ["/de/", today, "0.72"],
    ["/fr/", today, "0.72"],
    ["/ru/", today, "0.72"]
  ];

  let articleRows = [];
  try {
    const response = await fetch(SOURCE_URL, { headers: { accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      articleRows = items
        .filter((item) => /^[a-z0-9-]{2,120}$/.test(String(item.slug || "")))
        .map((item) => ["/artikler/" + item.slug, dateOnly(item.published_at || item.created_at, today), "0.76"]);
    }
  } catch (_) {}

  const urls = core.concat(articleRows).map(([path, lastmod, priority]) =>
    "  <url>\n" +
    "    <loc>" + esc(SITE + path) + "</loc>\n" +
    "    <lastmod>" + esc(lastmod) + "</lastmod>\n" +
    "    <changefreq>" + (path.startsWith("/artikler/") ? "monthly" : "monthly") + "</changefreq>\n" +
    "    <priority>" + priority + "</priority>\n" +
    "  </url>"
  ).join("\n");

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + '\n</urlset>\n';

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return res.end(xml);
};