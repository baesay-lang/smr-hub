#!/usr/bin/env python3
# Generates og-image.png (1200x630) + apple-touch-icon.png (180x180) for SMR HUB.
# Branded to match styles.css: cobalt #2563eb accent, cool-slate neutrals, Malgun (KR+Latin).
import math
from PIL import Image, ImageDraw, ImageFont

ACCENT = (37, 99, 235)      # #2563eb
ACCENT_D = (29, 78, 216)    # #1d4ed8
TEXT = (26, 34, 48)         # #1a2230
DIM = (90, 100, 115)        # #5a6473
FAINT = (139, 147, 162)     # #8b93a2
BG = (255, 255, 255)

FONT = "C:/Windows/Fonts/malgunbd.ttf"   # Malgun Gothic Bold (covers Latin + Hangul)
FONT_R = "C:/Windows/Fonts/malgun.ttf"   # Malgun regular


def f(size, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_R, size)


def atom(size, stroke, color, ringw):
    """Return an RGBA image of an atom motif (3 orbits + nucleus)."""
    S = size * 3  # supersample
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx = cy = S / 2
    rx, ry = S * 0.40, S * 0.165
    for ang in (0, 60, 120):
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.ellipse([cx - rx, cy - ry, cx + rx, cy + ry],
                   outline=color, width=ringw * 3)
        layer = layer.rotate(ang, center=(cx, cy), resample=Image.BICUBIC)
        im.alpha_composite(layer)
    d = ImageDraw.Draw(im)
    nr = S * 0.085
    d.ellipse([cx - nr, cy - nr, cx + nr, cy + nr], fill=color)
    return im.resize((size, size), Image.LANCZOS)


def make_og():
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # top identity bar
    d.rectangle([0, 0, W, 10], fill=ACCENT)

    # faint large atom on the right
    a = atom(560, None, (37, 99, 235, 28), 5)
    img.paste(a, (W - 470, H // 2 - 280), a)
    # crisp accent atom
    a2 = atom(300, None, ACCENT + (255,), 6)
    img.paste(a2, (W - 360, H // 2 - 150), a2)

    # kicker
    d.text((92, 132), "S M A L L   M O D U L A R   R E A C T O R", font=f(22), fill=ACCENT)

    # wordmark: "SMR " (dark) + "HUB" (cobalt)
    wf = f(140)
    x = 88
    y = 168
    d.text((x, y), "SMR ", font=wf, fill=TEXT)
    w = d.textlength("SMR ", font=wf)
    d.text((x + w, y), "HUB", font=wf, fill=ACCENT)

    # taglines
    d.text((92, 352), "개발사 · 인허가 트랙 · 노형 · CFR 규정",
           font=f(31, bold=False), fill=DIM)
    d.text((92, 398), "사업 구조 · 한국 기업 · SMR 뉴스 자동 수집",
           font=f(31, bold=False), fill=DIM)

    # divider + url
    d.line([94, 500, 540, 500], fill=(229, 232, 238), width=2)
    d.text((92, 524), "baesay-lang.github.io/smr-hub", font=f(26), fill=FAINT)

    img.save("og-image.png", optimize=True)
    print("wrote og-image.png", img.size)


def make_icon():
    S = 180
    img = Image.new("RGB", (S, S), ACCENT)
    # rounded look via mask
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=38, fill=255)
    out = Image.new("RGB", (S, S), (255, 255, 255))
    a = atom(150, None, (255, 255, 255, 255), 7)
    img.paste(a, ((S - 150) // 2, (S - 150) // 2), a)
    out.paste(img, (0, 0), mask)
    out.save("apple-touch-icon.png")
    print("wrote apple-touch-icon.png", out.size)


if __name__ == "__main__":
    make_og()
    make_icon()
