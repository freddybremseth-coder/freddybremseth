#!/usr/bin/env python3
"""Read-only perceptual review of all published Freddy Art gallery thumbnails.

This report deliberately DOES NOT auto-hide, delete, or merge artwork.
Each candidate needs visual confirmation before an editor groups variants.
"""
import concurrent.futures
import hashlib
import io
import itertools
import json
import math
import re
from pathlib import Path
from urllib.parse import quote
import urllib.request

import imagehash
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "audit-output"
OUTPUT.mkdir(exist_ok=True)
config = (ROOT / "assets/js/gallery-config.js").read_text(encoding="utf8")
url = re.search(r'url:"(https://[^"]+)"', config).group(1)
anon = re.search(r'anonKey:"([^"]+)"', config).group(1)
api = url + "/rest/v1/art_gallery_works?select=" + quote(
    "id,title_en,collection_id,source,public_thumb_path,legacy_thumb_url"
) + "&published=eq.true&limit=1000"
request = urllib.request.Request(api, headers={"apikey": anon, "User-Agent": "Freddy-Art-Visual-Audit/1.0"})
with urllib.request.urlopen(request, timeout=45) as response:
    rows = json.load(response)

def retrieve(row):
    path = row.get("public_thumb_path")
    if path:
        link = url + "/storage/v1/object/public/art-previews/" + quote(path, safe="/")
    else:
        fallback = row.get("legacy_thumb_url")
        if not fallback or not fallback.startswith("/assets/art/"):
            return row, None, "Missing public thumbnail"
        link = "https://art.freddybremseth.com" + fallback
    req = urllib.request.Request(link, headers={"User-Agent": "Freddy-Art-Visual-Audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            data = response.read()
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        color = np.asarray(image.resize((48, 48)), dtype=np.float32) / 255.0
        return row, {
            "image": image, "phash": imagehash.phash(image, hash_size=8),
            "dhash": imagehash.dhash(image, hash_size=8),
            "color": color, "bytes_sha256": hashlib.sha256(data).hexdigest(),
        }, None
    except Exception as ex:
        return row, None, type(ex).__name__ + ": " + str(ex)[:160]

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    responses = list(executor.map(retrieve, rows))
good = {row["id"]: (row, img) for row, img, error in responses if img}
errors = [{"id": row["id"], "error": error} for row, img, error in responses if error]
pairs = []
for (aid, (ar, a)), (bid, (br, b)) in itertools.combinations(good.items(), 2):
    exact = a["bytes_sha256"] == b["bytes_sha256"]
    phash = a["phash"] - b["phash"]
    dhash = a["dhash"] - b["dhash"]
    color_distance = float(np.mean(np.abs(a["color"] - b["color"])))
    # Wide candidates get human review; not an automatic verdict.
    if exact or (phash <= 12 and dhash <= 17 and color_distance < 0.24):
        pairs.append({
            "a": aid, "b": bid, "title_a": ar["title_en"], "title_b": br["title_en"],
            "collection_a": ar["collection_id"], "collection_b": br["collection_id"],
            "phash_distance": phash, "dhash_distance": dhash,
            "mean_rgb_delta": round(color_distance, 4),
            "exact_public_file": exact,
        })
pairs.sort(key=lambda p: (not p["exact_public_file"], p["phash_distance"] * 2 +
                           p["dhash_distance"] + p["mean_rgb_delta"] * 100))
report = {
    "published_rows": len(rows), "thumbnails_reviewed": len(good),
    "thumbnails_unavailable": errors, "candidates": pairs,
    "note": "Perceptual matches are possible duplicates, not proof. Separate compositions must remain independent."
}
(OUTPUT / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf8")
print("PUBLISHED", len(rows), "ANALYZED", len(good), "UNAVAILABLE", len(errors), "CANDIDATE_PAIRS", len(pairs))
for row in pairs[:75]:
    print("PAIR", json.dumps(row, ensure_ascii=False))
for row in errors[:25]:
    print("UNAVAILABLE", json.dumps(row, ensure_ascii=False))
# Contact sheets for visual human review of highest-scoring pairs, not automatic grouping.
font = ImageFont.load_default()
for offset in range(0, min(len(pairs), 80), 20):
    chosen = pairs[offset:offset + 20]
    sheet = Image.new("RGB", (1000, len(chosen) * 210), "white")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(chosen):
        for col, ident in enumerate((row["a"], row["b"])):
            y = i * 210
            image = good[ident][1]["image"].copy()
            image.thumbnail((210, 172), Image.Resampling.LANCZOS)
            x = col * 500 + 10
            sheet.paste(image, (x, y + 23))
            draw.text((x, y + 4), (ident[:52]), font=font, fill="black")
        draw.text((10, i * 210 + 195),
                  "p=%d d=%d rgb=%.3f" % (row["phash_distance"], row["dhash_distance"], row["mean_rgb_delta"]),
                  font=font, fill="black")
    sheet.save(OUTPUT / ("review_%02d.jpg" % (offset // 20 + 1)), quality=86)
