// Guard actual root Vercel hostname routing, not only generated Books build output.
// Every book URL in the published sitemap must resolve to exact checked-in SEO HTML.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const sitemap = fs.readFileSync(path.join(root, "books/sitemap.xml"), "utf8");
const origin = "https://books.freddybremseth.com";
const urls = [...sitemap.matchAll(/<loc>https:\/\/books\.freddybremseth\.com(\/(?:en\/|es\/)?book\/[a-z0-9-]+)<\/loc>/g)].map(match => match[1]);
assert.ok(urls.length >= 90, "Unexpectedly sparse book sitemap");

const rules = cfg.routes.filter(rule =>
  rule.has?.some(condition => condition.type === "host" && condition.value === "books.freddybremseth.com") &&
  rule.dest?.startsWith("/books/seo/")
);
assert.equal(rules.length, 2, "Expected one localized and one Norwegian book route");

for (const pagePath of urls) {
  const captures = rules.map(rule => ({
    rule, match: pagePath.match(new RegExp("^" + rule.src + "$")),
  })).filter(result => result.match);
  assert.equal(captures.length, 1, "Expected exactly one book rewrite for " + pagePath);
  const matched = captures[0];
  const destination = matched.rule.dest.replace(/\$(\d+)/g, (_placeholder, index) => matched.match[Number(index)]);
  const file = path.join(root, destination.slice(1));
  assert.ok(fs.existsSync(file), "Public route has no checked-in HTML: " + pagePath);
  const html = fs.readFileSync(file, "utf8");
  const url = origin + pagePath;
  assert.ok(html.includes('<link rel="canonical" href="' + url + '"'), "Wrong canonical for " + pagePath);
  assert.ok(/<h1>[^<]+<\/h1>/.test(html), "Missing crawlable book title for " + pagePath);
  assert.ok(html.includes('<script src="/assets/books-app.js"></script>'), "Book UI not preserved: " + pagePath);
}
assert.equal(new Set(urls).size, urls.length, "Duplicate book URL in sitemap");
console.log("PASS root Books public routing:", urls.length, "indexable book URLs have exact checked-in SEO HTML, canonical and UI scripts");
