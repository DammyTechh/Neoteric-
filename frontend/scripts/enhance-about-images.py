"""
Builds the Who We Are photographs.

The section shows four landscape frames at 5:4. The firm's original `about/`
folder is mostly 375-396px on the long edge, which the browser then has to
blow up past twice its native size — that is what made images 2, 3 and 4 look
soft and washed out beside image 1.

So the sources here are the highest-resolution assets the firm actually owns,
chosen so the picture argues the paragraph beside it:

  1  the law                 Lady Justice in a library        736 x 1104
  2  the practice            an advocate in robes            1256 x 1174
  3  modern working          a city interchange at night     1800 x 1200
  4  commercial goals        a container port at sunrise     1280 x  800

Only one portrait is used, and it is a robed advocate rather than a head-shot,
so the section reads as the firm describing itself rather than a second copy
of Our Team further down the page.

Each is cropped to 5:4 here rather than by `object-cover` in the browser, so
the framing is deliberate: portraits are cropped from the upper third to keep
the head, everything else from the centre. The output is 1200x960 — larger
than the 640px column ever renders, so the picture stays sharp on a retina
screen and the browser never has to enlarge anything.

Run from the frontend directory:

    python3 scripts/enhance-about-images.py
"""
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'images'
OUT = ROOT / 'about'

TARGET = (1200, 960)          # 5:4, comfortably above the rendered size
ASPECT = TARGET[0] / TARGET[1]

# (source, output, vertical focal point as a fraction of the height)
#   0.5 centres the crop; lower values keep more of the top, which is what a
#   portrait needs so the subject's head is not cut off.
PLAN = [
    ('about/img3.jpg',                  'about-1.jpg', 0.45),
    ('team/Ese.jpg',                    'about-2.jpg', 0.32),
    ('industries/infrastructure2.jpg',  'about-3.jpg', 0.50),
    ('industries/trade2.jpeg',          'about-4.jpg', 0.50),
]

for src, dst, focus in PLAN:
    im = Image.open(ROOT / src).convert('RGB')
    before = im.size

    # ── Crop to 5:4 around the focal point ──────────────────────────────
    width, height = im.size
    if width / height > ASPECT:
        # Too wide: trim the sides, keeping the centre.
        new_width = round(height * ASPECT)
        left = (width - new_width) // 2
        im = im.crop((left, 0, left + new_width, height))
    else:
        # Too tall: trim top and bottom around the focal point.
        new_height = round(width / ASPECT)
        top = round((height - new_height) * focus)
        top = max(0, min(top, height - new_height))
        im = im.crop((0, top, width, top + new_height))

    # ── Resize to the delivery size ─────────────────────────────────────
    im = im.resize(TARGET, Image.LANCZOS)

    # ── Tone ────────────────────────────────────────────────────────────
    # A light touch: these are photographs, not a filter exercise.
    im = ImageOps.autocontrast(im, cutoff=(0.4, 0.2), preserve_tone=True)
    im = ImageEnhance.Color(im).enhance(1.06)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=3))

    im.save(OUT / dst, 'JPEG', quality=90, optimize=True, progressive=True)
    kb = (OUT / dst).stat().st_size // 1024
    print(f'{src:34} -> {dst}  {before[0]}x{before[1]} -> {TARGET[0]}x{TARGET[1]}  {kb}KB')
