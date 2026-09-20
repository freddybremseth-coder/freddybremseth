# Freddy Bremseth Art — 50 unique new gallery previews (four ZIP parts)

The four public-preview ZIPs have been uploaded to GitHub:
- `gallery_web_part_1_of_4.zip`
- `gallery_web_part_2_of_4.zip`
- `gallery_web_part_3_of_4.zip`
- `gallery_web_part_4_of_4.zip`

The uploaded source ZIPs contain 56 candidates; the build discards six duplicate compositions and publishes **100 low-resolution public WebP previews** (two for each of 50 distinct new images) and a checksum-verified manifest. The original PNG and enlarged print files are NOT in GitHub or the public website. Do not put any source originals or private purchased downloads here.

The gallery build automatically waits until all four archives exist. When all are present, `npm run build` validates names, formats, lengths, unique IDs and SHA-256 checksums, imports public previews, adds the 50 unique entries to the existing 63-entry catalogue, regenerates curated style and collection filters, artwork detail pages and the sitemap, and publishes the generated gallery through Vercel.

The new images initially display as **gallery previews only**, without any digital or physical purchase CTA. Adding private approved masters to secure storage, a verified download mapping and an explicit inventory/sale enablement change is a separate step. Existing 63 digital download mappings remain untouched.

Check that the build reports `ART_IMPORT_ADDED 50 TOTAL 113` before claiming the new artworks are live.

Keep the exact four filenames. No one should publish print-quality sources in this directory.

## Duplicate and title correction (20 September 2026)

The importer accepts the four already uploaded source ZIPs; a separate corrected bundle is optional. The original 56-work ZIP included 'Barokk studie med musikk og måneskinn', visually identical to the existing 'Barokk studie med musiker og vanitas stilleben'. The existing work is retained. The importer now safely excludes the redundant image and both previews from the already-uploaded source ZIPs, and normalizes imported titles to sentence-style capitalization (except proper names). The optional corrected 55-work ZIP bundle contains the same approved images without the redundant source. Five more renamed duplicates are excluded during the same validated import. Both original and previously corrected source ZIPs publish precisely 50 unique additional works. No replacement ZIP upload is necessary.

## Further duplicate review

The original collection retains these canonical works: Impresjonistisk hagefest ved elven; Melankolsk solnedgang ved havet; Vandreren ved det stormfulle fjordlandskapet; Modig dronning i fargerik gatekunst; Renessansestudie med symbolske skatter. Their renamed source variants are discarded along with both WebP previews before the public build. The homepage hero uses a different work from the immediately adjacent featured collection cover.
