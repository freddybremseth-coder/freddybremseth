# Freddy Bremseth Art — 55 new gallery previews (four ZIP parts)

This directory is intentionally empty until the four public-preview ZIPs are uploaded:
- `gallery_web_part_1_of_4.zip`
- `gallery_web_part_2_of_4.zip`
- `gallery_web_part_3_of_4.zip`
- `gallery_web_part_4_of_4.zip`

They contain **only 110 low-resolution public WebP previews** (two for each of 55 new distinct images) and a checksum-verified manifest. The original PNG and enlarged print files are NOT in GitHub or the public website. Do not put any source originals or private purchased downloads here.

The gallery build automatically waits until all four archives exist. When all are present, `npm run build` validates names, formats, lengths, unique IDs and SHA-255 checksums, imports public previews, adds the 55 entries to the existing 63-entry catalogue, regenerates curated style and collection filters, artwork detail pages and the sitemap, and publishes the generated gallery through Vercel.

The new images initially display as **gallery previews only**, without any digital or physical purchase CTA. Adding private approved masters to secure storage, a verified download mapping and an explicit inventory/sale enablement change is a separate step. Existing 63 digital download mappings remain untouched.

If the gallery build reports `ART_IMPORT_WAITING_FOR_PACKS`, do not claim the new artworks are live.

The ZIP files are intentionally small enough for individual upload through GitHub's web interface. Keep the exact filenames and place them in this exact directory.

## Duplicate and title correction (20 September 2026)

Use only the corrected ZIP bundle containing 55 works. The older 56-work ZIP included 'Barokk studie med musikk og måneskinn', visually identical to the existing 'Barokk studie med musiker og vanitas stilleben'. The existing work is retained; the second version and its two public previews are excluded. Norwegian artwork titles use initial capitalization only, apart from proper names, and the corrected ZIP manifest is the source of truth for new title metadata. The gallery importer explicitly rejects the outdated package.
