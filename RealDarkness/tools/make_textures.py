"""Generate Real Darkness textures (pixel art). Run: python3 tools/make_textures.py"""
import math
from PIL import Image

ROOT = __file__.rsplit("/tools/", 1)[0]

def clamp(v):
    return max(0, min(255, int(v)))

def noise(x, y, seed):
    # deterministic value noise (no external deps)
    def h(ix, iy):
        n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
        n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
        return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * sx
    b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * sx
    return a + (b - a) * sy

def fbm(x, y, seed, octaves=4):
    v, amp, f = 0.0, 0.5, 1.0
    for i in range(octaves):
        v += amp * noise(x * f, y * f, seed + i)
        amp *= 0.5; f *= 2
    return v

def sun():
    # 64x64, drawn additively (black = transparent): limb-darkened disc, granulation, corona.
    n = 64
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    c, r = (n - 1) / 2, 13.0
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c)
            if d <= r:
                mu = math.sqrt(max(0.0, 1 - (d / r) ** 2))
                limb = 0.82 + 0.18 * mu  # gentle limb darkening
                g = 0.92 + 0.08 * fbm(x / 3, y / 3, 7)
                k = limb * g
                col = (clamp(255 * min(1, k * 1.08)), clamp(244 * k), clamp(215 * k), 255)
            else:
                t = (d - r) / (c - r)
                ray = 0.75 + 0.25 * noise(math.atan2(y - c, x - c) * 6, 0, 3)
                g = 0.6 * max(0.0, 1 - t) ** 3 * ray
                col = (255, clamp(190 + 40 * g), clamp(95 + 60 * g), clamp(255 * g))
            img.putpixel((x, y), col)
    img.save(f"{ROOT}/RealDarkness_Sky_RP/textures/environment/sun.png")

def moon_surface(u, v):
    # u, v in [-1, 1] on the disc; returns albedo 0..1 (maria dark, highlands bright, craters)
    a = 0.78 + 0.18 * fbm(u * 4 + 10, v * 4 + 10, 11)
    maria = fbm(u * 1.6 + 3, v * 1.6 + 5, 21, 3)
    if maria > 0.55:
        a -= min(0.28, (maria - 0.55) * 1.6)
    for cx, cy, cr in [(-0.35, 0.55, 0.12), (0.3, -0.25, 0.08), (0.55, 0.35, 0.06), (-0.5, -0.4, 0.07), (0.1, 0.7, 0.05)]:
        dd = math.hypot(u - cx, v - cy) / cr
        if dd < 1:
            a -= 0.12 * (1 - dd)
        elif dd < 1.3:
            a += 0.08 * (1.3 - dd) / 0.3  # bright rim
    return max(0.0, min(1.0, a))

def moon():
    # 4x2 grid of 128x128 phases: full, waning gibbous, last quarter, waning crescent,
    # new, waxing crescent, first quarter, waxing gibbous. Sphere-lit terminator.
    n, r = 128, 40.0
    img = Image.new("RGBA", (n * 4, n * 2), (0, 0, 0, 0))
    # angle of the sun direction around the moon (0 = full, pi = new); sign = lit side
    phases = [0.0, -0.25, -0.5, -0.75, 1.0, 0.75, 0.5, 0.25]
    for i, ph in enumerate(phases):
        ox, oy = (i % 4) * n, (i // 4) * n
        ang = ph * math.pi
        lx, lz = math.sin(ang), math.cos(ang)  # light dir in (x, toward-viewer)
        c = (n - 1) / 2
        for y in range(n):
            for x in range(n):
                u, v = (x - c) / r, (y - c) / r
                d2 = u * u + v * v
                edge = r - math.sqrt(d2) * r  # pixels inside the rim
                if edge <= -0.5:
                    continue  # transparent outside the disc (no halo)
                if True:
                    d2 = min(d2, 1.0)
                    z = math.sqrt(1 - d2)
                    lam = u * lx + z * lz
                    # Moon is almost uniformly bright (no limb darkening); soft terminator.
                    lit = max(0.0, min(1.0, (lam + 0.06) / 0.12))
                    lit = lit * lit * (3 - 2 * lit)
                    if lit <= 0.0 or ph == 1.0:  # new moon: nothing visible
                        continue  # unlit side is see-through, like the real sky
                    alb = moon_surface(u, v)
                    b = 0.25 + 0.75 * alb
                    a = clamp(255 * min(1.0, edge + 0.5) * lit)
                    col = (clamp(250 * b), clamp(247 * b), clamp(238 * b), a)
                img.putpixel((ox + x, oy + y), col)
    img.save(f"{ROOT}/RealDarkness_Sky_RP/textures/environment/moon_phases.png")

def settings_icon():
    # 32x32 gear: iron body, darker inner ring, bevel light from top-left, coal-glow hub.
    n = 32
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    c = (n - 1) / 2
    teeth, r_out, r_in, r_hole = 8, 14.5, 11.0, 4.0
    for y in range(n):
        for x in range(n):
            dx, dy = x - c, y - c
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            tooth = (math.cos(a * teeth) > 0.25)
            edge = r_out if tooth else r_in
            if d > edge or d < r_hole - 0.5:
                if d < r_hole - 0.5:  # glowing hub
                    g = 1 - d / r_hole
                    img.putpixel((x, y), (255, clamp(140 + 110 * g), clamp(30 + 90 * g), 255))
                continue
            shade = 0.5 - 0.5 * ((dx + dy) / (d + 1e-6)) * 0.6  # light from top-left
            base = 205 + 40 * (0.5 - shade)
            if edge - d < 1.2 or d - r_hole < 1.2:
                base -= 70  # outline
            elif 6.5 < d < 8.0:
                base -= 35  # inner ring groove
            g = clamp(base)
            img.putpixel((x, y), (g, g, clamp(g + 8), 255))
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
