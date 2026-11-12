#!/usr/bin/env python3
"""Spawn egg icon (32x32) and pack icons (256x256). Run after gen_gojo_model.py."""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUTLINE = (22, 22, 34, 255)


def egg():
    S = 32
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cx, cy, rx, ry = 15.5, 16.5, 10.5, 14.0

    def inside(x, y):
        # egg: narrower at the top
        k = 1.0 - 0.18 * ((cy - y) / ry)
        return ((x - cx) / (rx * k)) ** 2 + ((y - cy) / ry) ** 2 <= 1.0

    for y in range(S):
        for x in range(S):
            if not inside(x + 0.5, y + 0.5):
                continue
            # light from top-left
            lx = ((x - cx) / rx + (y - cy) / ry) * 0.5
            hair_line = 11 + int(1.5 * math.sin(x * 1.3))  # spiky hair edge
            if 13 <= y <= 16:  # blindfold band
                c = (34, 34, 44) if lx < 0.25 else (20, 20, 28)
            elif y < hair_line:  # white hair
                c = (255, 255, 255) if lx < -0.2 else (232, 230, 246) if lx < 0.25 else (196, 192, 228)
            elif y < 13:
                c = (210, 206, 236)
            else:  # six-eyes blue body
                t = (y - 17) / 12
                base = (120, 214, 255) if lx < -0.1 else (70, 176, 246) if lx < 0.3 else (40, 128, 222)
                c = tuple(int(v * (1 - 0.25 * t)) for v in base)
            img.putpixel((x, y), c + (255,))
    # outline
    px = img.load()
    edge = [(x, y) for y in range(S) for x in range(S) if px[x, y][3] and any(
        not (0 <= x + dx < S and 0 <= y + dy < S) or px[x + dx, y + dy][3] == 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        img.putpixel((x, y), OUTLINE)
    # sparkles (Infinity glints)
    for sx, sy, col in ((21, 7, (190, 245, 255)), (10, 22, (230, 252, 255)), (20, 24, (160, 235, 255))):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            img.putpixel((sx + dx, sy + dy), col + (255,))
        img.putpixel((sx, sy), (255, 255, 255, 255))
    # highlight
    for x, y in ((11, 5), (10, 6), (10, 7)):
        img.putpixel((x, y), (255, 255, 255, 255))
    out = ROOT / "resource_pack/textures/items/gojo_spawn_egg.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)


def pack_icon():
    S = 256
    bg = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(bg)
    for r in range(S, 0, -2):  # radial blue glow
        t = r / S
        col = (int(20 + 40 * (1 - t)), int(24 + 110 * (1 - t)), int(48 + 190 * (1 - t)), 255)
        d.ellipse((S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r), fill=col)
    prev = Image.open(ROOT / "preview/gojo_preview.png").convert("RGBA")
    bust = prev.crop((16, 0, 176, 160))  # head + shoulders of front view
    px = bust.load()  # drop preview background colour
    for y in range(bust.height):
        for x in range(bust.width):
            if px[x, y][:3] == (60, 66, 80):
                px[x, y] = (0, 0, 0, 0)
    bust = bust.resize((240, 240), Image.NEAREST)
    bg.alpha_composite(bust, (8, 16))
    for pk in ("behavior_pack", "resource_pack"):
        bg.save(ROOT / pk / "pack_icon.png")


if __name__ == "__main__":
    egg()
    pack_icon()
