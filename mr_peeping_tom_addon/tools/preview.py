#!/usr/bin/env python3
"""Offline preview of the geo + animations (orthographic, painter's algorithm).
Usage: python3 tools/preview.py OUT.png
Renders rest pose from 4 angles + every animation at a few times, so the model can be checked
without opening the game. Rotation convention follows Bedrock (all axes applied as negative angles).
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ADDON = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ADDON, "resource_packs")
geo = json.load(open(os.path.join(RP, "models/entity/mr_peeping_tom.geo.json")))["minecraft:geometry"][0]
anims = json.load(open(os.path.join(RP, "animations/mr_peeping_tom.animation.json")))["animations"]
tex = np.array(Image.open(os.path.join(RP, "textures/entity/mr_peeping_tom/mr_peeping_tom.png")).convert("RGBA"))
glow = np.array(Image.open(os.path.join(RP, "textures/entity/mr_peeping_tom/mr_peeping_tom_glow.png")).convert("RGBA"))
bones = {b["name"]: b for b in geo["bones"]}


def rx(a):
    a = math.radians(-a); c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    a = math.radians(-a); c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    a = math.radians(-a); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def rot(r):
    return rz(r[2]) @ ry(r[1]) @ rx(r[0])


def molang(expr, t):
    if not isinstance(expr, str):
        return float(expr)
    e = expr.replace("q.anim_time", "T").replace("query.anim_time", "T")
    e = re.sub(r"query\.target_[xy]_rotation - this", "0", e)
    e = e.replace("math.sin", "SIN").replace("math.cos", "COS").replace("math.abs", "abs")
    e = e.replace("math.max", "max").replace("math.mod", "MOD").replace("math.clamp", "CLAMP")
    env = {"T": t, "SIN": lambda d: math.sin(math.radians(d)), "COS": lambda d: math.cos(math.radians(d)),
           "MOD": lambda a, b: a % b, "CLAMP": lambda v, a, b: min(max(v, a), b), "abs": abs, "max": max}
    return float(eval(e, {"__builtins__": {}}, env))


def channel(ch, t):
    if isinstance(ch, dict) and "rotation" not in ch:
        keys = sorted((float(k), v) for k, v in ch.items())
        if t <= keys[0][0]:
            v = keys[0][1]
        elif t >= keys[-1][0]:
            v = keys[-1][1]
        else:
            for (k0, v0), (k1, v1) in zip(keys, keys[1:]):
                if k0 <= t <= k1:
                    f = (t - k0) / (k1 - k0)
                    v = [molang(a, t) * (1 - f) + molang(b, t) * f for a, b in zip(v0, v1)]
                    break
        return [molang(x, t) for x in v]
    if isinstance(ch, (int, float)):
        return [float(ch)] * 3
    return [molang(x, t) for x in ch]


def pose(anim_names, t):
    P = {}
    for n in anim_names:
        a = anims["animation.peeping_tom." + n]
        for bn, ch in a.get("bones", {}).items():
            p = P.setdefault(bn, {"rotation": [0, 0, 0], "position": [0, 0, 0], "scale": [1, 1, 1]})
            for k in ("rotation", "position"):
                if k in ch:
                    p[k] = [x + y for x, y in zip(p[k], channel(ch[k], t))]
            if "scale" in ch:
                p["scale"] = [x * y for x, y in zip(p["scale"], channel(ch["scale"], t))]
    return P


def world_transforms(P):
    M = {}

    def get(name):
        if name in M:
            return M[name]
        b = bones[name]
        piv = np.array(b["pivot"], float)
        p = P.get(name, {"rotation": [0, 0, 0], "position": [0, 0, 0], "scale": [1, 1, 1]})
        R = rot(b.get("rotation", [0, 0, 0])) @ rot(p["rotation"]) @ np.diag(p["scale"])
        off = np.array(p["position"], float)
        # local: x -> R (x - piv) + piv + off
        A, t = R, piv + off - R @ piv
        if "parent" in b:
            PA, Pt = get(b["parent"])
            A, t = PA @ A, PA @ t + Pt
        M[name] = (A, t)
        return M[name]

    for n in bones:
        get(n)
    return M


FACES = {  # face -> 4 corners in unit cube coords (u,v order: top-left, top-right, bottom-right, bottom-left)
    "north": [(1, 1, 0), (0, 1, 0), (0, 0, 0), (1, 0, 0)],
    "south": [(0, 1, 1), (1, 1, 1), (1, 0, 1), (0, 0, 1)],
    "east": [(0, 1, 0), (0, 1, 1), (0, 0, 1), (0, 0, 0)],
    "west": [(1, 1, 1), (1, 1, 0), (1, 0, 0), (1, 0, 1)],
    "up": [(1, 1, 1), (0, 1, 1), (0, 1, 0), (1, 1, 0)],
    "down": [(1, 0, 0), (0, 0, 0), (0, 0, 1), (1, 0, 1)],
}


def render(P, yaw, size=360, scale=8.5):
    M = world_transforms(P)
    V = ry(-yaw)
    polys = []
    for name, b in bones.items():
        A, t = M[name]
        for c in b.get("cubes", []):
            o, s = np.array(c["origin"], float), np.array(c["size"], float)
            CR = np.eye(3); cp = np.zeros(3)
            if "rotation" in c:
                CR = rot(c["rotation"]); cp = np.array(c["pivot"], float)
            for f, corners in FACES.items():
                uv = c["uv"][f]
                u0, v0 = uv["uv"]; uw, vh = uv["uv_size"]
                pts = []
                for k in corners:
                    p = o + s * np.array(k, float)
                    p = CR @ (p - cp) + cp
                    p = A @ p + t
                    pts.append(V @ p)
                pts = np.array(pts)
                n = np.cross(pts[1] - pts[0], pts[3] - pts[0])
                if n[2] < 0:  # facing away from camera (camera looks toward +z)
                    continue
                nx, ny = max(1, int(round(uw))), max(1, int(round(vh)))
                shade = 0.55 + 0.45 * max(0.0, n[2] / (np.linalg.norm(n) + 1e-9))
                for j in range(ny):
                    for i in range(nx):
                        tx, ty = int(u0 + i), int(v0 + j)
                        col = tex[min(ty, tex.shape[0] - 1), min(tx, tex.shape[1] - 1)]
                        g = glow[min(ty, glow.shape[0] - 1), min(tx, glow.shape[1] - 1)]
                        a0, a1, b0, b1 = i / nx, (i + 1) / nx, j / ny, (j + 1) / ny

                        def L(a, bb):
                            top = pts[0] + (pts[1] - pts[0]) * a
                            bot = pts[3] + (pts[2] - pts[3]) * a
                            return top + (bot - top) * bb

                        q = [L(a0, b0), L(a1, b0), L(a1, b1), L(a0, b1)]
                        z = float(np.mean([p[2] for p in q]))
                        rgb = col[:3] * (1.0 if g[3] > 0 else shade)
                        polys.append((z, [(size / 2 - p[0] * scale, size * 0.92 - p[1] * scale) for p in q], tuple(int(x) for x in rgb)))
    img = Image.new("RGB", (size, size), (120, 120, 124))
    d = ImageDraw.Draw(img)
    for z, q, col in sorted(polys, key=lambda x: -x[0]):
        d.polygon(q, fill=col)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "preview.png"
    shots = [("rest front", [], 0, 0), ("rest 3/4", [], 0, 35), ("rest side", [], 0, 90), ("rest back", [], 0, 180)]
    for n, t in (("idle_twitch", 0.5), ("peek_lean", 0.5), ("stalk_walk", 0.4), ("sprint_chase", 0.15),
                 ("crawl_one_block", 0.25), ("wall_climb", 0.2), ("swim", 0.3), ("scare", 0.1), ("vanish", 0.7)):
        shots.append((n, [n], t, 55))
    tiles = []
    for label, names, t, yaw in shots:
        im = render(pose(names, t), yaw)
        ImageDraw.Draw(im).text((8, 6), label, fill=(255, 255, 255))
        tiles.append(im)
    cols = 5
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 360, rows * 360), (40, 40, 40))
    for i, im in enumerate(tiles):
        sheet.paste(im, ((i % cols) * 360, (i // cols) * 360))
    sheet.save(out)
    print("wrote", out)
