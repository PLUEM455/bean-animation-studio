"""Generate Real Darkness textures (pixel art). Run: python3 tools/make_textures.py"""
import math
from PIL import Image

ROOT = __file__.rsplit("/tools/", 1)[0]

def clamp(v):
    return max(0, min(255, int(v)))

def sun():
    # Sky textures are drawn additively: black = transparent.
    n = 32
    img = Image.new("RGB", (n, n))
    c = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if d <= 6:  # bright core
                col = (255, 252, 230)
            elif d <= 8:
                col = (255, 236, 160)
            else:  # soft glow
                g = max(0.0, 1 - (d - 8) / 8) ** 2
                col = (clamp(255 * g), clamp(200 * g), clamp(90 * g))
            img.putpixel((x, y), col)
    img.save(f"{ROOT}/RealDarkness_Sky_RP/textures/environment/sun.png")

def moon():
    # 4x2 grid of 32x32 phases: full, waning gibbous, last quarter, waning crescent,
    # new, waxing crescent, first quarter, waxing gibbous.
    n, r = 32, 9
    img = Image.new("RGB", (n * 4, n * 2))
    # shadow offset per phase (fraction of 2r); sign = side of shadow
    offsets = [None, -1.4, -1.0, -0.5, 0.0, 0.5, 1.0, 1.4]
    craters = [(-3, -2, 2.2), (3, 2, 1.8), (1, -4, 1.3), (-2, 4, 1.5)]
    for i, off in enumerate(offsets):
        ox, oy = (i % 4) * n, (i // 4) * n
        c = (n - 1) / 2
        for y in range(n):
            for x in range(n):
                dx, dy = x - c, y - c
                d = math.hypot(dx, dy)
                col = (0, 0, 0)
                if d <= r:
                    lit = True
                    if off is not None:
                        if off == 0.0:
                            lit = False
                        else:
                            sx = -math.copysign(1, off) * abs(off) * r
                            lit = math.hypot(dx - sx, dy) > r
                    if lit:
                        b = 235 - 25 * (d / r)
                        for cx, cy, cr in craters:
                            if math.hypot(dx - cx, dy - cy) <= cr:
                                b -= 45
                        col = (clamp(b * 0.92), clamp(b * 0.95), clamp(b))
                    else:
                        col = (10, 11, 16)  # faint earthshine
                elif d <= r + 4:
                    g = (1 - (d - r) / 4) ** 2 * (0.0 if off == 0.0 else 1.0)
                    col = (clamp(70 * g), clamp(80 * g), clamp(110 * g))
                img.putpixel((ox + x, oy + y), col)
    img.save(f"{ROOT}/RealDarkness_Sky_RP/textures/environment/moon_phases.png")

def settings_icon():
    # 16x16: iron frame with a coal-dark lantern glow in the middle.
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    iron, dark, shade = (216, 216, 216, 255), (40, 40, 46, 255), (150, 150, 158, 255)
    for y in range(2, 14):
        for x in range(2, 14):
            edge = x in (2, 13) or y in (2, 13)
            img.putpixel((x, y), iron if edge else dark)
    for x in range(3, 13):
        img.putpixel((x, 12), shade)
    for y in range(5, 11):
        for x in range(5, 11):
            d = math.hypot(x - 7.5, y - 7.5)
            if d <= 2.6:
                g = 1 - d / 2.6
                img.putpixel((x, y), (255, clamp(150 + 100 * g), clamp(40 + 80 * g), 255))
    img.save(f"{ROOT}/RealDarkness_RP/textures/items/realdarkness_settings.png")

def pack_icon(path, moon_icon):
    n = 128
    img = Image.new("RGB", (n, n))
    for y in range(n):
        for x in range(n):
            t = y / n
            img.putpixel((x, y), (clamp(8 + 10 * t), clamp(8 + 12 * t), clamp(20 + 30 * t)))
    c, r = 64, 26
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if moon_icon and d <= r:
                lit = math.hypot(x - c - 14, y - c + 8) > r
                img.putpixel((x, y), (230, 232, 245) if lit else (16, 18, 28))
            elif not moon_icon and d <= 10:
                img.putpixel((x, y), (255, 190, 90))
            elif not moon_icon and d <= 40:
                g = (1 - (d - 10) / 30) ** 2
                p = img.getpixel((x, y))
                img.putpixel((x, y), (clamp(p[0] + 200 * g), clamp(p[1] + 120 * g), clamp(p[2] + 40 * g)))
    img.save(path)

if __name__ == "__main__":
    sun(); moon(); settings_icon()
    pack_icon(f"{ROOT}/RealDarkness_BP/pack_icon.png", False)
    pack_icon(f"{ROOT}/RealDarkness_RP/pack_icon.png", False)
    pack_icon(f"{ROOT}/RealDarkness_Sky_RP/pack_icon.png", True)
    print("textures written")
