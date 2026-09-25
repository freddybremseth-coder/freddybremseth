# Freddy Bremseth Art admin — one-time access setup

The page at https://art.freddybremseth.com/admin/ uses Supabase Auth and a strict per-user allowlist in the existing RealtyflowPRO Supabase project (ereapsfcsqtdmzosgnnn). A public signup alone cannot upload, edit, or publish any artwork.

1. In Supabase Authentication → URL Configuration add https://art.freddybremseth.com/admin/ to the permitted Redirect URLs. Confirm email authentication is enabled.
2. Sign in on /admin/ using your own Supabase Auth account or request a sign-in link. If there is no account for you, create or invite your own account under Supabase Authentication → Users.
3. On first sign-in you may see Administrator approval required and a UUID. As project owner, verify that exact UUID in Authentication → Users belongs to your own account; never approve a UUID received from an unverified person.
4. In Supabase SQL Editor, insert the verified UUID into public.art_gallery_admin_users using this exact template, replacing the placeholder:

    INSERT INTO public.art_gallery_admin_users(user_id) VALUES ('YOUR_VERIFIED_SUPABASE_AUTH_USER_UUID'::uuid) ON CONFLICT (user_id) DO NOTHING;

5. Refresh /admin/ and authenticate again. The page then displays upload, ZIP review, existing catalogue editing and manual category controls.

Upload workflow: select collection and style yourself; drop JPG, PNG, WebP or a ZIP (maximum 250 MB compressed / 30 works and 50 MB per image); review each title and category; press Upload. Smart ZIP recognizes MASTER/ORIGINAL, DIGITAL/RETINA/2X, PRINT/300DPI and WEB/PORTFOLIO/PREVIEW in folder names or filenames. Master, digital and print files go to PRIVATE art-originals. The chosen web source is converted to reduced WebP view/thumb files in public art-previews. The role mapping is recorded in public.art_gallery_assets. New works can be published as previews immediately, but every new work remains NOT available for sale until a separate Stripe, provenance, print-quality and download review.

New admin works appear in the live homepage and their manually selected collection, with their own /artwork/<id>/ page. Existing /verk/ URLs and existing checkout mappings stay unchanged. Public Supabase publishable API keys may be in browser files; NEVER put the Supabase service-role secret in GitHub, chat, a ZIP or a browser.

To revoke access, remove the person's row from public.art_gallery_admin_users. The private upload authorization uses storage RLS and the same allowlist, not a hidden /admin/ URL.


The production schema for Smart ZIP role metadata is recorded in `scripts/ART_SMART_ZIP_ASSETS.sql`. Do not make `art-originals` public and do not expose a service-role key to the admin browser.
