import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const errors = [];

const core = [
  "home.html",
  "eiendomsradgiver-spania.html",
  "ai-og-salgsstrategi.html",
  "entreprenor-og-strategi.html",
  "foredrag-og-radgivning.html",
  "olivenolje-og-dona-anna.html",
  "struktur.html",
  "avtale.html",
  "artikler/index.html",
];

const localized = ["en/index.html","es/index.html","de/index.html","fr/index.html","ru/index.html"];

function one(html, needle, label, file) {
  const count = html.split(needle).length - 1;
  if (count !== 1) errors.push(`${file}: expected exactly one ${label}, found ${count}`);
}
function between(html, start, end) {
  const i = html.indexOf(start);
  if (i < 0) return "";
  const j = html.indexOf(end, i + start.length);
  return j < 0 ? "" : html.slice(i + start.length, j);
}
function metaDescription(html) {
  const marker = 'name="description"';
  const i = html.indexOf(marker);
  if (i < 0) return "";
  const c = html.indexOf('content="', i);
  if (c < 0) return "";
  const e = html.indexOf('"', c + 9);
  return e < 0 ? "" : html.slice(c + 9, e);
}

for (const file of core) {
  const html = read(file);
  one(html.toLowerCase(), "<h1", "H1", file);
  one(html, 'rel="canonical"', "canonical", file);
  if (!html.includes('application/ld+json')) errors.push(`${file}: structured data missing`);
  if (!html.includes('/assets/freddy-2027.css')) errors.push(`${file}: 2027 design system missing`);
  if (!html.includes('/assets/freddy-2027.js')) errors.push(`${file}: progressive enhancement missing`);

  const title = between(html, "<title>", "</title>").trim();
  const desc = metaDescription(html).trim();
  if (title.length < 45 || title.length > 65) errors.push(`${file}: title length ${title.length}, expected 45-65`);
  if (desc.length < 120 || desc.length > 170) errors.push(`${file}: description length ${desc.length}, expected 120-170`);
}

for (const file of ["home.html", ...localized]) {
  const html = read(file);
  one(html.toLowerCase(), "<h1", "H1", file);
  one(html, 'rel="canonical"', "canonical", file);
  if (!html.includes('class="intent-section"')) errors.push(`${file}: intent-first customer journey missing`);
  if (!html.includes('/assets/freddy-2027.css')) errors.push(`${file}: 2027 design system missing`);
  for (const lang of ["no","en","fr","es","de","ru","x-default"]) {
    if (!html.includes(`hreflang="${lang}"`)) errors.push(`${file}: hreflang ${lang} missing`);
  }
}

const css = read("assets/freddy-2027.css");
for (const token of ["prefers-reduced-motion",":focus-visible","--fb-travertine","@view-transition",".intent-grid",".article-shell"]) {
  if (!css.includes(token)) errors.push(`assets/freddy-2027.css: missing ${token}`);
}

const vercel = read("vercel.json");
if (!vercel.includes('"dest": "/api/article?slug=$1"')) errors.push("vercel.json: article slugs are not server-rendered");
if (!vercel.includes('"dest": "/api/sitemap"')) errors.push("vercel.json: root sitemap is not dynamic");

const article = read("api/article.js");
for (const token of ["BlogPosting","BreadcrumbList","Cache-Control","mainEntityOfPage"]) {
  if (!article.includes(token)) errors.push(`api/article.js: missing ${token}`);
}

const sitemap = read("api/sitemap.js");
if (!sitemap.includes("/artikler/") || !sitemap.includes("website-content")) errors.push("api/sitemap.js: article discovery missing");

const home = read("home.html");
for (const token of [
  "https://www.freddybremseth.com/#person",
  "https://www.freddybremseth.com/#projects",
  "https://no.linkedin.com/in/freddybremseth",
  "https://www.chatgenius.pro/",
  "https://www.zenecohomes.com/",
  "https://www.pinosoecolife.com/",
  "https://www.donaanna.com/",
  "https://books.freddybremseth.com/",
  "https://art.freddybremseth.com/",
  "https://remaster.freddybremseth.com/"
]) {
  if (!home.includes(token)) errors.push(`home.html: authority hub project graph missing ${token}`);
}
if (!home.includes('"@type":"ItemList"')) errors.push("home.html: authority hub project graph ItemList missing");

if (errors.length) {
  console.error("\nFreddy root SEO/AEO/GEO audit failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log("Freddy root SEO/AEO/GEO audit passed.");


