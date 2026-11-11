#!/usr/bin/env python3
"""Build script for the Mr. Peeping Tom Bedrock add-on.

Generates the parts that are easier to produce in code than by hand:
  * RP model  (models/entity/mr_peeping_tom.geo.json)  - per-face UV, 4 texels per pixel
  * RP textures (body + emissive eye overlay), particle textures, pack icons
  * RP animation controller (every pose can blend into every other pose)
  * RP sounds (voice lines from ElevenLabs -> mono .ogg, synthesized SFX)
  * dist/MrPeepingTom.mcaddon  (BP + RP zipped, double-click to import)

Run:  python3 tools/build.py        (needs: python3 + numpy + Pillow, ffmpeg)
"""
import json, math, os, random, shutil, subprocess, tempfile, wave, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ADDON = os.path.dirname(HERE)
BP = os.path.join(ADDON, "behavior_packs")
RP = os.path.join(ADDON, "resource_packs")
DIST = os.path.join(ADDON, "dist")
S = 4            # texels per model pixel
TEX = 512        # texture size
rng = random.Random(1337)
nrng = np.random.default_rng(1337)


def wjson(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- model ----
# (bone, parent, pivot, [cubes: (origin, size, paint, rotation|None)])
# Units are model pixels (16 = 1 block). Front of the model faces -Z (north).
def claws(x, side):
    # three long hooked fingers + thumb hanging from the palm
    s = -1 if side == "r" else 1
    out = []
    for i, dz in enumerate((-1.1, -0.1, 0.9)):
        out.append(([x - 0.3 + s * 0.0, 3.0, dz - 0.3], [0.6, 4.0, 0.6], "claw", [8 + i * 4, 0, s * 4]))
    out.append(([x - 0.3 + s * 0.9, 5.0, -1.6], [0.6, 2.5, 0.6], "claw", [-20, 0, s * 18]))
    return out


BONES = [
    ("root", None, [0, 0, 0], []),
    ("waist", "root", [0, 14, 0], [([-2.5, 13, -1.5], [5, 4, 3], "skin", None)]),
    ("chest", "waist", [0, 17, 0], [
        ([-2, 17, -1.25], [4, 5, 2.5], "abdomen", None),
        ([-3.5, 22, -2], [7, 6, 4], "ribs", None),
        ([-4.5, 27, -1.75], [9, 2, 3.5], "skin", None),
    ]),
    ("neck", "chest", [0, 29, 0], [([-1, 28.5, -1], [2, 3, 2], "neck", None)]),
    ("head", "neck", [0, 31, 0], [
        ([-2.75, 31, -3.25], [5.5, 7.5, 6.5], "skull", None),
        ([-2.25, 37.5, -2.25], [4.5, 1.25, 5], "skin", None),
        ([-2.25, 30.25, -3.5], [4.5, 1.5, 3], "maxilla", None),
    ]),
    ("jaw", "head", [0, 30.75, -0.5], [([-2.0, 26.5, -3.6], [4.0, 4.25, 3.4], "jaw", None)]),
    # right arm (character right = -X)
    ("arm_r", "chest", [-4.25, 28, 0], [([-5.5, 19.5, -1], [2, 9, 2], "skin", None)]),
    ("forearm_r", "arm_r", [-4.5, 19.5, 0], [([-5.4, 10.5, -0.9], [1.8, 9, 1.8], "skin", None)]),
    ("hand_r", "forearm_r", [-4.5, 10.5, 0], [([-5.6, 7, -1.25], [2.2, 3.5, 2.5], "skin", None)] + claws(-4.5, "r")),
    # left arm
    ("arm_l", "chest", [4.25, 28, 0], [([3.5, 19.5, -1], [2, 9, 2], "skin", None)]),
    ("forearm_l", "arm_l", [4.5, 19.5, 0], [([3.6, 10.5, -0.9], [1.8, 9, 1.8], "skin", None)]),
    ("hand_l", "forearm_l", [4.5, 10.5, 0], [([3.4, 7, -1.25], [2.2, 3.5, 2.5], "skin", None)] + claws(4.5, "l")),
    # legs
    ("leg_r", "root", [-1.4, 14, 0], [([-2.6, 7.5, -1.25], [2.4, 7, 2.5], "skin", None)]),
    ("shin_r", "leg_r", [-1.4, 7.5, 0], [([-2.5, 1, -1.0], [2.2, 6.5, 2], "skin", None)]),
    ("foot_r", "shin_r", [-1.4, 1, 0], [([-2.6, 0, -3.4], [2.4, 1, 4.4], "foot", None)]),
    ("leg_l", "root", [1.4, 14, 0], [([0.2, 7.5, -1.25], [2.4, 7, 2.5], "skin", None)]),
    ("shin_l", "leg_l", [1.4, 7.5, 0], [([0.3, 1, -1.0], [2.2, 6.5, 2], "skin", None)]),
    ("foot_l", "shin_l", [1.4, 1, 0], [([0.2, 0, -3.4], [2.4, 1, 4.4], "foot", None)]),
]


class Packer:
    def __init__(self, w):
        self.w, self.x, self.y, self.row = w, 0, 0, 0

    def place(self, w, h):
        if self.x + w > self.w:
            self.x, self.y, self.row = 0, self.y + self.row, 0
        pos = (self.x, self.y)
        self.x += w
        self.row = max(self.row, h)
        if self.y + h > TEX:
            raise SystemExit("texture atlas overflow")
        return pos


def face_rects(u, v, w, h, d):
    """Box-UV style unwrap (texels). Returns {face: (x, y, fw, fh)}."""
    return {
        "up": (u + d, v, w, d), "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


def build_model():
    cubes_all = []
    for bone, parent, pivot, cubes in BONES:
        for origin, size, paint, rot in cubes:
            w, h, d = (max(1, math.ceil(s * S)) for s in size)
            cubes_all.append((bone, origin, size, paint, rot, w, h, d))
    pk = Packer(TEX)
    order = sorted(range(len(cubes_all)), key=lambda i: -(cubes_all[i][7] + cubes_all[i][6]))
    placed = {}
    for i in order:
        _, _, _, _, _, w, h, d = cubes_all[i]
        placed[i] = pk.place(2 * (w + d) + 2, d + h + 2)
    geo_bones, paint_jobs = {}, []
    for i, (bone, origin, size, paint, rot, w, h, d) in enumerate(cubes_all):
        u, v = placed[i]
        rects = face_rects(u + 1, v + 1, w, h, d)
        cube = {"origin": origin, "size": size,
                "uv": {f: {"uv": [r[0], r[1]], "uv_size": [r[2], r[3]]} for f, r in rects.items()}}
        if rot:
            c = [origin[0] + size[0] / 2, origin[1] + size[1], origin[2] + size[2] / 2]
            cube["pivot"], cube["rotation"] = c, rot
        geo_bones.setdefault(bone, []).append(cube)
        paint_jobs.append((paint, rects))
    out = []
    for bone, parent, pivot, _ in BONES:
        b = {"name": bone, "pivot": pivot}
        if parent:
            b["parent"] = parent
        if bone in geo_bones:
            b["cubes"] = geo_bones[bone]
        out.append(b)
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.mr_peeping_tom", "texture_width": TEX, "texture_height": TEX,
                        "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.25, 0]},
        "bones": out}]}
    wjson(os.path.join(RP, "models/entity/mr_peeping_tom.geo.json"), geo)
    return paint_jobs


# -------------------------------------------------------------- texture ----
def skin_patch(w, h, base=(38, 38, 41), seed=0):
    r = np.random.default_rng(seed)
    n = r.normal(0, 1, (h, w))
    big = np.array(Image.fromarray(((r.random((max(1, h // 6), max(1, w // 6)))) * 255).astype(np.uint8))
                   .resize((w, h), Image.BICUBIC)).astype(float) / 255.0
    lum = 1.0 + 0.10 * n + 0.28 * (big - 0.5)
    arr = np.stack([np.clip(base[c] * lum, 0, 255) for c in range(3)], -1)
    return arr


def paint_texture(paint_jobs):
    img = np.zeros((TEX, TEX, 4), dtype=float)
    glow = Image.new("RGBA", (TEX, TEX), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    seed = 0
    for paint, rects in paint_jobs:
        for face, (x, y, w, h) in rects.items():
            seed += 1
            base = (34, 34, 37)
            if paint == "claw":
                base = (22, 20, 20)
            patch = skin_patch(w, h, base, seed)
            # vertical shading: darker lower, wet sheen higher
            grad = np.linspace(1.10, 0.85, h)[:, None]
            patch *= grad[..., None]
            if paint == "claw":
                tip = np.linspace(1.0, 2.2, h)[:, None, None]
                patch = np.clip(patch * tip, 0, 120)
            region = Image.fromarray(np.clip(patch, 0, 255).astype(np.uint8))
            dr = ImageDraw.Draw(region)
            if paint == "ribs" and face == "north":
                for k in range(5):
                    yy = int(h * (0.12 + k * 0.17))
                    dr.arc([-w * 0.15, yy - h * 0.10, w * 0.48, yy + h * 0.12], 200, 340, fill=(64, 64, 68), width=2)
                    dr.arc([w * 0.52, yy - h * 0.10, w * 1.15, yy + h * 0.12], 200, 340, fill=(64, 64, 68), width=2)
                    dr.arc([-w * 0.15, yy - h * 0.05, w * 0.48, yy + h * 0.17], 200, 340, fill=(14, 14, 15), width=2)
                    dr.arc([w * 0.52, yy - h * 0.05, w * 1.15, yy + h * 0.17], 200, 340, fill=(14, 14, 15), width=2)
                dr.line([w // 2, 0, w // 2, h], fill=(18, 18, 19), width=2)
            if paint in ("ribs", "abdomen", "neck") and face == "south":
                for yy in range(1, h, 4):
                    dr.ellipse([w // 2 - 2, yy, w // 2 + 2, yy + 2], fill=(58, 58, 62))
                dr.line([w // 2, 0, w // 2, h], fill=(16, 16, 17), width=1)
            if paint == "abdomen" and face == "north":
                dr.line([w // 2, 0, w // 2, h], fill=(16, 16, 17), width=1)
                for yy in (h // 4, h // 2, 3 * h // 4):
                    dr.line([2, yy, w - 3, yy], fill=(22, 22, 24), width=1)
            if paint == "neck":
                for xx in range(2, w, 3):
                    dr.line([xx, 0, xx, h], fill=(20, 20, 21), width=1)
            if paint == "skull" and face == "north":
                # sunken sockets, glowing eyes, nasal cavity, cheekbones
                ew, eh = int(w * 0.30), int(h * 0.26)
                ey = int(h * 0.42)
                for cx in (int(w * 0.28), int(w * 0.72)):
                    dr.ellipse([cx - ew // 2 - 2, ey - eh // 2 - 2, cx + ew // 2 + 2, ey + eh // 2 + 2], fill=(8, 8, 9))
                    dr.ellipse([cx - ew // 2 + 1, ey - eh // 2 + 1, cx + ew // 2 - 1, ey + eh // 2 - 1], fill=(236, 236, 232))
                    dr.ellipse([cx - 2, ey - 2, cx + 2, ey + 2], fill=(200, 200, 196))
                    gd.ellipse([x + cx - ew // 2 + 1, y + ey - eh // 2 + 1, x + cx + ew // 2 - 1, y + ey + eh // 2 - 1],
                               fill=(255, 255, 250, 255))
                dr.polygon([(w // 2 - 2, int(h * 0.62)), (w // 2 + 2, int(h * 0.62)), (w // 2, int(h * 0.74))], fill=(6, 6, 6))
                dr.line([1, int(h * 0.70), int(w * 0.3), int(h * 0.80)], fill=(58, 58, 61), width=2)
                dr.line([w - 2, int(h * 0.70), int(w * 0.7), int(h * 0.80)], fill=(58, 58, 61), width=2)
                # upper teeth along the bottom edge
                dr.rectangle([int(w * 0.18), h - 4, int(w * 0.82), h], fill=(5, 5, 5))
                for tx in range(int(w * 0.2), int(w * 0.8), 3):
                    dr.polygon([(tx, h - 4), (tx + 2, h - 4), (tx + 1, h)], fill=(196, 188, 170))
            if paint == "skull" and face in ("east", "west"):
                dr.ellipse([int(w * 0.05), int(h * 0.30), int(w * 0.35), int(h * 0.55)], fill=(10, 10, 11))
            if paint == "skull" and face == "south":
                dr.line([w // 2, 0, w // 2, h], fill=(22, 22, 23), width=1)
            if paint == "maxilla" and face == "north":
                dr.rectangle([1, 0, w - 2, h], fill=(4, 4, 4))
                for tx in range(2, w - 2, 3):
                    dr.polygon([(tx, 0), (tx + 2, 0), (tx + 1, h)], fill=(205, 196, 176))
            if paint == "maxilla" and face == "down":
                dr.rectangle([0, 0, w, h], fill=(6, 3, 3))
            if paint == "jaw" and face == "north":
                dr.rectangle([2, 0, w - 3, int(h * 0.75)], fill=(5, 2, 2))
                for tx in range(3, w - 3, 3):
                    dr.polygon([(tx, int(h * 0.75)), (tx + 2, int(h * 0.75)), (tx + 1, int(h * 0.38))], fill=(200, 190, 168))
            if paint == "jaw" and face == "up":
                dr.rectangle([0, 0, w, h], fill=(18, 4, 4))
            if paint == "foot" and face in ("up", "north"):
                for tx in range(1, w, max(2, w // 5)):
                    dr.line([tx, 0, tx, h], fill=(18, 18, 19), width=1)
            arr = np.array(region).astype(float)
            img[y:y + h, x:x + w, :3] = arr
            img[y:y + h, x:x + w, 3] = 255
    body = Image.fromarray(img.astype(np.uint8), "RGBA")
    tdir = os.path.join(RP, "textures/entity/mr_peeping_tom")
    os.makedirs(tdir, exist_ok=True)
    body.save(os.path.join(tdir, "mr_peeping_tom.png"))
    glow.save(os.path.join(tdir, "mr_peeping_tom_glow.png"))


def particle_textures():
    tdir = os.path.join(RP, "textures/particle/ppt")
    os.makedirs(tdir, exist_ok=True)
    # smoke puff (soft round, white -> tinted black by particle)
    sz = 32
    yy, xx = np.mgrid[0:sz, 0:sz]
    rr = np.sqrt((xx - sz / 2 + .5) ** 2 + (yy - sz / 2 + .5) ** 2) / (sz / 2)
    a = np.clip(1 - rr, 0, 1) ** 1.4 * (0.75 + 0.25 * nrng.random((sz, sz)))
    Image.fromarray(np.dstack([np.full((sz, sz), 255)] * 3 + [a * 255]).astype(np.uint8), "RGBA").save(f"{tdir}/smoke.png")
    # bubble ring
    ring = np.clip(1 - np.abs(rr - 0.7) * 6, 0, 1)
    Image.fromarray(np.dstack([np.full((sz, sz), 255)] * 3 + [ring * 255]).astype(np.uint8), "RGBA").save(f"{tdir}/bubble.png")
    # handprint (soot)
    hp = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(hp)
    d.ellipse([9, 14, 23, 28], fill=(255, 255, 255, 230))
    for i, (fx, top) in enumerate(((8, 3), (12, 0), (16, 0), (20, 2))):
        d.rounded_rectangle([fx, top, fx + 3, 17], 2, fill=(255, 255, 255, 220))
    d.rounded_rectangle([22, 12, 29, 15], 2, fill=(255, 255, 255, 220))
    hp.filter(ImageFilter.GaussianBlur(0.6)).save(f"{tdir}/handprint.png")
    # bare footprint (long toes)
    fp = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(fp)
    d.ellipse([11, 10, 21, 30], fill=(255, 255, 255, 235))
    for i, tx in enumerate((10, 13, 16, 19, 22)):
        d.ellipse([tx - 1, 2 + abs(2 - i), tx + 2, 8 + abs(2 - i)], fill=(255, 255, 255, 235))
    fp.filter(ImageFilter.GaussianBlur(0.6)).save(f"{tdir}/footprint.png")
    # leaf
    lf = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(lf)
    d.ellipse([3, 1, 12, 14], fill=(255, 255, 255, 255))
    d.line([8, 2, 8, 15], fill=(160, 160, 160, 255))
    lf.save(f"{tdir}/leaf.png")


def icons():
    ref = Image.open(os.path.join(HERE, "reference_turnaround.jpg")).convert("RGB")
    W, H = ref.size
    box = (int(W * 0.075), int(H * 0.04), int(W * 0.25), int(H * 0.04) + int(W * 0.175))
    icon = ref.crop(box).resize((256, 256), Image.LANCZOS)
    dark = Image.new("RGB", icon.size, (0, 0, 0))
    icon = Image.blend(icon, dark, 0.25)
    for p in (BP, RP):
        icon.save(os.path.join(p, "pack_icon.png"))


# --------------------------------------------------------------- client ----
POSES = ["vanish", "scare", "swim", "climb", "crawl", "sprint", "peek", "walk", "idle"]


def anim_controller():
    cond = {
        "vanish": "v.pose == 'vanish'",
        "scare": "v.pose == 'scare'",
        "swim": "q.is_in_water && v.pose != 'vanish' && v.pose != 'scare'",
        "climb": "v.pose == 'climb' && !q.is_in_water",
        "crawl": "v.pose == 'crawl' && !q.is_in_water",
        "sprint": "v.pose == 'sprint' && !q.is_in_water",
        "peek": "v.pose == 'peek' && q.modified_move_speed < 0.05 && !q.is_in_water",
        "walk": "(v.pose == 'stalk' || v.pose == 'idle' || v.pose == 'peek') && q.modified_move_speed >= 0.05 && !q.is_in_water",
        "idle": "(v.pose == 'stalk' || v.pose == 'idle') && q.modified_move_speed < 0.05 && !q.is_in_water",
    }
    anims = {
        "vanish": ["vanish"],
        "scare": ["scare"],
        "swim": ["swim", "look_at_target"],
        "climb": ["wall_climb"],
        "crawl": [{"crawl_one_block": "math.clamp(q.modified_move_speed * 6, 0.35, 1)"}],
        "sprint": ["sprint_chase", "look_at_target"],
        "peek": ["peek_lean", "look_at_target"],
        "walk": ["stalk_walk", "look_at_target"],
        "idle": ["idle_twitch", "look_at_target"],
    }
    states = {}
    for p in POSES:
        st = {"animations": anims[p], "blend_transition": 0.25 if p not in ("scare", "vanish") else 0.08,
              "transitions": [{o: cond[o]} for o in POSES if o != p]}
        states[p] = st
    states["default"] = {"transitions": [{o: cond[o]} for o in POSES]}
    data = {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.peeping_tom.main": {"initial_state": "default", "states": states}}}
    wjson(os.path.join(RP, "animation_controllers/mr_peeping_tom.animation_controllers.json"), data)


# --------------------------------------------------------------- sounds ----
SR = 44100


def write_wav(path, x):
    x = np.clip(x / max(1e-6, np.max(np.abs(x))) * 0.92, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def env(n, a, d):
    e = np.ones(n)
    na, nd = int(a * SR), int(d * SR)
    e[:na] = np.linspace(0, 1, na) if na else 1
    if nd:
        e[-nd:] *= np.linspace(1, 0, nd)
    return e


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def sfx_knock():
    out = np.zeros(int(SR * 1.6))
    for i, t in enumerate((0.0, 0.32, 0.64)):
        n = int(SR * 0.18)
        tt = np.arange(n) / SR
        body = np.sin(2 * np.pi * 95 * tt) * np.exp(-tt * 38) + 0.6 * np.sin(2 * np.pi * 180 * tt) * np.exp(-tt * 55)
        click = lowpass(nrng.normal(0, 1, n), 6) * np.exp(-tt * 140) * 0.7
        s = int(SR * (t + 0.05))
        out[s:s + n] += (body + click) * (1.0 - i * 0.05)
    return out


def sfx_screech():
    n = int(SR * 1.7)
    t = np.arange(n) / SR
    f = 900 + 1500 * np.sin(np.pi * t / 1.7) + 140 * np.sin(2 * np.pi * 23 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sign(np.sin(ph)) * 0.35 + np.sin(ph * 1.51) * 0.35 + np.sin(ph * 2.03) * 0.2
    noise = lowpass(nrng.normal(0, 1, n), 3) * 0.55
    roar = np.sin(2 * np.pi * 55 * t) * 0.5 * (1 + nrng.normal(0, .2, n))
    x = (tone + noise + roar) * env(n, 0.03, 0.6)
    return np.tanh(x * 2.5)


def sfx_drone():
    n = int(SR * 24)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t + p) * a for f, p, a in ((41, 0, .6), (41.7, 1, .5), (61.5, .3, .25), (82.4, 2, .15)))
    wind = lowpass(nrng.normal(0, 1, n), 400) * 6
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / 12 - np.pi / 2)
    return (x + wind) * swell * env(n, 3, 3)


def sfx_twig():
    n = int(SR * 1.2)
    t = np.arange(n) / SR
    rustle = lowpass(nrng.normal(0, 1, n), 2) * (0.25 + 0.2 * np.sin(2 * np.pi * 9 * t)) * env(n, 0.05, 0.5)
    snap = np.zeros(n)
    s = int(SR * 0.55)
    k = int(SR * 0.06)
    snap[s:s + k] = nrng.normal(0, 1, k) * np.exp(-np.arange(k) / SR * 90) * 2.5
    return rustle + snap


def sfx_smoke():
    n = int(SR * 1.6)
    t = np.arange(n) / SR
    noise = nrng.normal(0, 1, n)
    k = (2 + 30 * (t / t[-1])).astype(int)
    x = np.array([0.0] * n)
    acc = np.cumsum(noise)
    for i in range(n):
        kk = k[i]
        x[i] = (acc[i] - acc[max(0, i - kk)]) / kk
    low = np.sin(2 * np.pi * (70 - 30 * t) * t) * 0.6
    return (x * 1.4 + low) * env(n, 0.05, 0.9)


def sfx_step():
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    return (lowpass(nrng.normal(0, 1, n), 12) * 1.6 + np.sin(2 * np.pi * 70 * t) * 0.5) * np.exp(-t * 18)


def sfx_glitch():
    n = int(SR * 1.0)
    out = np.zeros(n)
    for i in range(18):
        s = int(nrng.random() * (n - 800))
        tt = np.arange(600) / SR
        out[s:s + 600] += np.sin(2 * np.pi * (2400 + 800 * nrng.random()) * tt) * np.exp(-tt * 300)
    return out


def sfx_breath():
    n = int(SR * 3.2)
    t = np.arange(n) / SR
    air = lowpass(nrng.normal(0, 1, n), 25)
    shape = np.clip(np.sin(np.pi * t / 1.4), 0, 1) ** 2 + 0.8 * np.clip(np.sin(np.pi * (t - 1.6) / 1.5), 0, 1) ** 2
    rasp = np.sin(2 * np.pi * 48 * t) * 0.15
    return (air + rasp) * shape


def to_ogg(src, dst, filt=None):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "44100"]
    if filt:
        cmd += ["-af", filt]
    cmd += ["-c:a", "libvorbis", "-q:a", "4", dst]
    subprocess.run(cmd, check=True)


VOICES = {  # file -> ffmpeg filter (night lines get a cold echo, the chuckle is muffled)
    "day_morning": "highpass=f=90,loudnorm=I=-16",
    "day_weather": "highpass=f=90,loudnorm=I=-16",
    "night_comein": "highpass=f=90,aecho=0.8:0.6:220:0.25,loudnorm=I=-16",
    "night_run": "highpass=f=90,aecho=0.8:0.6:220:0.25,loudnorm=I=-16",
    "night_lookup": "highpass=f=90,aecho=0.8:0.7:180|360:0.35|0.2,loudnorm=I=-15",
    "jumpscare_chuckle": "lowpass=f=1500,aecho=0.8:0.5:90:0.3,volume=1.6,loudnorm=I=-15",
    "vanish_line": "highpass=f=90,aecho=0.8:0.6:300:0.3,loudnorm=I=-16",
}
SFX = {"knock": sfx_knock, "screech": sfx_screech, "drone": sfx_drone, "twig": sfx_twig,
       "smoke": sfx_smoke, "step": sfx_step, "glitch": sfx_glitch, "breath": sfx_breath}


def sounds():
    sdir = os.path.join(RP, "sounds/ppt")
    os.makedirs(sdir, exist_ok=True)
    for name, filt in VOICES.items():
        to_ogg(os.path.join(HERE, "voice_src", name + ".mp3"), os.path.join(sdir, name + ".ogg"), filt)
    with tempfile.TemporaryDirectory() as td:
        for name, fn in SFX.items():
            wav = os.path.join(td, name + ".wav")
            write_wav(wav, fn())
            to_ogg(wav, os.path.join(sdir, name + ".ogg"))


# -------------------------------------------------------------- package ----
def package():
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "MrPeepingTom.mcaddon")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for src, top in ((BP, "MrPeepingTom_BP"), (RP, "MrPeepingTom_RP")):
            for base, _, files in os.walk(src):
                for f in sorted(files):
                    full = os.path.join(base, f)
                    z.write(full, os.path.join(top, os.path.relpath(full, src)))
    print("wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    jobs = build_model()
    paint_texture(jobs)
    particle_textures()
    icons()
    anim_controller()
    sounds()
    package()
