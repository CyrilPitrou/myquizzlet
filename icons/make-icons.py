#!/usr/bin/env python3
"""Regenerate icons/icon-512.png and icons/icon-192.png from the same
geometry as icons/icon.svg, without needing an SVG rasteriser.

The art is a Q drawn as a ring with a tail: a stroked circle plus a
stroked diagonal line, both round-capped, in the Paper theme's ground
and accent colours. This mirrors icon.svg exactly (same colours, same
centre/radius/stroke-width, same tail endpoints) so the two files never
drift apart; icon.svg stays the human-readable source of the design and
this script stays the reproducible way to turn it into pixels.

Run with: python3 icons/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

GROUND = "#faf7f2"
ACCENT = "#b45309"

CANVAS = 512
CENTER = (256, 248)
RADIUS = 118
STROKE_WIDTH = 34
TAIL_START = (300, 300)
TAIL_END = (372, 372)

OUT_DIR = Path(__file__).parent


def draw_icon(size: int) -> Image.Image:
    """Draw the icon at `size`x`size` by rendering at CANVAS resolution
    and downsampling, so the 192 is never separately (and thus
    inconsistently) hand-drawn at a smaller scale."""
    img = Image.new("RGB", (CANVAS, CANVAS), GROUND)
    draw = ImageDraw.Draw(img)

    cx, cy = CENTER
    # PIL's ellipse(outline=..., width=...) draws the stroke entirely
    # *inside* the given bbox, unlike SVG's stroke-width, which is
    # centred on the mathematical circle. To get a centred annulus
    # running from RADIUS - w/2 to RADIUS + w/2 (matching icon.svg),
    # inflate the bbox by half the stroke width on every side.
    half_stroke = STROKE_WIDTH / 2
    bbox = (
        cx - RADIUS - half_stroke,
        cy - RADIUS - half_stroke,
        cx + RADIUS + half_stroke,
        cy + RADIUS + half_stroke,
    )
    draw.ellipse(bbox, outline=ACCENT, width=STROKE_WIDTH)

    # PIL has no round-capped line, so draw the segment and cap each end
    # with a filled circle of radius = half the stroke width, matching
    # SVG's stroke-linecap="round".
    draw.line([TAIL_START, TAIL_END], fill=ACCENT, width=STROKE_WIDTH)
    cap_radius = STROKE_WIDTH / 2
    for x, y in (TAIL_START, TAIL_END):
        draw.ellipse(
            (x - cap_radius, y - cap_radius, x + cap_radius, y + cap_radius),
            fill=ACCENT,
        )

    if size != CANVAS:
        img = img.resize((size, size), Image.LANCZOS)
    return img


def main() -> None:
    draw_icon(512).save(OUT_DIR / "icon-512.png")
    draw_icon(192).save(OUT_DIR / "icon-192.png")


if __name__ == "__main__":
    main()
