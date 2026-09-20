# Freddy Bremseth Art: verified Supabase storage migration

2026-09-20: The existing active RealtyflowPRO Supabase project \`ereapsfcsqtdmzosgnnn\` has isolated buckets:

- \`art-previews\` (public) contains 246 public \`view.webp\` / \`thumb.webp\` files for all 123 approved gallery works.
- \`art-originals\` (private) is intentionally empty until approved sale-ready originals are uploaded and verified.
- \`public.art_gallery_works\` contains 123 staged English-title artwork records, including ten 2026 Kintsugi entries in Symbolic Realism / The Human Condition.
- \`public.art_gallery_masters\` has 73 expected paths (63 established, ten Kintsugi). A row is NOT proof of a file: only \`verified_at IS NOT NULL\` plus Storage object verification qualifies.

The live site currently serves its pre-existing local public preview paths; the Supabase copies are staged. Do not remove local images from GitHub or switch all gallery pages to new URLs until the site data adapter, access policies, SEO pages, and fallback paths are tested.

## Privately upload the ten Kintsugi files and/or the 63 established prints

On your own trusted computer, from this repository's \`art/\` directory, download the relevant original archives from your own ChatGPT file Library. Keep those ZIPs outside this PUBLIC repository.

\`\`\`bash
# Check archive filenames and entries first without credentials:
python3 scripts/upload-gallery-masters.py \
  --kintsugi-zip "/private/path/Freddy_Bremseth_Kintsugi_Collection_10_Retina.zip" \
  --scope kintsugi --dry-run

# Set SUPABASE_URL=https://ereapsfcsqtdmzosgnnn.supabase.co
# Set SUPABASE_SERVICE_ROLE_KEY locally in your shell / local secret manager.
# Never commit keys or paste them into ChatGPT, GitHub, screenshots, or browser code.
python3 scripts/upload-gallery-masters.py \
  --kintsugi-zip "/private/path/Freddy_Bremseth_Kintsugi_Collection_10_Retina.zip" \
  --scope kintsugi

# 63 established works require all six PRINT ZIPs and any separately
# inventoried original PNGs in --extras-dir:
python3 scripts/upload-gallery-masters.py \
  --archive-dir "/private/path/your-print-zips" \
  --extras-dir "/private/path/extra-originals" \
  --scope established --dry-run
python3 scripts/upload-gallery-masters.py \
  --archive-dir "/private/path/your-print-zips" \
  --extras-dir "/private/path/extra-originals" \
  --scope established
\`\`\`

The script verifies that \`art-originals\` is private, refuses mismatched pre-existing files, compares SHA-256 of uploaded vs local bytes, and marks the \`art_gallery_masters\` row verified only after successful storage verification. It NEVER changes \`digital_available\`, switches on Stripe, alters prices, or publishes masters as public assets.

The ten Kintsugi 2x JPG editions are upscaled from smaller source artwork; do not market them as natively rendered at 2x resolution or promise a specific large print quality without print proofs.

## Remaining product work

1. Review the archive source and exact master mapping for the other 50 recent preview-only pieces; do not infer paid stock simply because a similarly titled ZIP exists.
2. Implement an authenticated admin upload/review workflow before allowing live browser uploads. Restrict the service-role credential to backend/local trusted use; never send it to the gallery frontend.
3. Add a server-side catalogue adapter with safe fallback to current static data and verified preview URLs before switching production images to Supabase.
4. Check merchant information, tax, Stripe test payments, delivery/recovery emails, licence, and verified per-art master availability. Only then enable sale for individually approved works.

The one-time preview migration function \`art-preview-migrate-once\` was disabled and the database migration token revoked after all 246 preview files were verified.
