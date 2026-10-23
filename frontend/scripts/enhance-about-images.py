"""
Repairs the Who We Are photographs.

The firm's originals are small (375-396px on the long edge for three of the
four) and flat. Displayed in a 640px frame the browser upscales them with a
bilinear filter and no sharpening, which is what makes them look faded.

This cannot invent detail that was never captured, but it can do markedly
better than the browser: an autocontrast pass to recover the washed-out
blacks, a small saturation lift, a Lanczos upsample, and an unsharp mask to
put the edge definition back. Saved at high quality so the browser then has
nothing left to do but paint it.
"""
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pathlib import Path

SRC = Path('/home/claude/neoteric-v2/frontend/public/images/about')
OUT = SRC

# Chosen by subject, in the order the four paragraphs run:
#   1 who we are            → Lady Justice in a library
#   2 alternative model     → gavel, scales and a signed agreement
#   3 advisory & technology → the team working together
#   4 close to the client   → a lawyer and a client across a desk
PLAN = [
    ('img3.jpg', 'about-1.jpg', 1.0),   # already 736x1104; no upsample needed
    ('img2.jpg', 'about-2.jpg', 2.0),
    ('img4.jpg', 'about-3.jpg', 2.4),
    ('img7.jpg', 'about-4.jpg', 2.4),
]

for src, dst, scale in PLAN:
    im = Image.open(SRC / src).convert('RGB')
    before = im.size

    # Recover contrast lost to a flat scan, clipping a little off each end.
    im = ImageOps.autocontrast(im, cutoff=(0.4, 0.2), preserve_tone=True)

    # These read as grey; a modest lift, not a filter.
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.04)

    if scale > 1.0:
        im = im.resize(
            (round(im.width * scale), round(im.height * scale)),
            Image.LANCZOS,
        )
        # Put back the edge definition the upsample softens.
        im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=105, threshold=3))
    else:
        im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=55, threshold=3))

    im.save(OUT / dst, 'JPEG', quality=92, optimize=True, progressive=True)
    kb = (OUT / dst).stat().st_size // 1024
    print(f'{src:10} -> {dst:14} {before[0]}x{before[1]} -> {im.size[0]}x{im.size[1]}  {kb}KB')
