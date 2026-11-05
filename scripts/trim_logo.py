"""Trim the empty margin around src/assets/logo.png and save src/assets/logo-trimmed.png.

Usage (from the project root):  python scripts/trim_logo.py
Trims by transparency when the PNG has an alpha channel, otherwise by the corner colour.
"""
from pathlib import Path
from PIL import Image, ImageChops

SRC = Path("src/assets/logo.png")
OUT = Path("src/assets/logo-trimmed.png")
PAD = 2  # keep a hair of space so glows / anti-aliased edges aren't cut

img = Image.open(SRC).convert("RGBA")
alpha = img.getchannel("A")

if alpha.getextrema()[0] < 255:
    # real transparency: anything with alpha above a small threshold is content
    mask = alpha.point(lambda a: 255 if a > 8 else 0)
    mode = "transparency"
else:
    # opaque image: content = pixels that differ from the top-left corner colour
    bg = Image.new("RGBA", img.size, img.getpixel((0, 0)))
    diff = ImageChops.difference(img, bg).convert("L")
    mask = diff.point(lambda d: 255 if d > 24 else 0)
    mode = "background colour"

bbox = mask.getbbox()
if not bbox:
    raise SystemExit("Nothing to trim: image looks empty")

left, top, right, bottom = bbox
box = (max(0, left - PAD), max(0, top - PAD), min(img.width, right + PAD), min(img.height, bottom + PAD))
trimmed = img.crop(box)
trimmed.save(OUT, optimize=True)
print(f"trimmed by {mode}: {img.size} -> {trimmed.size}  (box {box})  saved {OUT}")
