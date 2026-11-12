#!/usr/bin/env python3
"""Toji Fushiguro: 2.5D geometry + texture + preview (+ weapon sheet)."""
from PIL import Image

from modelkit import ROOT, SIDES, build, clear, faces, fill, pack, put, seed, shade

# ---------- palette (light -> dark) ----------
P = {
    "skin": [(238, 196, 166), (226, 180, 150), (206, 160, 130), (182, 138, 112)],
    "hair": [(66, 66, 76), (46, 46, 54), (30, 30, 36), (16, 16, 20)],
    "shirt": [(56, 56, 66), (38, 38, 46), (26, 26, 32), (16, 16, 20)],
    "worm": [(168, 104, 206), (132, 72, 176), (98, 48, 138), (66, 28, 96)],
    "pants": [(252, 252, 252), (236, 236, 240), (214, 214, 222), (186, 186, 198)],
    "belt": [(44, 44, 50), (30, 30, 36), (20, 20, 24), (12, 12, 14)],
    "shoe": [(52, 52, 58), (36, 36, 42), (24, 24, 28), (14, 14, 18)],
    "sole": [(236, 236, 236), (214, 214, 218)],
    "eye": [(92, 110, 98), (60, 76, 66), (34, 44, 38), (20, 24, 22)],
    "steel": [(236, 242, 246), (206, 214, 222), (166, 176, 188), (124, 134, 148)],
    "cloud": [(196, 56, 56), (156, 38, 44), (116, 26, 32), (82, 16, 22)],
    "gold": [(232, 196, 96), (196, 156, 64), (150, 114, 40)],
    "wrap": [(60, 54, 80), (44, 40, 60), (30, 26, 42)],
    "gun": [(70, 70, 78), (50, 50, 56), (34, 34, 40), (22, 22, 26)],
}
SCAR = (246, 214, 204)
MOUTH = (176, 120, 108)

BONES = [
    ("root", None, [0, 0, 0]),
    ("waist", "root", [0, 12, 0]),
    ("body", "waist", [0, 24, 0]),
    ("head", "body", [0, 24, 0]),
    ("hair", "head", [0, 24, 0]),
    ("eyes", "head", [0, 24, 0]),
    ("belt", "body", [0, 12, 0]),
    ("worm", "body", [0, 18, 0]),
    ("rightArm", "body", [-5, 22, 0]),
    ("leftArm", "body", [5, 22, 0]),
    ("katana", "rightArm", [-6, 12, 0]),
    ("playfulCloud", "rightArm", [-6, 12, 0]),
    ("spear", "rightArm", [-6, 12, 0]),
    ("chain", "rightArm", [-6, 12, 0]),
    ("pistol", "rightArm", [-6, 12, 0]),
    ("rightLeg", "root", [-1.9, 12, 0]),
    ("leftLeg", "root", [1.9, 12, 0]),
]


def rot(bone, origin, size, inflate, style, r):
    ox, oy, oz = origin
    w, h, d = size
    return (bone, origin, size, inflate, style,
            {"rotation": r, "pivot": [ox + w / 2, oy + h / 2, oz + d / 2]})


# worm diagonal: right shoulder (-4,23) -> left waist (4,13), front and back
WORM = []
for cx, cy in ((-3, 21.75), (-1, 19.25), (1, 16.75), (3, 14.25)):
    for z in (-3.3, 2.3):
        WORM.append(rot("worm", [cx - 2, cy - 1.5, z], [4, 3, 1], 0.12, "worm", [0, 0, -51]))
WORM += [
    ("worm", [-4.5, 23.6, -2.6], [3, 1, 5], 0.12, "worm", {}),       # over right shoulder
    ("worm", [4.1, 12.2, -2.6], [1, 3, 5], 0.12, "worm", {}),        # around left hip
    rot("worm", [-5, 23, -4.6], [3, 3, 3], 0.15, "worm_head", [0, 20, 0]),  # head with mouth
]

CUBES = [
    # base
    ("head", [-4, 24, -4], [8, 8, 8], 0, "head", {}),
    ("body", [-4, 12, -2], [8, 12, 4], 0, "shirt_base", {}),
    ("rightArm", [-8, 12, -2], [4, 12, 4], 0, "arm_base", {}),
    ("leftArm", [4, 12, -2], [4, 12, 4], 0, "arm_base", {}),
    ("rightLeg", [-3.9, 0, -2], [4, 12, 4], 0, "pants_base", {}),
    ("leftLeg", [-0.1, 0, -2], [4, 12, 4], 0, "pants_base", {}),
    # layers
    ("head", [-4, 24, -4], [8, 8, 8], 0.5, "hair_shell", {}),
    ("body", [-4, 12, -2], [8, 12, 4], 0.15, "shirt_layer", {}),
    ("rightArm", [-8, 12, -2], [4, 12, 4], 0.2, "sleeve", {}),
    ("leftArm", [4, 12, -2], [4, 12, 4], 0.2, "sleeve", {}),
    ("rightLeg", [-3.9, 4, -2], [4, 8, 4], 0.45, "pants_layer", {}),
    ("leftLeg", [-0.1, 4, -2], [4, 8, 4], 0.45, "pants_layer", {}),
    ("rightLeg", [-3.9, 2, -2], [4, 2, 4], 0.6, "cuff", {}),
    ("leftLeg", [-0.1, 2, -2], [4, 2, 4], 0.6, "cuff", {}),
    ("rightLeg", [-3.9, 0, -3], [4, 2, 5], 0.3, "shoe", {}),
    ("leftLeg", [-0.1, 0, -3], [4, 2, 5], 0.3, "shoe", {}),
    # belt: wrap + knot + tails
    ("belt", [-4, 12, -2], [8, 2, 4], 0.55, "belt", {}),
    ("belt", [0.5, 12, -3], [2, 2, 1], 0.25, "belt", {}),
    rot("belt", [0.6, 8.5, -3.2], [1, 4, 1], 0.1, "belt", [-6, 0, -10]),
    rot("belt", [1.8, 9, -3.2], [1, 3, 1], 0.1, "belt", [-6, 0, -18]),
    # eyes
    ("eyes", [-3, 27, -4], [2, 1, 0], 0.02, "eye", {}),
    ("eyes", [1, 27, -4], [2, 1, 0], 0.02, "eye", {}),
    # hair: messy, falls forward
    ("hair", [-4.5, 29, -4.8], [9, 3, 1], 0.05, "bangs", {}),
    rot("hair", [-2.5, 26.5, -4.9], [2, 3, 1], 0.05, "strand", [0, 0, 12]),
    rot("hair", [0.8, 27, -4.9], [2, 3, 1], 0.05, "strand", [0, 0, -15]),
    rot("hair", [-5, 26, -3], [1, 5, 5], 0.1, "strand", [0, 0, 6]),
    rot("hair", [4, 26, -3], [1, 5, 5], 0.1, "strand", [0, 0, -6]),
    rot("hair", [-3.5, 31.6, -3.5], [3, 2, 4], 0.1, "strand", [-12, 0, 14]),
    rot("hair", [0.5, 31.6, -2.5], [3, 2, 4], 0.1, "strand", [10, 0, -12]),
    rot("hair", [-4, 25, 3.8], [8, 4, 2], 0.1, "strand", [10, 0, 0]),
    *WORM,
    # weapons (rightArm children; hand ~ (-6, 12.5, 0))
    ("katana", [-6.5, 11.5, -4], [1, 1, 6], 0.05, "wrap", {}),
    ("katana", [-7.5, 10.5, -5], [3, 3, 1], 0.05, "gold", {}),
    ("katana", [-6.5, 11, -21], [1, 2, 16], 0.0, "blade", {}),
    ("playfulCloud", [-6.5, 11.5, -10], [1, 1, 8], 0.1, "cloud", {}),
    ("playfulCloud", [-6.5, 11.5, -1], [1, 1, 8], 0.1, "cloud", {}),
    rot("playfulCloud", [-6.5, 5, 7.5], [1, 1, 8], 0.1, "cloud", [60, 0, 0]),
    ("spear", [-6.5, 11.5, -3], [1, 1, 6], 0.05, "wrap", {}),
    ("spear", [-6.5, 11, -13], [1, 2, 10], 0.0, "blade", {}),
    ("spear", [-6.5, 13, -15], [1, 1, 3], 0.0, "blade", {}),
    ("spear", [-6.5, 10, -15], [1, 1, 3], 0.0, "blade", {}),
    ("chain", [-6.5, 11, 3], [1, 2, 2], 0.05, "steel_link", {}),
    ("chain", [-7, 11.5, 4.5], [2, 1, 2], 0.05, "steel_link", {}),
    ("chain", [-6.5, 11, 6], [1, 2, 2], 0.05, "steel_link", {}),
    ("chain", [-7, 11.5, 7.5], [2, 1, 2], 0.05, "steel_link", {}),
    ("pistol", [-6.5, 9, -1], [1, 4, 2], 0.05, "gun", {}),
    ("pistol", [-6.5, 12, -6], [1, 2, 6], 0.05, "gun", {}),
]
WEAPON_BONES = ("katana", "playfulCloud", "spear", "chain", "pistol")


def paint(img, style, f):
    if style == "head":
        for k, r in f.items():
            fill(img, r, P["skin"], base=0.25, grad=0.25)
        n = f["north"]
        for i in (1, 2, 5, 6):  # heavy brow shadow
            put(img, n, i, 3, shade(P["skin"], 0.95, 0))
        for i, c in ((1, P["eye"][3]), (2, P["eye"][1]), (5, P["eye"][1]), (6, P["eye"][3])):
            put(img, n, i, 4, c)
        put(img, n, 3, 6, MOUTH); put(img, n, 4, 6, MOUTH)
        put(img, n, 2, 5, SCAR); put(img, n, 2, 6, SCAR); put(img, n, 2, 7, SCAR)  # lip scar
        for k in ("east", "west", "south", "top"):
            fill(img, f[k], P["hair"], base=0.4, grad=0.3)
        for i in range(8):
            put(img, n, i, 0, shade(P["hair"], 0.4)); put(img, n, i, 1, shade(P["hair"], 0.6))
    elif style == "hair_shell":
        fill(img, f["top"], P["hair"], base=0.1, grad=0.4, jitter=0.9)
        clear(img, f["bottom"])
        n = f["north"]; clear(img, n)
        for i in range(8):
            put(img, n, i, 0, shade(P["hair"], 0.2))
            if i % 2:
                put(img, n, i, 1, shade(P["hair"], 0.4))
        for k in ("east", "west", "south"):
            r = f[k]; clear(img, r)
            for j in range(8):
                for i in range(8):
                    limit = 8 if k == "south" else 6 + (i % 3 == 0)
                    if j < limit:
                        put(img, r, i, j, shade(P["hair"], 0.1 + j * 0.09, 0.9))
    elif style in ("bangs", "strand"):
        for k, r in f.items():
            fill(img, r, P["hair"], base=0.05 if k == "top" else 0.2, grad=0.5, jitter=1.0)
    elif style == "eye":
        for r in f.values():
            fill(img, r, P["eye"], base=0.3, grad=0.3, jitter=0.3)
    elif style == "shirt_base":
        for r in f.values():
            fill(img, r, P["shirt"], base=0.3, grad=0.4)
    elif style == "shirt_layer":
        clear(img, f["bottom"])
        for k, r in f.items():
            if k != "bottom":
                fill(img, r, P["shirt"], base=0.15, grad=0.4, jitter=0.7)
        n = f["north"]
        for i in (1, 2, 5, 6):  # chest line under tight shirt
            put(img, n, i, 4, shade(P["shirt"], 0.9, 0))
        for j in (6, 8, 10):  # abs
            put(img, n, 3, j, shade(P["shirt"], 0.9, 0)); put(img, n, 4, j, shade(P["shirt"], 0.9, 0))
    elif style == "arm_base":
        for k, r in f.items():
            if k == "bottom":
                fill(img, r, P["skin"], base=0.4, grad=0.2); continue
            if k == "top":
                fill(img, r, P["shirt"], base=0.3, grad=0.2); continue
            x0, y0, w, h = r
            for j in range(h):
                pal = P["shirt"] if j < 3 else P["skin"]
                for i in range(w):
                    t = 0.15 + 0.5 * j / h + (0.25 if j in (6, 7) and i in (1, 2) else 0)  # muscle
                    img.putpixel((x0 + i, y0 + j), shade(pal, t))
    elif style == "sleeve":
        clear(img, f["bottom"])
        fill(img, f["top"], P["shirt"], base=0.1, grad=0.2)
        for k in SIDES:
            r = f[k]; clear(img, r)
            x0, y0, w, h = r
            for j in range(4):
                for i in range(w):
                    if j < 3 or i % 2:
                        img.putpixel((x0 + i, y0 + j), shade(P["shirt"], 0.1 + j * 0.15))
    elif style == "pants_base":
        for r in f.values():
            fill(img, r, P["pants"], base=0.3, grad=0.4)
    elif style == "pants_layer":
        clear(img, f["bottom"])
        fill(img, f["top"], P["pants"], base=0.1, grad=0.2)
        for k in SIDES:
            fill(img, f[k], P["pants"], base=0.0, grad=0.7, jitter=0.8)
            r = f[k]
            for j in range(1, 8, 2):  # baggy folds
                put(img, r, (j + 1) % 4, j, shade(P["pants"], 0.95, 0))
    elif style == "cuff":
        clear(img, f["bottom"])
        fill(img, f["top"], P["pants"], base=0.1, grad=0.2)
        for k in SIDES:
            fill(img, f[k], P["pants"], base=0.2, grad=0.6, jitter=0.7)
    elif style == "shoe":
        for k, r in f.items():
            if k == "bottom":
                fill(img, r, P["sole"], base=0.5, grad=0.0, jitter=0.2); continue
            fill(img, r, P["shoe"], base=0.1, grad=0.4)
            if k in SIDES:
                x0, y0, w, h = r
                for i in range(w):
                    img.putpixel((x0 + i, y0 + h - 1), shade(P["sole"], 0.2, 0.2))
    elif style == "belt":
        for r in f.values():
            fill(img, r, P["belt"], base=0.2, grad=0.5, jitter=0.7)
    elif style in ("worm", "worm_head"):
        for k, r in f.items():
            fill(img, r, P["worm"], base=0.1, grad=0.6, jitter=0.7)
            x0, y0, w, h = r
            for i in range(0, w, 2):  # segment rings
                for j in range(h):
                    put(img, r, i, j, shade(P["worm"], 0.9, 0.2))
        if style == "worm_head":
            n = f["north"]
            for i in range(3):
                put(img, n, i, 1, (40, 10, 30))  # mouth slit
            put(img, n, 0, 0, (255, 236, 120)); put(img, n, 2, 0, (255, 236, 120))  # eyes
    elif style == "wrap":
        for r in f.values():
            fill(img, r, P["wrap"], base=0.1, grad=0.5, jitter=0.9)
            x0, y0, w, h = r
            for i in range(0, w, 2):
                put(img, r, i, 0, shade(P["gold"], 0.5, 0))
    elif style == "gold":
        for r in f.values():
            fill(img, r, P["gold"], base=0.1, grad=0.5)
    elif style == "blade":
        for r in f.values():
            fill(img, r, P["steel"], base=0.0, grad=0.6, jitter=0.4)
    elif style == "cloud":
        for r in f.values():
            fill(img, r, P["cloud"], base=0.1, grad=0.6)
            x0, y0, w, h = r
            if w >= 6:
                put(img, r, 0, 0, shade(P["gold"], 0.2, 0)); put(img, r, w - 1, 0, shade(P["gold"], 0.2, 0))
    elif style == "steel_link":
        for r in f.values():
            fill(img, r, P["steel"], base=0.3, grad=0.5)
    elif style == "gun":
        for r in f.values():
            fill(img, r, P["gun"], base=0.1, grad=0.5)
    else:
        raise ValueError(style)


def weapon_sheet(tex):
    """Side (east) view of every weapon bone, stacked, for review."""
    img = Image.open(ROOT / "resource_pack/textures/entity/toji.png").convert("RGBA")
    uvs = pack(CUBES, tex)
    rows = []
    for wb in WEAPON_BONES:
        canvas = Image.new("RGBA", (36, 16), (60, 66, 80, 255))
        for c, uv in zip(CUBES, uvs):
            if c[0] != wb:
                continue
            x, y, w, h = faces(uv, c[2])["east"]
            if w and h:
                part = img.crop((x, y, x + w, y + h))
                canvas.alpha_composite(part, (int(c[1][2] + 24), int(16 - (c[1][1] - 4) - c[2][1])))
        rows.append(canvas.resize((36 * 8, 16 * 8), Image.NEAREST))
    sheet = Image.new("RGBA", (36 * 8, 16 * 8 * len(rows)), (40, 44, 56, 255))
    for i, r in enumerate(rows):
        sheet.alpha_composite(r, (0, i * 16 * 8))
    sheet.save(ROOT / "preview/toji_weapons.png")


if __name__ == "__main__":
    seed(946)
    body = [c for c in CUBES if c[0] not in WEAPON_BONES or c[0] == "katana"]
    build("toji", BONES, CUBES, paint, tex=128, preview_cubes=body, locators={
        "rightArm": {"hand_r": [-6, 11, -1]},
        "root": {"feet": [0, 0.2, 0]},
        "body": {"center": [0, 18, 0], "slash": [0, 18, -10]},
    })
    weapon_sheet(128)
