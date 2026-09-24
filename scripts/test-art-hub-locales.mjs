import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");

const languages = {
  no: { file: "home.html", title: "Visuelle historier med noe å oppdage.", nav: "Kunst" },
  en: { file: "en/index.html", title: "Visual stories with something to discover.", nav: "Art" },
  es: { file: "es/index.html", title: "Historias visuales con mucho por descubrir.", nav: "Arte" },
  fr: { file: "fr/index.html", title: "Des histoires visuelles à découvrir.", nav: "Art" },
  de: { file: "de/index.html", title: "Visuelle Geschichten, in denen mehr steckt.", nav: "Kunst" },
  ru: { file: "ru/index.html", title: "Визуальные истории, в которых есть что открыть.", nav: "Искусство" },
};
const art = "https://art.freddybremseth.com/";

for (const [lang, info] of Object.entries(languages)) {
  test(`the ${lang} personal hub introduces Freddy Bremseth Art and links to the gallery`, () => {
    const html = read(info.file);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.ok(html.includes(`<a href="#kunst" data-i18n="nav_art">${info.nav}</a>`));
    assert.ok(html.includes(`id="kunst" aria-labelledby="art-feature-title"`));
    assert.ok(html.includes(`id="art-feature-title" data-i18n="art_title">${info.title}</h2>`));
    assert.ok(html.includes(`href="${art}" data-i18n="art_cta"`));
    assert.ok(html.includes(`src="${art}assets/art/marmorbyste-med-gullsprekker-og-sommerfugl-view.webp"`));
    assert.ok(html.includes(`data-i18n-alt="art_img_alt"`));
    assert.ok(html.includes(`data-i18n="panel_art"`));
    assert.ok(html.includes(`<link rel="canonical" href="https://www.freddybremseth.com/${lang === "no" ? "" : lang + "/"}">`));
    assert.equal(html.split('class="art-feature"').length - 1, 1, "one feature section per language");
    assert.equal(html.split("search-discovery.js").length - 1, 1, "preserve the existing analytics script");
  });
}

test("all six home pages are indexed in the sitemap", () => {
  const sitemap = read("sitemap.xml");
  for (const lang of Object.keys(languages)) {
    const url = lang === "no" ? "https://www.freddybremseth.com/" : `https://www.freddybremseth.com/${lang}/`;
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  }
});
