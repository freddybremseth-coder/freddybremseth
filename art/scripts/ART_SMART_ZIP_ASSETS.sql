-- Smart ZIP asset-role registry for art.freddybremseth.com
-- Applied to RealtyflowPRO on 2026-09-25.
-- The existing art_gallery_masters table remains the compatibility source for digital checkout.
-- This table records all routed versions without enabling sales.

create table if not exists public.art_gallery_assets (
  artwork_id text not null references public.art_gallery_works(id) on delete cascade,
  asset_role text not null check (asset_role in ('master','digital','print','portfolio')),
  bucket_name text not null check (bucket_name in ('art-originals','art-previews')),
  object_path text not null,
  original_filename text,
  source_archive text,
  mime_type text,
  file_bytes bigint check (file_bytes is null or file_bytes > 0),
  pixel_width integer check (pixel_width is null or pixel_width > 0),
  pixel_height integer check (pixel_height is null or pixel_height > 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (artwork_id, asset_role),
  unique (object_path),
  constraint art_gallery_assets_role_bucket_check check (
    (asset_role = 'portfolio' and bucket_name = 'art-previews')
    or
    (asset_role <> 'portfolio' and bucket_name = 'art-originals')
  )
);

alter table public.art_gallery_assets enable row level security;

grant select, insert, update on public.art_gallery_assets to authenticated;
revoke all on public.art_gallery_assets from anon;

create policy "Art admins read asset metadata"
on public.art_gallery_assets
for select
to authenticated
using (
  exists (
    select 1 from public.art_gallery_admin_users au
    where au.user_id = (select auth.uid())
  )
);

create policy "Art admins insert unverified assets"
on public.art_gallery_assets
for insert
to authenticated
with check (
  verified_at is null
  and exists (
    select 1 from public.art_gallery_admin_users au
    where au.user_id = (select auth.uid())
  )
);

create policy "Art admins update unverified assets"
on public.art_gallery_assets
for update
to authenticated
using (
  verified_at is null
  and exists (
    select 1 from public.art_gallery_admin_users au
    where au.user_id = (select auth.uid())
  )
)
with check (
  verified_at is null
  and exists (
    select 1 from public.art_gallery_admin_users au
    where au.user_id = (select auth.uid())
  )
);

insert into public.art_gallery_assets (
  artwork_id, asset_role, bucket_name, object_path, source_archive,
  file_bytes, pixel_width, pixel_height, verified_at, created_at, updated_at
)
select
  artwork_id, 'master', bucket_name, object_path, source_archive,
  file_bytes, pixel_width, pixel_height, verified_at, created_at, now()
from public.art_gallery_masters
on conflict (artwork_id, asset_role) do nothing;

insert into public.art_gallery_assets (
  artwork_id, asset_role, bucket_name, object_path,
  pixel_width, pixel_height, created_at, updated_at
)
select
  id, 'portfolio', 'art-previews', public_preview_path,
  pixel_width, pixel_height, created_at, now()
from public.art_gallery_works
where public_preview_path is not null
on conflict (artwork_id, asset_role) do nothing;
