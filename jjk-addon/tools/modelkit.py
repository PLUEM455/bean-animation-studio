"""Shared toolkit for 2.5D character models: UV packing, painting helpers,
geometry/texture writer and an orthographic preview.

A character script declares BONES, CUBES (bone, origin, size, inflate, style, extra)
and a paint(img, style, faces) function, then calls build().
"""
import json
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CLEAR = (0, 0, 0, 0)
SIDES = ("north", "south", "east", "west")
rng = random.Random(455)


def seed(n):
    rng.seed(n)


# ---------- UV ----------
def pack(cubes, tex):
    x = y = shelf_h = 0
    uvs = []
    for c in cubes:
        w, h, d = c[2]
        rw, rh = int(2 * (w + d)), int(h + d)
        if x + rw > tex:
            x, y, shelf_h = 0, y + shelf_h, 0
        uvs.append([x, y])
        x += rw
        shelf_h = max(shelf_h, rh)
    assert y + shelf_h <= tex, "texture atlas overflow"
    return uvs


def faces(uv, size):
    u, v = uv
    w, h, d = (int(s) for s in size)
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h), "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h),
    }


# ---------- painting ----------
def shade(pal, t, jitter=0.6):
    """t in 0..1 (0 = lightest). Small random jitter so faces are not flat."""
    t = min(max(t + rng.uniform(-jitter, jitter) / len(pal), 0), 0.999)
    return pal[int(t * len(pal))] + (255,)


def fill(img, rect, pal, base=0.3, grad=0.3, jitter=0.6):
    x0, y0, w, h = rect
    for j in range(h):
        for i in range(w):
            t = base + grad * (j / max(h - 1, 1))
            img.putpixel((x0 + i, y0 + j), shade(pal, t, jitter))


def clear(img, rect):
    x0, y0, w, h = rect
    for j in range(h):
        for i in range(w):
            img.putpixel((x0 + i, y0 + j), CLEAR)


def put(img, rect, i, j, color):
    x0, y0, w, h = rect
    if 0 <= i < w and 0 <= j < h:
        img.putpixel((x0 + i, y0 + j), color if len(color) == 4 else color + (255,))


# ---------- outputs ----------
def build(name, bones_decl, cubes, paint, tex=128, view=(24, 40), preview_cubes=None, locators=None):
    uvs = pack(cubes, tex)
    img = Image.new("RGBA", (tex, tex), CLEAR)
    bones = {n: {"name": n, "pivot": pivot, **({"parent": parent} if parent else {})}
             for n, parent, pivot in bones_decl}
    for c, uv in zip(cubes, uvs):
        bone, origin, size, inflate, style, extra = c
        paint(img, style, faces(uv, size))
        cube = {"origin": origin, "size": size, "uv": uv}
        if inflate:
            cube["inflate"] = inflate
        cube.update(extra)
        bones[bone].setdefault("cubes", []).append(cube)
    for bone, locs in (locators or {}).items():
        bones[bone]["locators"] = locs

    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.jjk.{name}",
                "texture_width": tex, "texture_height": tex,
                "visible_bounds_width": 3, "visible_bounds_height": 3.5,
                "visible_bounds_offset": [0, 1.5, 0],
            },
            "bones": list(bones.values()),
        }],
    }
    out = ROOT / f"resource_pack/models/entity/{name}.geo.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(geo, indent=2) + "\n")
    texf = ROOT / f"resource_pack/textures/entity/{name}.png"
    texf.parent.mkdir(parents=True, exist_ok=True)
    img.save(texf)
    keep = [(c, uv) for c, uv in zip(cubes, uvs) if preview_cubes is None or c in preview_cubes]
    preview(name, img, [c for c, _ in keep], [uv for _, uv in keep], view)


def preview(name, img, cubes, uvs, view, scale=8):
    """Orthographic front + back view (cube rotations ignored) for review."""
    W, H = view
    views = []
    for face, sign in (("north", 1), ("south", -1)):
        canvas = Image.new("RGBA", (W, H), (60, 66, 80, 255))
        # draw far faces first: north face plane = z_min - inflate, south = z_max + inflate
        order = sorted(zip(cubes, uvs), key=lambda cu: -(cu[0][1][2] - cu[0][3]) if sign > 0
                       else cu[0][1][2] + cu[0][2][2] + cu[0][3])
        for (bone, origin, size, inf, style, extra), uv in order:
            x, y, w, h = faces(uv, size)[face]
            if w == 0 or h == 0:
                continue
            part = img.crop((x, y, x + w, y + h))
            if face == "south":
                part = part.transpose(Image.FLIP_LEFT_RIGHT)
            sx = origin[0] + W / 2
            sy = H - 2 - (origin[1] + size[1])
            canvas.alpha_composite(part, (int(round(sx)), int(round(sy))))
        views.append(canvas.resize((W * scale, H * scale), Image.NEAREST))
    sheet = Image.new("RGBA", (W * scale * 2 + scale * 4, H * scale), (40, 44, 56, 255))
    sheet.alpha_composite(views[0], (0, 0))
    sheet.alpha_composite(views[1], (W * scale + scale * 4, 0))
    out = ROOT / f"preview/{name}_preview.png"
    out.parent.mkdir(exist_ok=True)
    sheet.save(out)
