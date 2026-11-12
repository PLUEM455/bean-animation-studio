"""Build the Mr. Foleypeep addon.

Generates the block models and HD textures from one cube list (so UVs always match),
converts the sound effects to .ogg, and packages both packs into dist/foleypeep.mcaddon.

Run from anywhere:  python3 addons/ghost-addon/build.py
Needs: Pillow, ffmpeg.
"""
import json
import math
import os
import random
import subprocess
import zipfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(HERE, "behavior_packs", "ghost_bp")
RP = os.path.join(HERE, "resource_packs", "ghost_rp")
SFX_SRC = os.path.join(HERE, "audio", "sfx")
OUT = os.path.join(HERE, "dist", "foleypeep.mcaddon")
S = 4  # image pixels per UV unit (HD texture, 4x Minecraft resolution)

# Source sound effect (audio/sfx/*.mp3) -> name in sounds/foleypeep/
SOUNDS = {
    "01_wind_breath_peek": "peek",
    "02_giggle_vanish": "caught",
    "03_fake_laugh_cut": "fake_laugh",
    "04_attack_scream": "attack",
    "05_fake_thud_scream": "double_fake",
    "06_chase_footsteps": "chase",
    "07_breath_behind": "behind",
    "08_ambient_drone": "ambient",
}
STEREO_SOUNDS = {"ambient"}  # played on the player; everything else is mono so it is positional

# ---- Models: (bone, parent, pivot, [(origin, size, material), ...]) ----------------------
# Mr. Foleypeep: about 2.9 blocks tall (46 px) with hat, separate hat and coat tail bones.
FOLEYPEEP = [
    ("root", None, [0, 0, 0], []),
    ("left_leg", "root", [2, 16, 0], [([0.5, 3, -1.5], [3, 13, 3], "trousers"), ([0, 0, -3.5], [4, 3, 6], "boot")]),
    ("right_leg", "root", [-2, 16, 0], [([-3.5, 3, -1.5], [3, 13, 3], "trousers"), ([-4, 0, -3.5], [4, 3, 6], "boot")]),
    ("body", "root", [0, 16, 0], [([-4.5, 16, -3], [9, 15, 6], "coat")]),
    ("coat_tail", "body", [0, 16, 0], [([-5, 7, -3.5], [10, 9, 7], "coat_skirt")]),
    ("left_arm", "body", [6, 30, 0], [
        ([4.5, 17, -1.5], [3, 13, 3], "sleeve"), ([4, 13, -2], [4, 4, 4], "hand"),
        ([4, 10, -2], [1, 3, 1], "claw"), ([5.5, 10, -2], [1, 3, 1], "claw"), ([7, 10, -2], [1, 3, 1], "claw")]),
    ("right_arm", "body", [-6, 30, 0], [
        ([-7.5, 17, -1.5], [3, 13, 3], "sleeve"), ([-8, 13, -2], [4, 4, 4], "hand"),
        ([-5, 10, -2], [1, 3, 1], "claw"), ([-6.5, 10, -2], [1, 3, 1], "claw"), ([-8, 10, -2], [1, 3, 1], "claw")]),
    ("head", "body", [0, 31, 0], [([-4, 31, -4], [8, 8, 8], "head"), ([-1, 33, -9], [2, 2, 5], "nose")]),
    ("hat", "head", [0, 39, 0], [([-5.5, 39, -5.5], [11, 1, 11], "hat_brim"), ([-4, 40, -4], [8, 6, 8], "hat_crown")]),
]

# Player-like form (same bone names so the shared animations work).
MIMIC = [
    ("root", None, [0, 0, 0], []),
    ("left_leg", "root", [1.9, 12, 0], [([-0.1, 0, -2], [4, 12, 4], "pants")]),
    ("right_leg", "root", [-1.9, 12, 0], [([-3.9, 0, -2], [4, 12, 4], "pants")]),
    ("body", "root", [0, 12, 0], [([-4, 12, -2], [8, 12, 4], "shirt")]),
    ("left_arm", "body", [5, 22, 0], [([4, 12, -2], [4, 12, 4], "m_arm")]),
    ("right_arm", "body", [-5, 22, 0], [([-8, 12, -2], [4, 12, 4], "m_arm")]),
    ("head", "body", [0, 24, 0], [([-4, 24, -4], [8, 8, 8], "m_head")]),
]


# ---- UV layout and geometry ---------------------------------------------------------------
def layout(bones, uv_w):
    """Shelf-pack every cube's box-UV block. Returns cubes (with uv) and texture height."""
    cubes = [{"bone": n, "origin": o, "size": s, "mat": m} for n, _, _, cs in bones for o, s, m in cs]
    x = y = row_h = 0
    for c in sorted(cubes, key=lambda c: -(c["size"][2] + c["size"][1])):
        w, h, d = (math.ceil(v) for v in c["size"])
        bw, bh = 2 * (w + d), d + h
        if x + bw > uv_w:
            x, y, row_h = 0, y + row_h, 0
        c["uv"] = [x, y]
        x += bw
        row_h = max(row_h, bh)
    uv_h = 16
    while uv_h < y + row_h:
        uv_h *= 2
    return cubes, uv_h


def geometry(ident, bones, cubes, uv_w, uv_h, bounds):
    out = []
    for name, parent, pivot, _ in bones:
        b = {"name": name, "pivot": pivot}
        if parent:
            b["parent"] = parent
        cs = [{"origin": c["origin"], "size": c["size"], "uv": c["uv"]} for c in cubes if c["bone"] == name]
        if cs:
            b["cubes"] = cs
        out.append(b)
    desc = {
        "identifier": ident, "texture_width": uv_w, "texture_height": uv_h,
        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
        "visible_bounds_offset": [0, bounds[1] / 2, 0],
    }
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": desc, "bones": out}]}


def faces(c):
    """Box-UV face rectangles (u, v, w, h) in UV units; 'front' is the -Z side the mob faces."""
    u, v = c["uv"]
    w, h, d = (math.ceil(x) for x in c["size"])
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h),
    }


# ---- Painting ---------------------------------------------------------------------------
def clamp(v):
    return max(0, min(255, int(v)))


def noise(px, box, base, var, rng):
    x0, y0, w, h = box
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            j = rng.randint(-var, var)
            px[x, y] = (clamp(base[0] + j), clamp(base[1] + j), clamp(base[2] + j), 255)


def band(px, box, top_px, bottom_px, base, var, rng):
    """Paint a horizontal band covering rows [top_px, h - bottom_px) of a face."""
    x0, y0, w, h = box
    noise(px, (x0, y0 + top_px, w, max(0, h - top_px - bottom_px)), base, var, rng)


SIDES = ("front", "back", "left", "right")


def m_coat(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (44, 38, 33), 9, rng)
    for _ in range(w * h // 60):  # dusty specks
        px[rng.randrange(x0, x0 + w), rng.randrange(y0, y0 + h)] = (80, 68, 56, 255)
    for _ in range(w * h // 400 + 1):  # moth holes
        x, y = rng.randrange(x0, x0 + max(1, w - 3)), rng.randrange(y0, y0 + max(1, h - 3))
        d.rectangle((x, y, x + rng.randint(1, 2), y + rng.randint(1, 2)), fill=(16, 12, 10, 255))
    if face == "front" and h > w:  # vest, lapels and buttons on the torso
        cx0, cx1 = x0 + w * 3 // 10, x0 + w * 7 // 10
        d.rectangle((cx0, y0, cx1, y0 + h - 1), fill=(29, 25, 22, 255))
        d.line((cx0, y0, cx0, y0 + h - 1), fill=(96, 84, 70, 255), width=2)
        d.line((cx1, y0, cx1, y0 + h - 1), fill=(96, 84, 70, 255), width=2)
        mid = (cx0 + cx1) // 2
        for i in range(3):
            by = y0 + h * (3 + i * 2) // 10
            d.ellipse((mid - 2, by - 2, mid + 2, by + 2), fill=(152, 140, 118, 255))


def m_coat_skirt(px, d, rng, face, box):
    x0, y0, w, h = box
    m_coat(px, d, rng, "skirt", box)
    if face == "bottom":  # open at the bottom
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px[x, y] = (0, 0, 0, 0)
    elif face in SIDES:  # torn, ragged hem
        depth = 0
        for x in range(x0, x0 + w):
            depth = max(0, min(h * 4 // 10, depth + rng.randint(-3, 3)))
            for y in range(y0 + h - depth, y0 + h):
                px[x, y] = (0, 0, 0, 0)
        if face == "front":  # coat opening
            d.line((x0 + w // 2, y0, x0 + w // 2, y0 + h - 1), fill=(14, 11, 9, 255), width=2)


def m_trousers(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (36, 31, 28), 8, rng)
    for x in range(x0 + 3, x0 + w, 6):
        d.line((x, y0, x, y0 + h - 1), fill=(29, 25, 22, 255))


def m_boot(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (48, 41, 35) if face == "top" else (27, 23, 20), 6, rng)
    if face == "front":
        d.ellipse((x0 + 2, y0 + 1, x0 + w - 3, y0 + h // 2), fill=(66, 57, 48, 255))


def m_sleeve(px, d, rng, face, box):
    m_coat(px, d, rng, "sleeve", box)
    if face in SIDES:  # pale cuff near the wrist, as in the concept sheet
        x0, y0, w, h = box
        noise(px, (x0, y0 + h - 2 * S, w, 2 * S), (128, 116, 98), 8, rng)


def m_hand(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (214, 204, 184), 10, rng)
    d.rectangle((x0, y0, x0 + w - 1, y0 + h - 1), outline=(150, 140, 124, 255))
    if face == "front":
        for i in range(1, 4):
            x = x0 + w * i // 4
            d.line((x, y0 + h // 2, x, y0 + h - 1), fill=(150, 140, 124, 255))


def m_claw(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (205, 195, 172), 8, rng)
    noise(px, (x0, y0 + h * 6 // 10, w, h - h * 6 // 10), (112, 100, 86), 6, rng)


def draw_face(d, box):
    """Clock eyes and a wide jagged grin, drawn on a 32x32 grid scaled to the face."""
    x0, y0, w, h = box

    def P(x, y):
        return (x0 + x * w / 32, y0 + y * h / 32)

    ink = (40, 32, 28, 255)
    for cx in (9, 23):
        d.ellipse((*P(cx - 8, 3), *P(cx + 8, 20)), fill=(122, 110, 96, 255))  # sunken socket
        d.ellipse((*P(cx - 6.5, 5.5), *P(cx + 6.5, 18.5)), fill=(237, 229, 209, 255), outline=ink, width=2)
        for a in range(0, 360, 30):  # clock ticks
            tx, ty = cx + 5 * math.sin(math.radians(a)), 12 - 5 * math.cos(math.radians(a))
            d.rectangle((*P(tx - 0.3, ty - 0.3), *P(tx + 0.3, ty + 0.3)), fill=ink)
        d.line((*P(cx, 12), *P(cx + 3, 8.5)), fill=(28, 22, 18, 255), width=2)   # hour hand
        d.line((*P(cx, 12), *P(cx - 4.5, 12.5)), fill=(28, 22, 18, 255), width=1)  # minute hand
        d.ellipse((*P(cx - 1, 11), *P(cx + 1, 13)), fill=(132, 18, 18, 255))
    d.polygon([P(3, 20), P(29, 20), P(26, 26.5), P(16, 30.5), P(6, 26.5)], fill=(22, 13, 11, 255))
    for x in range(4, 28, 3):  # upper teeth
        d.polygon([P(x, 20), P(x + 2.4, 20), P(x + 1.2, 23.6)], fill=(232, 222, 198, 255))
    for x in range(7, 25, 3):  # lower teeth
        d.polygon([P(x, 28.8), P(x + 2.4, 28.8), P(x + 1.2, 25)], fill=(232, 222, 198, 255))


def m_head(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (196, 186, 166) if face == "back" else (206, 196, 176), 9, rng)
    d.rectangle((x0, y0, x0 + w - 1, y0 + h - 1), outline=(160, 150, 132, 255), width=2)
    if face == "front":
        draw_face(d, box)
    elif face in ("left", "right"):  # hollow cheek
        d.ellipse((x0 + w // 4, y0 + h // 2, x0 + w * 3 // 4, y0 + h - 4), fill=(192, 182, 162, 255))


def m_nose(px, d, rng, face, box):
    noise(px, box, (150, 138, 120) if face in ("front", "bottom") else (200, 190, 170), 8, rng)


def m_hat_brim(px, d, rng, face, box):
    noise(px, box, (30, 26, 22), 6, rng)


def m_hat_crown(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (33, 28, 24), 7, rng)
    if face in SIDES:
        noise(px, (x0, y0 + h - 6, w, 6), (60, 48, 39), 6, rng)  # hat band
    elif face == "top":
        d.ellipse((x0 + w // 4, y0 + h // 4, x0 + w * 3 // 4, y0 + h * 3 // 4), fill=(26, 22, 19, 255))


# Mimic (player-like form): pale skin, hollow black eyes, thin smile, faded clothes.
SKIN, HAIR = (182, 174, 162), (24, 21, 19)


def m_m_head(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, SKIN, 7, rng)
    if face == "top":
        noise(px, box, HAIR, 5, rng)
        return
    hair = {"front": 2, "left": 3, "right": 3, "back": 5}.get(face, 0) * S
    if hair:
        noise(px, (x0, y0, w, hair), HAIR, 5, rng)
    if face == "front":
        def P(x, y):
            return (x0 + x * w / 32, y0 + y * h / 32)
        for ex in (5, 20):
            d.rectangle((*P(ex, 13), *P(ex + 7, 18)), fill=(6, 4, 4, 255))
            d.ellipse((*P(ex + 3, 15), *P(ex + 4.2, 16.2)), fill=(240, 240, 240, 255))
        d.line((*P(4, 21), *P(6, 24), *P(26, 24), *P(28, 21)), fill=(40, 20, 18, 255), width=2)


def m_shirt(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (48, 76, 76), 9, rng)
    for _ in range(3):
        x, y = rng.randrange(x0, x0 + max(1, w - 6)), rng.randrange(y0, y0 + max(1, h - 6))
        d.ellipse((x, y, x + rng.randint(3, 6), y + rng.randint(3, 6)), fill=(30, 42, 40, 255))
    if face == "front":
        d.polygon([(x0 + w * 3 // 8, y0), (x0 + w * 5 // 8, y0), (x0 + w // 2, y0 + h // 6)], fill=SKIN + (255,))


def m_m_arm(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, SKIN, 7, rng)
    if face == "top":
        noise(px, box, (48, 76, 76), 9, rng)
    elif face in SIDES:
        noise(px, (x0, y0, w, 4 * S), (48, 76, 76), 9, rng)


def m_pants(px, d, rng, face, box):
    x0, y0, w, h = box
    noise(px, box, (66, 66, 66) if face == "bottom" else (42, 47, 76), 8, rng)
    if face in SIDES:
        noise(px, (x0, y0 + h - 2 * S, w, 2 * S), (66, 66, 66), 6, rng)


MATERIALS = {name[2:]: fn for name, fn in globals().items() if name.startswith("m_") and callable(fn)}


def texture(cubes, uv_w, uv_h, seed, path):
    img = Image.new("RGBA", (uv_w * S, uv_h * S), (0, 0, 0, 0))
    px, d, rng = img.load(), ImageDraw.Draw(img), random.Random(seed)
    for c in cubes:
        for face, (u, v, w, h) in faces(c).items():
            if w and h:
                MATERIALS[c["mat"]](px, d, rng, face, (u * S, v * S, w * S, h * S))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


# ---- Sounds and packaging -------------------------------------------------------------------
def convert_sounds():
    dst = os.path.join(RP, "sounds", "foleypeep")
    os.makedirs(dst, exist_ok=True)
    for src, name in SOUNDS.items():
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(SFX_SRC, src + ".mp3")]
        if name not in STEREO_SOUNDS:
            cmd += ["-ac", "1"]
        cmd += ["-c:a", "libvorbis", "-q:a", "5", os.path.join(dst, name + ".ogg")]
        subprocess.run(cmd, check=True)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def package():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc_root in ((BP, "ghost_bp"), (RP, "ghost_rp")):
            for root, _, files in os.walk(src):
                for name in sorted(files):
                    full = os.path.join(root, name)
                    z.write(full, os.path.join(arc_root, os.path.relpath(full, src)))
    print("wrote", OUT)


def build():
    models = os.path.join(RP, "models", "entity")
    textures = os.path.join(RP, "textures", "entity", "foleypeep")
    for ident, bones, uv_w, bounds, tex, seed in (
        ("geometry.mr_foleypeep", FOLEYPEEP, 128, (3, 4), "mr_foleypeep", 7),
        ("geometry.foleypeep_mimic", MIMIC, 64, (2, 2.5), "mimic", 11),
    ):
        cubes, uv_h = layout(bones, uv_w)
        write_json(os.path.join(models, ident.split(".", 1)[1] + ".geo.json"), geometry(ident, bones, cubes, uv_w, uv_h, bounds))
        texture(cubes, uv_w, uv_h, seed, os.path.join(textures, tex + ".png"))
    convert_sounds()
    package()


if __name__ == "__main__":
    build()
