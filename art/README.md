# Freddy Bremseth Art — art.freddybremseth.com

A **63-artwork gallery application** prepared as an isolated **Vercel project with root directory `art/`**, matching the deployment architecture of `books/` in the connected `freddybremseth-coder/freddybremseth` GitHub repository. Nothing in this bundle changes the existing main or books websites.

**Status:** The public gallery, four thematic signature collections plus a studio archive, style/motif/colour-cue/orientation/price filters, artwork pages, responsive layouts, search, print-link support, €50 server-authoritative Stripe Checkout and verified private-file download code are implemented. **Live payment must remain OFF until private files, merchant details and Stripe are configured** until you configure the art project, private storage, Stripe, and merchant details. No working live domain or payment is claimed.

## What's in the bundle

- **63 unique artwork entries** from the individual pieces available in this conversation, including the 15 separate legacy gallery studies.
- **126 public WebP previews** (thumbnail + enlarged gallery view for each image), deliberately not the purchaser's full digital file.
- A static, search-friendly `/verk/<slug>/` page with artwork-specific title, description, canonical URL, Open Graph preview and CreativeWork structured data for **every work**, plus `sitemap.xml`, `robots.txt` and footer pages.
- Functional interactive gallery: four prominent thematic collections, an honest separate studio archive, existing visual-style categories as a second filter, selective title-based motif/colour-cue discovery, actual-price and orientation filters, title search, sorting, load-more, deep-linkable artwork modal, mobile layout and reduced-motion support.
- Digital edition: **€50 per image**; secret price comes from server code and cannot be changed from the browser. Stripe Checkout creates the session; confirmation verifies paid status, expected artwork, currency and total before issuing a five-minute signed private URL from Supabase Storage.
- Before charging for an item, the server checks its private master exists; sale activation requires configuring all artwork originals in the private bucket.
- Print-on-demand **link mapping** ready to fill once a real product/storefront URL exists. Prints are visibly marked “coming soon” until then. There are no fictional print prices, materials, sizes or shipping times.
- An upload tool and `private-masters-manifest.json` with precise source archive and entry for every artwork. The high-resolution files are **intentionally excluded** from the public web bundle to prevent unpaid distribution.

## Deploy alongside books.freddybremseth.com

The connected repository `freddybremseth-coder/freddybremseth` already contains `books/`, deployed as its own Vercel project. Add **the contents of this folder** as a sibling folder `art/` in the SAME repository (or use a dedicated repository if you prefer). In Vercel create a NEW project importing that repo with **Root Directory = `art`**. Use the default Vercel Framework Preset = Other; Install Command = `npm install`; Build Command = `npm run build`; Output Directory = `public` (generated during the build; API functions remain at project root). The app uses Vercel's `/api/*.js` Node functions.

Then add the custom domain `art.freddybremseth.com` to this NEW Vercel project and create the DNS record displayed by Vercel. Do **not** replace the main domain A/CNAME or the existing `books` record. It will not appear automatically without this deployment and DNS step.

For local preview from inside this folder:

```bash
npm run build
npm run preview
# visit http://localhost:4321/
```

Local preview keeps digital purchases disabled. Do not use a basic file:// URL: fetch() needs an HTTP server.


## Artwork title and duplicate review (20 September 2026)

Artwork titles use sentence-style capitalization: the first word is capitalized, subsequent words are lowercase unless they are proper names (for example Freddy/Freddys and the English geographical adjective Mediterranean). The original work **Barokk studie med musiker og vanitas stilleben** is retained. **Barokk studie med musikk og måneskinn**, a renamed copy of the same image, is expressly excluded from the new import manifest and the gallery exclusion list. Existing artwork IDs, paid download mappings and URLs remain unchanged.

The four public-preview ZIPs are already present in GitHub and contain 56 source entries, including the duplicate. The importer removes that duplicate and five more confirmed renamed copies, plus both previews for each, before building, then corrects imported title capitalization and publishes **50 unique new artworks**. An optional corrected 55-work ZIP bundle is also available, but no replacement upload is necessary. The build must report `ART_IMPORT_ADDED 50 TOTAL 113`; do not advertise 118 or 119 unique works.

## Curated collections and product availability

The customer-facing gallery features **The Human Condition** (33 works), **Words That Matter** (7), **Mediterranean Soul** (5), and **Earth & Emotion** (5). The other 13 works remain discoverable in a separate **Studio Archive** so historical studies and fjord/lake landscapes are not falsely presented as Mediterranean imagery. Collection curation is stored in `assets/collections.json`; the existing artistic style mapping and artwork IDs are preserved. The entire current catalogue has exactly one primary thematic collection.

Colour and motif filters are **selective discovery cues derived from current artwork titles/style**, not comprehensive human-verified colour analysis. Orientation uses the recorded image orientation, **not a physical print size**. All available prices are the genuine €50 personal-use digital product; higher price filter brackets correctly return no products until separately verified print or original products are available. The site must not describe a digital AI-assisted composition as a physically painted one or advertise fictitious edition limits, framing, shipping, or availability.

To add physical products, first obtain verified print-provider URLs and prices, dimensions, production quality/specifications and shipping terms, and proof/review of actual print masters. The current `assets/print-links.json` can surface real partner links without charging the digital Stripe checkout for a print. A future product catalogue with separate physical variants and prices is needed before higher-price filters represent actual purchasable inventory.

## Configure the 63 PRIVATE digital masters before activating Stripe

1. Use an existing Supabase project if you choose, but create a **dedicated private Storage bucket** named `art-originals` (`public=false`). Do not put print masters in `assets/`, a GitHub public repository, or a public Supabase bucket. The checkout code uses only the service key on the Vercel server.
2. Collect the six print ZIP files already delivered in this conversation in **one local folder** (see the exact filenames below). Also put `gater_håp_og_kronede_drømmer.png` in the same folder; it was the single composition not present in the print archives. If needed, retrieve it from this conversation or the separate `Freddy_Bremseth_Art_ekstra_original.zip` alongside this site package.
3. From the art project folder run:

```bash
python3 scripts/upload-private.py --archive-dir "/path/to/your/print-zips" --dry-run
# On your own trusted computer, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables.
# Do not paste service keys into ChatGPT, browser JavaScript, or GitHub.
python3 scripts/upload-private.py --archive-dir "/path/to/your/print-zips"
```

The script validates all 63 sources and **refuses to upload to a public bucket**. `--limit 1` is available for a single test upload. Existing files are skipped rather than overwritten; if you intentionally replace a master, inspect the storage object manually. Master upload can take time according to your network connection. Storage costs and limits depend on your own Supabase account.

**The six exact archives:**

- `Freddy_Bremseth_HELE_SAMLINGEN_del_1_PRINT.zip`
- `Freddy_Bremseth_HELE_SAMLINGEN_del_2_PRINT.zip`
- `Freddy_Bremseth_HELE_SAMLINGEN_del_3_PRINT.zip`
- `Freddy_Bremseth_HELE_SAMLINGEN_del_4_PRINT.zip`
- `Freddy_Bremseth_15_verk_signert_oppskalert.zip`
- `Freddy_Bremseth_10_kunstverk_PRINT_6000x7500.zip`

One artwork has the original PNG as the best currently available file; other masters are signed print editions from these prior packages. Some printed editions have been **upscaled**, not re-rendered from a higher-resolution original. Sample-print the chosen size before promising archival fine-art sharpness. Review title variants and typographic details before activating paid sales.

## Configure Stripe Checkout

Set the following as **server-side environment variables in the ART Vercel project only** (`.env.example` documents all):

| Variable | Example / role |
| --- | --- |
| `SITE_URL` | `https://art.freddybremseth.com` (exact origin) |
| `STRIPE_SECRET_KEY` | Your Stripe restricted/server secret key with Checkout permissions |
| `SUPABASE_URL` | API URL for the project containing the private bucket |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side storage access only. Never public. |
| `ART_STORAGE_BUCKET` | `art-originals` |
| `DIGITAL_SALES_ENABLED` | `false` first; `true` only after setup, legal review and **all 63 masters** are present |
| `STRIPE_AUTOMATIC_TAX` | Optional `true` only after your Stripe Tax configuration is complete |

Pay attention to merchant details, contact information, VAT and EU consumer requirements **before enabling paid sales**; the legal pages are practical starter copy, not an assertion that your individual business is compliant. Stripe is a payment processor: this project does not create or configure a Stripe merchant account. Do not set a payment link for a non-existent product. Configure Stripe's merchant/receipt email settings for receipts.

**Workflow**: Customer selects artwork → accepts immediate-delivery/license terms → POST `/api/create-checkout` checks private file and starts a new €50 Stripe Checkout → Stripe returns to the chosen artwork page with its session ID → GET `/api/confirm-download` checks the **actual paid** Stripe session and matching artwork and amount → issues a **300-second signed download URL** to the corresponding private image. An unsuccessful Stripe session receives no file. Keep the Stripe return URL private; it can be revisited by the buyer. For guaranteed delivery independent of checkout return or an expired return link, implement a customer email receipt with a secure recovery flow before scaling paid sales; a mail provider is not configured in this build.

## Print-on-demand integration

Edit `assets/print-links.json` when you have your partner's **real direct URL for each artwork**:

```json
{
  "defaultPrintUrl":"",
  "byArtworkId":{
    "kintsugi-kyss-i-gull-og-marmor":"https://your-real-print-store.example/your-artwork-product"
  }
}
```

The public print button becomes visible **only** for works with configured valid web links. Leave `defaultPrintUrl` empty unless one global storefront page genuinely offers all artwork. Buying a physical print is a separate transaction via your print provider; digital checkout is always €50 and does not charge for a print.

## Content management and image quality

- `assets/catalog.json`: titles, categories, short interpretive descriptions, order, preview dimensions, per-art print URL, public preview path. You can adjust these without changing prices or download authorization.
- `scripts/private-masters-manifest.json`: protected correspondence between image ID, private filename and source print ZIP. A sale cannot change its requested master via the browser.
- `assets/art/*.webp`: publicly visible small previews only. The manifest was generated from the images available in this conversation; artwork files from other chats/library folders not currently mounted must be added later.
- To update the collection **from the same source set** in a working folder: `ART_SOURCE_DIR=/path/to/all-original-images python3 scripts/build-gallery.py && npm run build`. On other machines, do not run this unless all source files are present; it rebuilds the manifest.
- Original-resolution pixel sizes differ. Existing high-resolution print files in the archives are often upscaled. Never claim they were captured or hand-painted at their reported pixel dimensions.

## Testing and security checklist

Run `npm test` and `npm run build`. In Vercel verify `/api/status` reports `sales_enabled:false` before the storage and Stripe configuration. Use Stripe **test mode** with an isolated test Supabase bucket, verify a successful paid session allows only its matching artwork and that an unpaid, edited-price or unrelated session does not. Verify missing-file behavior before flipping `DIGITAL_SALES_ENABLED=true`. Check mobile navigation, thumbnails, privacy pages, sitemap, signature visibility, image typography and print link correctness.

**Not completed by this bundle:** a live Vercel project, DNS settings, a connected Stripe merchant account and credentials, uploaded private originals in your storage, an email-based purchase recovery flow, and a print-on-demand provider link. None of those have been claimed as live.

## Curated browsing by visual style (19 September 2026)

The 100 entries are **curated into 11 visual styles**, rather than grouped by subject matter: Renaissance & Baroque; Impressionism & Post-Impressionism; Art Nouveau; Cubism & Geometric Art; Abstract & Minimalist; Expressionism; Street Art & Pop; Surrealism & Dreamscapes; Symbolic Realism; Contemporary Conceptual; Atmospheric Landscapes. These are editorial descriptions of the visual approach, not assertions that the digitally created works were painted using historical materials. Counts and short descriptions live in `assets/styles.json`; every artwork stores its stable `style_id`, display `category`, and `style_description` in `assets/catalog.json`.

On the homepage, **By artistic style** is the default: every style has its own heading, description, four-artwork preview (or fewer for small groups) and a button to view the complete style. Style chips show exact counts. Searching retains the style groups and shows all matching results. Selecting Title A–Z or Z–A switches to a flat alphabetical list; selecting a style switches back to its curated order. Individual artwork URLs, payment price and private-file mappings were not changed. Style assignment is explicit in `scripts/curate-styles.py` and validated in `npm test` and `npm run build`. When new works are imported, the curator will fail on any uncategorized new ID rather than silently filing it in an incorrect style.

## Gallery deduplication

The public catalog has 63 distinct compositions. 37 overlapping variants, lower-quality previews or duplicate editions were removed from the catalog and public artwork pages. The retained artwork slugs are stable. The removal list is recorded in `assets/duplicate-exclusions.json`. Only the 63 retained masters are eligible for new sales. If a removed artwork was previously sold, handle that purchase separately rather than deleting a customer's private master.

## Curated gallery refresh and five further repeat exclusions

The editorial homepage displays Marmorbyste med gullsprekker og sommerfugl as the main image rather than repeating the adjacent The Human Condition cover. Five additional newly imported preview-only artwork titles repeat established catalogue images and are excluded before publication: Impresjonistisk hagefest ved innsjøen; Romantisk solnedgang på verandaen; Stormlys over det gamle fjordlandskapet; Modig bykvinne i graffitiunivers; Renessansebibliotek med lærde og solnedgang. Their five original counterparts, existing URLs and digital purchase mappings remain intact. The public gallery contains 63 established and 50 unique imported works: **113** in total.


## Artwork files and descriptions in `/admin/` (September 2026)

The admin accepts a JPEG, PNG, WebP or ZIP of these files (at most 50 MB per image, 250 MB per ZIP, 30 artworks per batch). For an existing artwork, choose **Attach or replace an existing artwork's source files**, then select the exact artwork in the review list. Uploading creates a reduced public WebP preview in `art-previews` and registers the full uploaded image privately in `art-originals` with `art_gallery_masters` metadata. A registration does not prove the private file has been audited or is fit for large prints. The catalogue now displays the private-master registration state and lets administrators edit each work's description without re-uploading an image.

This upload workflow **does not activate digital sales**: records remain `digital_available=false`, and a separate server-side check of the correct private master, product licence, Stripe checkout and signed delivery is required before enabling purchases. Physical prints are a separate product; no local-only filesystem should be the sole source of original art. Keep an independent backed-up copy and deliver a properly prepared print source to a verified print partner. `assets/print-links.json` remains empty until actual print-product URLs, dimensions, material and pricing are confirmed. TIFF/PDF files and files over 50 MB cannot currently be uploaded by the gallery admin. A file's 300 DPI metadata is not proof of native print detail.

Editorial copy: retain the five existing signature collections and Studio Archive rather than replacing them wholesale with the illustrative collections in the proposed copy pack. Use its healing / joy / transformation / urban motifs as inspiration for accurate, image-specific stories. Do not represent digitally created texture as actual impasto or gold leaf, or describe items as signed physical originals, numbered limited editions, framed, archival, shipping worldwide or bestsellers until those facts have been independently established.


## Missing original-file audit and safe master-only upload
The authenticated admin uses `public.art_gallery_admin_master_status()` to check the actual object in private `storage.objects` against registered `art_gallery_masters` records. The RPC is granted only to authenticated users and returns rows only if `auth.uid()` belongs to `art_gallery_admin_users`. It reveals only artwork IDs, booleans and basic dimensions; private object paths and download URLs remain inaccessible to public visitors. An unregistered master and a registered-but-missing object are both marked "Needs private file". The protected `art-originals` bucket remains private.

When uploading a private source for an existing artwork, the gallery admin deliberately does **not** replace the existing public preview, metadata, story, category, URL or published status. New artwork creation still generates reduced public previews and records its private master. No upload turns on digital checkout or asserts a print-quality original. The owner must keep a second backup and manually quality-check artwork identity, actual detail and colour at intended physical print dimensions.
