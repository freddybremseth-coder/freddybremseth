# Freddy Bremseth Art — 55 new gallery previews (four ZIP parts)

The four public-preview ZIPs have been uploaded to GitHub:
- `gallery_web_part_1_of_4.zip`
- `gallery_web_part_2_of_4.zip`
- `gallery_web_part_3_of_4.zip`
- `gallery_web_part_4_of_4.zip`

They contain **only 110 low-resolution public WebP previews** (two for each of 55 new distinct images) and a checksum-verified manifest. The original PNG and enlarged print files are NOT in GitHub or the public website. Do not put any source originals or private purchased downloads here.

The gallery build automatically waits until all four archives exist. When all are present, `npm run build` validates names, formats, lengths, unique IDs and SHA-255 checksums, imports public previews, adds the 55 entries to the existing 63-entry catalogue, regenerates curated style and collection filters, artwork detail pages and the sitemap, and publishes the generated gallery through Vercel.

The new images initially display as **gallery previews only**, without any digital or physical purchase CTA. Adding private approved masters to secure storage, a verified download mapping and an explicit inventory/sale enablement change is a separate step. Existing 63 digital download mappings remain untouched.

Check that the build reports `ART_IMPORT_ADDED 55 TOTAL 118` before claiming the new artworks are live.

Keep the exact four filenames. No one should publish print-quality sources in this directory.

## Duplicate and title correction (20 September 2026)

Use only the corrected ZIP bundle containing 55 works. The original 56-work ZIP included 'Barokk studie med musikk og måneskinn', visually identical to the existing 'Barokk studie med musiker og vanitas stilleben'. The existing work is retained. The importer now safely excludes the redundant image and both previews from the already-uploaded source ZIPs, and normalizes imported titles to sentence-style capitalization (except proper names). The optional corrected 55-work ZIP bundle contains the same approved images without the redundant source. Either archive format publishes precisely 55 additional works; no new ZIP upload is necessary for this correction.
