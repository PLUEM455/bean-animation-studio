#!/usr/bin/env python3
"""Generate Gojo's 2.5D geometry, texture and a preview image.

Single source of truth: every cube is declared once here with a paint style,
so UV layout and texture can never drift apart.

Outputs (relative to jjk-addon/):
  resource_pack/models/entity/gojo.geo.json
  resource_pack/textures/entity/gojo.png
  preview/gojo_preview.png   (not shipped; for review)
"""
from modelkit import CLEAR, build, clear, fill, put, shade

# ---------- palette (light -> dark) ----------
P = {
    "skin": [(246, 210, 186), (236, 194, 168), (218, 172, 146), (196, 150, 126)],
    "hair": [(252, 252, 255), (238, 238, 248), (214, 212, 236), (186, 182, 220)],
    "shirt": [(58, 58, 70), (40, 40, 50), (28, 28, 36), (18, 18, 24)],
    "pants": [(214, 214, 220), (192, 192, 200), (168, 168, 178), (140, 140, 152)],
    "belt": [(66, 82, 132), (48, 62, 108), (34, 46, 84), (24, 32, 62)],
    "shoe": [(52, 52, 58), (36, 36, 42), (24, 24, 28), (14, 14, 18)],
    "sole": [(245, 245, 245), (225, 225, 228)],
    "iris": [(200, 245, 255), (110, 215, 255), (60, 170, 245), (30, 120, 220)],
    "lash": [(250, 250, 255)],  # Gojo has white lashes
    "mouth": [(200, 140, 125)],
}

# ---------- cube declarations ----------
# (bone, origin, size, inflate, style, extra)  extra may hold rotation/pivot
# Box-UV region per cube: width 2*(w+d), height h+d.
BONES = [
    # name, parent, pivot
    ("root", None, [0, 0, 0]),
    ("waist", "root", [0, 12, 0]),
    ("body", "waist", [0, 24, 0]),
    ("head", "body", [0, 24, 0]),
    ("hair", "head", [0, 24, 0]),
    ("eyes", "head", [0, 24, 0]),
    ("belt", "body", [0, 12, 0]),
    ("rightArm", "body", [-5, 22, 0]),
    ("leftArm", "body", [5, 22, 0]),
    ("rightLeg", "root", [-1.9, 12, 0]),
    ("leftLeg", "root", [1.9, 12, 0]),
]

def spike(origin, size, rot, inflate=0.1):
    ox, oy, oz = origin
    w, h, d = size
    pivot = [ox + w / 2, oy, oz + d / 2]
    return ("hair", origin, size, inflate, "spike", {"rotation": rot, "pivot": pivot})

CUBES = [
    # --- base body (first cube of each bone = opaque base) ---
    ("head", [-4, 24, -4], [8, 8, 8], 0, "head", {}),
    ("body", [-4, 12, -2], [8, 12, 4], 0, "shirt_base", {}),
    ("rightArm", [-8, 12, -2], [4, 12, 4], 0, "arm_base", {}),
    ("leftArm", [4, 12, -2], [4, 12, 4], 0, "arm_base", {}),
    ("rightLeg", [-3.9, 0, -2], [4, 12, 4], 0, "pants_base", {}),
    ("leftLeg", [-0.1, 0, -2], [4, 12, 4], 0, "pants_base", {}),
    # --- 2.5D layers ---
    ("head", [-4, 24, -4], [8, 8, 8], 0.5, "hair_shell", {}),
    ("body", [-4, 12, -2], [8, 12, 4], 0.3, "shirt_layer", {}),
    ("body", [-4, 23, -2], [8, 1, 4], 0.45, "collar", {}),
    ("rightArm", [-8, 12, -2], [4, 12, 4], 0.3, "sleeve", {}),
    ("leftArm", [4, 12, -2], [4, 12, 4], 0.3, "sleeve", {}),
    ("rightLeg", [-3.9, 2, -2], [4, 10, 4], 0.25, "pants_layer", {}),
    ("leftLeg", [-0.1, 2, -2], [4, 10, 4], 0.25, "pants_layer", {}),
    ("rightLeg", [-3.9, 2, -2], [4, 3, 4], 0.5, "cuff", {}),
    ("leftLeg", [-0.1, 2, -2], [4, 3, 4], 0.5, "cuff", {}),
    ("rightLeg", [-3.9, 0, -3], [4, 2, 5], 0.3, "shoe", {}),
    ("leftLeg", [-0.1, 0, -3], [4, 2, 5], 0.3, "shoe", {}),
    # --- belt: wrap + knot + two hanging tails ---
    ("belt", [-4, 12, -2], [8, 2, 4], 0.55, "belt", {}),
    ("belt", [-1, 12, -3], [2, 2, 1], 0.25, "belt", {}),
    ("belt", [-1.5, 9, -3.2], [1, 3, 1], 0.1, "belt", {"rotation": [-8, 0, 12], "pivot": [-1, 12, -2.7]}),
    ("belt", [0.5, 9.5, -3.2], [1, 3, 1], 0.1, "belt", {"rotation": [-8, 0, -12], "pivot": [1, 12, -2.7]}),
    # --- eyes (separate bone so step 4 can make them glow) ---
    ("eyes", [-3, 27, -4], [2, 1, 0], 0.02, "eye", {}),
    ("eyes", [1, 27, -4], [2, 1, 0], 0.02, "eye", {}),
    # --- hair: bangs + spikes pointing up and out ---
    ("hair", [-4.5, 29, -4.8], [9, 3, 1], 0.05, "bangs", {}),
    ("hair", [-3.5, 28, -4.8], [2, 1, 1], 0.05, "spike", {}),
    ("hair", [1.5, 28, -4.8], [2, 1, 1], 0.05, "spike", {}),
    spike([-1.5, 31.5, -4.2], [3, 4, 3], [-22, 0, 0]),
    spike([-1.5, 31.5, -0.5], [3, 4, 3], [16, 0, 0]),
    spike([-4.6, 31, -2.5], [3, 4, 3], [0, 0, 26]),
    spike([1.6, 31, -2.5], [3, 4, 3], [0, 0, -26]),
    spike([-4.2, 30.5, 1.2], [3, 3, 3], [22, 0, 20]),
    spike([1.2, 30.5, 1.2], [3, 3, 3], [22, 0, -20]),
    spike([-5.2, 27.5, -2.5], [2, 4, 4], [0, 0, 16]),
    spike([3.2, 27.5, -2.5], [2, 4, 4], [0, 0, -16]),
    spike([-2, 26, 3.6], [4, 5, 2], [12, 0, 0]),
]

def paint(img, style, f):
    sides = ("north", "south", "east", "west")
    if style == "head":
        for k, r in f.items():
            fill(img, r, P["skin"], base=0.15 if k == "top" else 0.25, grad=0.25)
        n = f["north"]
        for i in (1, 2, 5, 6):  # white lashes above eyes
            put(img, n, i, 3, P["lash"][0])
        for i, c in ((1, P["iris"][1]), (2, P["iris"][2]), (5, P["iris"][2]), (6, P["iris"][1])):
            put(img, n, i, 4, c)
        put(img, n, 3, 6, P["mouth"][0]); put(img, n, 4, 6, P["mouth"][0])
        for k in ("east", "west", "south", "top"):  # under-hair skin is hair coloured
            fill(img, f[k], P["hair"], base=0.4, grad=0.3)
        for i in range(8):
            put(img, n, i, 0, shade(P["hair"], 0.3)); put(img, n, i, 1, shade(P["hair"], 0.5))
    elif style == "hair_shell":
        fill(img, f["top"], P["hair"], base=0.0, grad=0.3)
        clear(img, f["bottom"])
        n = f["north"]; clear(img, n)
        for i in range(8):
            put(img, n, i, 0, shade(P["hair"], 0.1))
            if i % 3 != 1:
                put(img, n, i, 1, shade(P["hair"], 0.3))
        for k in ("east", "west"):
            r = f[k]; clear(img, r)
            for j in range(8):
                for i in range(8):
                    edge = 5 + (1 if i % 2 == 0 else 0)  # jagged lower edge
                    if j < edge:
                        put(img, r, i, j, shade(P["hair"], 0.1 + j * 0.08))
        r = f["south"]; clear(img, r)
        for j in range(8):
            for i in range(8):
                if j < 7 or i % 2 == 0:
                    put(img, r, i, j, shade(P["hair"], 0.1 + j * 0.08))
    elif style in ("spike", "bangs"):
        for k, r in f.items():
            fill(img, r, P["hair"], base=0.0 if k == "top" else 0.15, grad=0.45, jitter=0.9)
    elif style == "eye":
        for k, r in f.items():
            fill(img, r, P["iris"], base=0.2, grad=0.2, jitter=0.3)
    elif style == "shirt_base":
        for r in f.values():
            fill(img, r, P["shirt"], base=0.3, grad=0.4)
    elif style == "shirt_layer":
        for k, r in f.items():
            if k == "bottom":
                clear(img, r); continue
            fill(img, r, P["shirt"], base=0.1, grad=0.5, jitter=0.8)
        for r in (f["north"], f["south"]):  # fabric folds
            for j in range(3, 11):
                put(img, r, 2 + (j // 4), j, shade(P["shirt"], 0.85, 0))
                put(img, r, 5 - (j // 5), j, shade(P["shirt"], 0.85, 0))
    elif style == "collar":
        for r in f.values():
            fill(img, r, P["shirt"], base=0.0, grad=0.2)
    elif style == "arm_base":
        for k, r in f.items():
            if k == "bottom":
                fill(img, r, P["skin"], base=0.4, grad=0.2); continue
            if k == "top":
                fill(img, r, P["shirt"], base=0.3, grad=0.2); continue
            x0, y0, w, h = r
            for j in range(h):
                pal = P["shirt"] if j < 4 else P["skin"]
                for i in range(w):
                    img.putpixel((x0 + i, y0 + j), shade(pal, 0.2 + 0.4 * j / h))
    elif style == "sleeve":
        clear(img, f["bottom"])
        fill(img, f["top"], P["shirt"], base=0.1, grad=0.2)
        for k in sides:
            r = f[k]; clear(img, r)
            x0, y0, w, h = r
            for j in range(5):
                for i in range(w):
                    if j < 4 or i % 2 == 0:
                        img.putpixel((x0 + i, y0 + j), shade(P["shirt"], 0.1 + j * 0.15))
    elif style == "pants_base":
        for r in f.values():
            fill(img, r, P["pants"], base=0.3, grad=0.4)
    elif style == "pants_layer":
        clear(img, f["top"]); clear(img, f["bottom"])
        for k in sides:
            fill(img, f[k], P["pants"], base=0.1, grad=0.6, jitter=0.8)
            r = f[k]
            for j in range(2, 10, 3):  # creases
                put(img, r, (j // 3) % 4, j, shade(P["pants"], 0.9, 0))
    elif style == "cuff":
        clear(img, f["bottom"])
        fill(img, f["top"], P["pants"], base=0.0, grad=0.2)
        for k in sides:
            fill(img, f[k], P["pants"], base=0.05, grad=0.7, jitter=0.7)
    elif style == "shoe":
        for k, r in f.items():
            if k == "bottom":
                fill(img, r, P["sole"], base=0.5, grad=0.0, jitter=0.2); continue
            fill(img, r, P["shoe"], base=0.1, grad=0.4)
            if k in sides:
                x0, y0, w, h = r
                for i in range(w):
                    img.putpixel((x0 + i, y0 + h - 1), shade(P["sole"], 0.2, 0.2))
    elif style == "belt":
        for k, r in f.items():
            fill(img, r, P["belt"], base=0.2, grad=0.5, jitter=0.7)
    else:
        raise ValueError(style)


if __name__ == "__main__":
    build("gojo", BONES, CUBES, paint)
