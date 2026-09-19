# Freddy Bremseth Art — art.freddybremseth.com

**Status: NOT YET DEPLOYABLE — gallery package and public artwork previews still need to be uploaded.** Do not import this folder into Vercel until the files below are present. Stripe remains disabled.

The complete, already prepared gallery package is available in the ChatGPT conversation as `Freddy_Bremseth_Art_Galleri_sortert_etter_stil.zip` (approximately 39 MB). The archive contains a top-level folder `art_freddybremseth_site/`, with 100 individual artwork pages and 200 public WebP previews, curated by visual style, plus the API source for future Stripe integration.

To finish this folder:

1. Unzip `Freddy_Bremseth_Art_Galleri_sortert_etter_stil.zip` on your computer.
2. Copy **the contents** of its `art_freddybremseth_site/` folder into this repository's `art/` folder, preserving all nested folders, especially `assets/art/`, `api/`, `assets/catalog.json`, `assets/styles.json`, `scripts/`, `index.html`, `package.json`, and `vercel.json`. GitHub Desktop is convenient for the ~200 images. Commit/push those files. Replace this placeholder README with the full bundle's README if desired.
3. In Vercel: New Project → import `freddybremseth-coder/freddybremseth` → set **Root Directory = `art`**, Framework Preset = Other; Build Command = `npm run build`; Install Command = `npm install`.
4. Add `art.freddybremseth.com` under the *new art project*'s Domains settings and create the DNS record Vercel requests. Do not change the main website or books DNS records.
5. Keep `DIGITAL_SALES_ENABLED=false` until Stripe and private originals storage are configured and tested. The public preview images must never be substituted for paid downloadable master files.

The ChatGPT GitHub connector can write UTF-8 files but cannot upload the 200 binary WebP previews directly from the ChatGPT working container. Creating this placeholder directory alone **does not** publish or install the gallery.
