const SOURCE_URL = "https://realtyflow.chatgenius.pro/api/public/website-content?brand=freddyb&destination=artikler&limit=50";
const SITE = "https://www.freddybremseth.com";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleFromMarkdown(markdown, fallback) {
  const line = String(markdown || "").split(/\r?\n/).find((item) => item.trim());
  if (line && /^#{1,3}\s+/.test(line.trim())) return line.trim().replace(/^#{1,3}\s+/, "").trim();
  return String(fallback || "").trim();
}

function stripLeadingHeading(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let skipped = false;
  const output = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!skipped && !line) continue;
    if (!skipped && /^#{1,3}\s+/.test(line)) { skipped = true; continue; }
    skipped = true;
    output.push(raw);
  }
  return output.join("\n").trim();
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let html = "";
  let list = [];
  const flush = () => {
    if (!list.length) return;
    html += "<ul>" + list.map((item) => "<li>" + esc(item) + "</li>").join("") + "</ul>";
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^[-*]\s+/.test(line)) { list.push(line.replace(/^[-*]\s+/, "")); continue; }
    flush();
    if (line.startsWith("### ")) html += "<h3>" + esc(line.slice(4)) + "</h3>";
    else if (line.startsWith("## ")) html += "<h2>" + esc(line.slice(3)) + "</h2>";
    else if (line.startsWith("# ")) html += "<h2>" + esc(line.slice(2)) + "</h2>";
    else html += "<p>" + esc(line) + "</p>";
  }
  flush();
  return html;
}

function fmt(value) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("nb-NO", { day:"numeric", month:"long", year:"numeric" }).format(new Date(value)); }
  catch { return ""; }
}

function json(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

module.exports = async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end("<!doctype html><html lang=\"no\"><head><meta name=\"robots\" content=\"noindex,follow\"><title>Artikkel ikke funnet | Freddy Bremseth</title></head><body><p>Artikkelen finnes ikke.</p></body></html>");
  }

  try {
    const response = await fetch(SOURCE_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("content source " + response.status);
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const item = items.find((entry) => String(entry.slug || "").toLowerCase() === slug);
    if (!item) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end("<!doctype html><html lang=\"no\"><head><meta name=\"robots\" content=\"noindex,follow\"><title>Artikkel ikke funnet | Freddy Bremseth</title></head><body><p>Artikkelen finnes ikke.</p></body></html>");
    }

    const title = titleFromMarkdown(item.markdown, item.title) || "Artikkel";
    const bodyMarkdown = stripLeadingHeading(item.markdown);
    const summary = String(item.summary || bodyMarkdown.split(/\n+/).find(Boolean) || "").replace(/^#{1,3}\s+/, "").slice(0, 260);
    const description = summary.length > 158 ? summary.slice(0, 155).replace(/\s+\S*$/, "") + "…" : summary;
    const canonical = SITE + "/artikler/" + slug;
    const published = item.published_at || item.created_at || "";
    const related = items.filter((entry) => entry.slug && entry.slug !== slug).slice(0, 4);
    const image = item.image_url || "";

    const schema = {
      "@context":"https://schema.org",
      "@graph":[
        {
          "@type":"BlogPosting",
          "@id":canonical + "#article",
          headline:title,
          description,
          url:canonical,
          mainEntityOfPage:canonical,
          ...(published ? {datePublished:published,dateModified:published} : {}),
          ...(image ? {image:[image]} : {}),
          author:{"@id":SITE + "/#person"},
          publisher:{"@id":SITE + "/#person"},
          inLanguage:"nb-NO"
        },
        {
          "@type":"BreadcrumbList",
          itemListElement:[
            {"@type":"ListItem",position:1,name:"Forside",item:SITE + "/"},
            {"@type":"ListItem",position:2,name:"Artikler",item:SITE + "/artikler/"},
            {"@type":"ListItem",position:3,name:title,item:canonical}
          ]
        }
      ]
    };

    const relatedHtml = related.map((entry) => {
      const relatedTitle = titleFromMarkdown(entry.markdown, entry.title) || entry.slug;
      return '<a href="/artikler/' + esc(entry.slug) + '">' + esc(relatedTitle) + '<span>→</span></a>';
    }).join("");

    const html = `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} | Freddy Bremseth</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${image ? '<meta property="og:image" content="' + esc(image) + '">' : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/freddy-2027.css?v=20261002">
  <script type="application/ld+json">${json(schema)}</script>
</head>
<body class="article-page">
  <header class="site-nav">
    <a class="nav-logo" href="/">Freddy <span>Bremseth</span></a>
    <nav class="nav-links" aria-label="Hovedmeny">
      <a href="/eiendomsradgiver-spania.html">Eiendom</a>
      <a href="/ai-og-salgsstrategi.html">AI og salg</a>
      <a href="/entreprenor-og-strategi.html">Strategi</a>
      <a class="active" href="/artikler/">Artikler</a>
      <a href="/foredrag-og-radgivning.html">Rådgivning</a>
      <a class="nav-cta" href="/avtale">Bestill samtale</a>
    </nav>
  </header>
  <main>
    <section class="hero article-hero">
      <div class="container">
        <p class="eyebrow">Artikkel · Freddy Bremseth</p>
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(summary)}</p>
        <div class="breadcrumb"><a href="/">Forside</a><span>/</span><a href="/artikler/">Artikler</a><span>/</span><span>${esc(title)}</span></div>
        ${published ? '<p class="article-date">Publisert ' + esc(fmt(published)) + '</p>' : ""}
      </div>
    </section>
    <section class="article-content-section">
      <div class="container article-shell">
        <article class="article-prose">
          ${image ? '<img class="article-cover" src="' + esc(image) + '" alt="' + esc(title) + '" loading="eager">' : ""}
          ${renderMarkdown(bodyMarkdown)}
          <div class="article-author">
            <strong>Freddy Bremseth</strong>
            <p>Entreprenør, eiendomsrådgiver og rådgiver innen AI, salg og strategi.</p>
            <a href="/struktur.html">Se fagområder og prosjekter →</a>
          </div>
        </article>
        <aside class="article-rail">
          <p class="section-label">Neste steg</p>
          <a href="/artikler/">Alle artikler <span>→</span></a>
          <a href="/avtale">Bestill en samtale <span>→</span></a>
          <a href="/struktur.html">Se oversikt <span>→</span></a>
          ${relatedHtml ? '<div class="article-related"><p class="section-label">Flere artikler</p>' + relatedHtml + '</div>' : ""}
        </aside>
      </div>
    </section>
  </main>
  <footer class="footer"><div class="container footer-inner"><div><div class="footer-logo">Freddy <span>Bremseth</span></div><p class="small">© Freddy Bremseth</p></div><nav class="footer-links"><a href="/artikler/">Artikler</a><a href="/struktur.html">Oversikt</a><a href="/avtale">Kontakt</a></nav></div></footer>
  <script src="/assets/freddy-2027.js?v=20261002" defer></script>
  <script src="/assets/search-discovery.js" defer></script>
</body>
</html>`;

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.end(html);
  } catch (error) {
    res.statusCode = 503;
    res.setHeader("Retry-After", "60");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end("<!doctype html><html lang=\"no\"><head><meta name=\"robots\" content=\"noindex,follow\"><title>Midlertidig utilgjengelig | Freddy Bremseth</title></head><body><p>Artikkelen er midlertidig utilgjengelig.</p></body></html>");
  }
};