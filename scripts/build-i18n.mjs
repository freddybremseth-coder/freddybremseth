/*
 * Genererer indekserbare språksider for freddybremseth.com.
 *
 * Norsk er kildespråket (home.html serveres på «/», nedlasting.html på
 * /nedlasting.html). Scriptet oversetter alle [data-i18n]-elementer med
 * ordbøkene i assets/i18n-dict.js og skriver komplette sider til
 * /en, /fr, /es, /de og /ru. Det setter <html lang>, oversatt <title> og
 * meta-beskrivelse, lokaliserer de interne lenkene som har språkversjoner,
 * og legger hreflang + canonical inn i både språksidene og de norske
 * kildesidene (mellom <!-- i18n:hreflang -->-markørene — idempotent).
 *
 *   node scripts/build-i18n.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.freddybremseth.com";
const LANGS = ["en", "fr", "es", "de", "ru"];

const PAGES = [
  // home.html serveres på «/» (vercel.json-route); språkversjonene legges som
  // <lang>/index.html slik at /en/ serverer dem direkte.
  { src: "home.html", out: "index.html", id: "home", urlPath: "/" },
  { src: "nedlasting.html", out: "nedlasting.html", id: "dl", urlPath: "/nedlasting.html" },
];

// Interne lenker som har språkversjoner. Undersidene (eiendomsrådgiver,
// artikler osv.) finnes kun på norsk og beholdes som de er.
const LOCALIZED_LINKS = ["/nedlasting.html"];

function loadDict() {
  const code = fs.readFileSync(path.join(root, "assets/i18n-dict.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  if (!sandbox.window.FB_DICT) throw new Error("Fant ikke window.FB_DICT i assets/i18n-dict.js");
  return sandbox.window.FB_DICT;
}

function findElementEnd(html, tagName, contentStart) {
  const openRe = new RegExp(`<${tagName}(\\s|>)`, "gi");
  const closeRe = new RegExp(`</${tagName}\\s*>`, "gi");
  let depth = 1;
  let pos = contentStart;
  while (depth > 0) {
    closeRe.lastIndex = pos;
    const close = closeRe.exec(html);
    if (!close) throw new Error(`Fant ikke lukkende </${tagName}>`);
    openRe.lastIndex = pos;
    let open = openRe.exec(html);
    while (open && open.index < close.index) {
      depth += 1;
      openRe.lastIndex = open.index + 1;
      const next = openRe.exec(html);
      pos = open.index + 1;
      open = next;
    }
    depth -= 1;
    pos = close.index + close[0].length;
    if (depth === 0) return { contentEnd: close.index };
  }
  throw new Error("unreachable");
}

function translateMarked(html, dict, warn) {
  const re = /<([a-zA-Z0-9]+)([^>]*\sdata-i18n="([^"]+)"[^>]*)>/g;
  let out = "";
  let cursor = 0;
  let match;
  while ((match = re.exec(html))) {
    const [full, tag, , key] = match;
    const value = dict[key];
    const contentStart = match.index + full.length;
    if (/\/>$/.test(full)) continue;
    const { contentEnd } = findElementEnd(html, tag, contentStart);
    out += html.slice(cursor, contentStart);
    if (value != null) out += value;
    else {
      warn(key);
      out += html.slice(contentStart, contentEnd);
    }
    cursor = contentEnd;
    re.lastIndex = contentEnd;
  }
  out += html.slice(cursor);
  return out;
}

function rewritePaths(html, lang) {
  for (const link of LOCALIZED_LINKS) {
    html = html.replaceAll(`href="${link}"`, `href="/${lang}${link}"`);
  }
  // Merkelenken hjem skal peke til samme språk.
  html = html.replace(/class="(nav-logo|brand)" href="\/"/g, `class="$1" href="/${lang}/"`);
  return html;
}

function hreflangBlock(urlPath) {
  return [
    `  <link rel="alternate" hreflang="no" href="${SITE}${urlPath}">`,
    ...LANGS.map((l) => `  <link rel="alternate" hreflang="${l}" href="${SITE}/${l}${urlPath === "/" ? "/" : urlPath}">`),
    `  <link rel="alternate" hreflang="x-default" href="${SITE}${urlPath}">`,
  ].join("\n");
}

function injectHead(html, block) {
  // Fjern eksisterende markørblokk og alle canonical-lenker utenfor den,
  // så kjøringen aldri etterlater duplikater.
  html = html.replace(/\n?[ \t]*<!-- i18n:hreflang -->[\s\S]*?<!-- \/i18n:hreflang -->/, "");
  html = html.replace(/[ \t]*<link rel="canonical"[^>]*>\n?/g, "");
  const wrapped = `\n  <!-- i18n:hreflang -->\n${block}\n  <!-- /i18n:hreflang -->`;
  return html.replace(/\n<\/head>/, `${wrapped}\n</head>`);
}

const dict = loadDict();
const missing = new Set();

for (const page of PAGES) {
  const sourcePath = path.join(root, page.src);
  let source = fs.readFileSync(sourcePath, "utf8");

  const noBlock = `  <link rel="canonical" href="${SITE}${page.urlPath}">\n${hreflangBlock(page.urlPath)}`;
  fs.writeFileSync(sourcePath, injectHead(source, noBlock));
  source = fs.readFileSync(sourcePath, "utf8");

  for (const lang of LANGS) {
    const d = dict[lang];
    if (!d) throw new Error(`Mangler ordbok for ${lang}`);
    const warn = (key) => missing.add(`${lang}:${key}`);

    let html = source;
    html = html.replace(/<html lang="no">/, `<html lang="${lang}">`);
    if (d[`pg_${page.id}_title`]) {
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${d[`pg_${page.id}_title`]}</title>`);
      html = html.replace(/(<meta property="og:title" content=")[^"]*(" \/?>|">)/, `$1${d[`pg_${page.id}_title`].replace(/"/g, "&quot;")}$2`);
    }
    if (d[`pg_${page.id}_desc`]) {
      html = html.replace(/(<meta name="description" content=")[^"]*(" \/?>|">)/, `$1${d[`pg_${page.id}_desc`].replace(/"/g, "&quot;")}$2`);
      html = html.replace(/(<meta property="og:description" content=")[^"]*(" \/?>|">)/, `$1${d[`pg_${page.id}_desc`].replace(/"/g, "&quot;")}$2`);
    }
    html = translateMarked(html, d, warn);
    html = rewritePaths(html, lang);
    const langUrl = page.urlPath === "/" ? `/${lang}/` : `/${lang}${page.urlPath}`;
    const langBlock = `  <link rel="canonical" href="${SITE}${langUrl}">\n${hreflangBlock(page.urlPath)}`;
    html = injectHead(html, langBlock);

    const outPath = path.join(root, lang, page.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`✓ ${lang}/${page.out}`);
  }
}

// Oppdater sitemap.xml: alle språkversjoner mellom markører.
const smPath = path.join(root, "sitemap.xml");
let sitemap = fs.readFileSync(smPath, "utf8");
const today = new Date().toISOString().slice(0, 10);
const entries = PAGES.flatMap((page) => {
  const urls = [
    ...(page.urlPath === "/" ? [] : [`${SITE}${page.urlPath}`]),
    ...LANGS.map((l) => (page.urlPath === "/" ? `${SITE}/${l}/` : `${SITE}/${l}${page.urlPath}`)),
  ];
  return urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
}).join("\n");
const smMarked = /\n?[ \t]*<!-- i18n:pages -->[\s\S]*?<!-- \/i18n:pages -->/;
const smWrapped = `\n  <!-- i18n:pages -->\n${entries}\n  <!-- /i18n:pages -->`;
if (smMarked.test(sitemap)) sitemap = sitemap.replace(smMarked, smWrapped);
else sitemap = sitemap.replace(/\n<\/urlset>/, `${smWrapped}\n</urlset>`);
fs.writeFileSync(smPath, sitemap);
console.log("✓ sitemap.xml");

if (missing.size > 0) {
  console.warn(`\nManglende nøkler (${missing.size}):`);
  for (const key of [...missing].sort()) console.warn(`  - ${key}`);
  process.exitCode = 1;
} else {
  console.log("\nAlle nøkler oversatt.");
}
