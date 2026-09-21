# Curated artwork variations · art.freddybremseth.com

Artworks remain independent database records with independent public preview paths, protected original files, and their original detail URLs. The new table `public.art_gallery_variants` stores only the chosen **variant → main artwork** association. Grouping never deletes or overwrites artwork files and does not turn on digital sales.

## Current curated groups

The initial, deliberately limited visual review grouped these four pairs:

| Main artwork (shown in grid) | Variation (available inside artwork detail) |
| --- | --- |
| `en-katedral-for-utbrente-drmmer` | `katedralen-av-uendelige-drmmer` |
| `kart-over-minner-og-ruiner` | `kartografi-over-minner-og-ruiner` |
| `forgylt-glasshjerte-med-blomster` | `knust-glasshjerte-med-gyldne-blomster` |
| `kubistisk-kafe-med-drmmende-utsikt` | `kubistisk-kafescene-med-gitar-og-stilleben` |

The archived alternative names for the Garden Party, veranda sunset and graffiti queen were previously removed from the live catalog. Their original source archives remain available separately, but those unlisted legacy entries were **not** recreated just to group them. Other artworks, especially recently uploaded variants whose full-image composition has not been inspected, remain separate until the artist links them explicitly.

## Artist-controlled management

Open `/admin/` and use **Group as variant** on any work in the existing catalogue. Both works need to be in the same collection. The editor shows two preview thumbnails and lets the artist choose the main work, change the association or **Show separately** without deleting anything. On ZIP or single-image upload, choose an optional **This artwork is a variation of** after choosing its collection and style. The main-artwork selection always takes precedence over any similarity heuristic; there is no AI automatic grouping.

The public homepage and collection listing fetch this curated relationship from Supabase. Only the main work occupies a gallery card, marked with a variant count; each alternative can be selected in the artwork detail pane. The currently selected artwork ID remains specific to that version, so any future sale/delivery workflow must still verify the exact private master before enabling paid downloads.

Public detail URLs for pre-existing variations are retained, and all original files remain in Supabase/GitHub archives. Unlinking a variation restores its separate gallery card.
