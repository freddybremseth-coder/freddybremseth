-- Read-only print-original inventory for the live Supabase project.
-- Run with a trusted administrator in Supabase SQL Editor.
-- Never modify storage.objects via SQL; file operations belong to Storage API.
-- A matching storage.objects row verifies metadata presence, not image decoding,
-- file integrity, print sharpness or Prodigi fulfilment.
WITH published AS (
 SELECT id, title_en, pixel_width AS preview_width, pixel_height AS preview_height
 FROM public.art_gallery_works WHERE published = true
),
asset_matches AS (
 SELECT p.id, p.title_en, p.preview_width, p.preview_height,
        a.asset_role, a.bucket_name, a.pixel_width AS master_width,
        a.pixel_height AS master_height, a.verified_at,
        (o.id IS NOT NULL) AS object_present,
        ROW_NUMBER() OVER (
          PARTITION BY p.id ORDER BY
            (o.id IS NOT NULL) DESC,
            CASE a.asset_role WHEN 'print' THEN 3 WHEN 'master' THEN 2 WHEN 'digital' THEN 1 ELSE 0 END DESC,
            (COALESCE(a.pixel_width,0)::bigint * COALESCE(a.pixel_height,0)::bigint) DESC
        ) AS rank
 FROM published p
 LEFT JOIN public.art_gallery_assets a ON a.artwork_id=p.id
   AND a.asset_role IN ('print','master','digital')
   AND a.bucket_name='art-originals'
 LEFT JOIN storage.objects o ON o.bucket_id=a.bucket_name AND o.name=a.object_path
),
inventory AS (
 SELECT id,title_en,preview_width,preview_height,asset_role,master_width,master_height,verified_at,object_present,
 CASE
   WHEN asset_role IS NULL THEN 'no_original_record'
   WHEN NOT object_present THEN 'record_without_storage_object'
   WHEN COALESCE(master_width,0)<=0 OR COALESCE(master_height,0)<=0 THEN 'missing_master_dimensions'
   ELSE 'file_metadata_present'
 END AS state
 FROM asset_matches WHERE rank=1
)
SELECT state, count(*) AS artworks FROM inventory GROUP BY state ORDER BY state;

-- Run separately for a per-artwork review list; no storage paths are disclosed:
WITH published AS (
 SELECT id,title_en FROM public.art_gallery_works WHERE published=true
),
ranked AS (
 SELECT p.id,p.title_en,a.asset_role,a.pixel_width,a.pixel_height,(o.id IS NOT NULL) AS object_present,
 ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY (o.id IS NOT NULL) DESC,
   CASE a.asset_role WHEN 'print' THEN 3 WHEN 'master' THEN 2 WHEN 'digital' THEN 1 ELSE 0 END DESC) AS rank
 FROM published p
 LEFT JOIN public.art_gallery_assets a ON a.artwork_id=p.id
   AND a.asset_role IN ('print','master','digital') AND a.bucket_name='art-originals'
 LEFT JOIN storage.objects o ON o.bucket_id=a.bucket_name AND o.name=a.object_path
)
SELECT id,title_en,CASE WHEN asset_role IS NULL THEN 'no_original_record'
 WHEN NOT object_present THEN 'record_without_storage_object'
 WHEN COALESCE(pixel_width,0)<=0 OR COALESCE(pixel_height,0)<=0 THEN 'missing_master_dimensions'
 ELSE 'file_metadata_present' END AS state,
 pixel_width,pixel_height
FROM ranked WHERE rank=1
ORDER BY state,title_en;
