"""Generate the NeotypeLab favicon / app-icon set from the "分件 N" mark.

    python3 scripts/generate-favicons.py

Two drawings of the same mark:
  * G16: redrawn on a 16-unit pixel grid for 16/32/48 px. Every stem edge, the
    1px panel-line gaps and the 2x2 chip land on whole pixels, so tabs stay crisp.
  * G32: the sidebar BrandMark geometry (src/components/app-shell/BrandMark.tsx)
    for 180/192/512 px app icons, where there is room for its finer proportions.

Every icon sits on a full-bleed paper tile. A transparent icon would vanish on
Chrome's dark tab strip and in Google's dark-mode results (no colour-scheme
switching there), which is why there is no transparent variant.
Colours are the sRGB equivalents of tokens.css (paper-2, ink, accent).
Concept and evaluation: docs/logo-concepts.html, docs/favicon-evaluation.html.
"""

from pathlib import Path

from PIL import Image, ImageDraw

PAPER = (0xE2, 0xE8, 0xEE)  # --color-paper-2  oklch(92.8% 0.010 245)
INK = (0x0B, 0x12, 0x19)  # --color-ink      oklch(18% 0.018 245)
ACCENT = (0x00, 0x48, 0x8C)  # --color-accent   oklch(40% 0.135 250)

G16 = {
    "unit": 16,
    "rects": [(2, 3, 5, 9), (2, 10, 5, 13), (9, 3, 12, 7), (9, 8, 12, 13)],
    "diag": [(5, 3), (7, 3), (9, 9), (9, 13), (7, 13), (5, 7)],
    "chip": (13, 11, 15, 13),
    "center": (8.5, 8),
}
G32 = {
    "unit": 32,
    "rects": [(3, 6, 8, 19), (3, 20.5, 8, 26), (19, 6, 24, 14.5), (19, 16, 24, 26)],
    "diag": [(8, 6), (12.2, 6), (19, 20), (19, 26), (14.8, 26), (8, 12)],
    "chip": (25.5, 22.5, 29, 26),
    "center": (16, 16),
    "width": 26,  # content spans x 3..29
}

SS = 16  # supersampling factor; BOX downsampling keeps integer edges crisp
OUT = Path(__file__).resolve().parent.parent / "public"


def draw(geo, size, scale, offset):
    big = size * SS
    im = Image.new("RGB", (big, big), PAPER)
    d = ImageDraw.Draw(im)
    k = scale * SS

    def pt(x, y):
        return (offset[0] * SS + x * k, offset[1] * SS + y * k)

    for x0, y0, x1, y1 in geo["rects"]:
        d.rectangle([pt(x0, y0), (pt(x1, y1)[0] - 1, pt(x1, y1)[1] - 1)], fill=INK)
    d.polygon([pt(x, y) for x, y in geo["diag"]], fill=INK)
    x0, y0, x1, y1 = geo["chip"]
    d.rectangle([pt(x0, y0), (pt(x1, y1)[0] - 1, pt(x1, y1)[1] - 1)], fill=ACCENT)
    return im.resize((size, size), Image.BOX)


def small(size):
    """16/32/48: integer multiples of the 16-unit pixel grid, no offset."""
    return draw(G16, size, size / 16, (0, 0))


def large(size, content_ratio):
    """App icons: G32 mark centred, content width = content_ratio * size."""
    scale = content_ratio * size / G32["width"]
    cx, cy = G32["center"]
    return draw(G32, size, scale, (size / 2 - cx * scale, size / 2 - cy * scale))


def main():
    icons = {16: small(16), 32: small(32), 48: small(48)}
    for px, im in icons.items():
        im.save(OUT / f"icon-{px}x{px}.png", optimize=True)
    icons[48].save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[icons[16], icons[32]],
    )
    large(180, 0.62).save(OUT / "apple-touch-icon.png", optimize=True)
    large(192, 0.62).save(OUT / "icon-192x192.png", optimize=True)
    large(512, 0.62).save(OUT / "icon-512x512.png", optimize=True)
    # Android adaptive icons crop to a circle of 80% diameter; keep the whole
    # mark (including the chip) inside that safe zone.
    large(512, 0.52).save(OUT / "icon-maskable-512x512.png", optimize=True)


if __name__ == "__main__":
    main()
