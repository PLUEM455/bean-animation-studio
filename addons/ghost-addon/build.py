"""Build the ghost addon: generate the ghost texture and package both packs into ghost.mcaddon.

Run from anywhere:  python3 addons/ghost-addon/build.py
"""
import os
import random
import zipfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(HERE, "behavior_packs", "ghost_bp")
RP = os.path.join(HERE, "resource_packs", "ghost_rp")
TEXTURE = os.path.join(RP, "textures", "entity", "ghost.png")
OUT_DIR = os.path.join(HERE, "dist")
OUT = os.path.join(OUT_DIR, "ghost.mcaddon")


def make_texture():
    """64x64 pale-blue translucent ghost with red eyes."""
    random.seed(7)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    for y in range(64):
        for x in range(64):
            shade = random.randint(-12, 12)
            px[x, y] = (200 + shade, 220 + shade, 255, 230)
    draw = ImageDraw.Draw(img)
    # Dark eyes that glow red so the ghost reads as menacing.
    draw.rectangle((2, 6, 4, 8), fill=(255, 30, 30, 255))
    draw.rectangle((10, 6, 12, 8), fill=(255, 30, 30, 255))
    os.makedirs(os.path.dirname(TEXTURE), exist_ok=True)
    img.save(TEXTURE)


def pack(folder_src, arc_root):
    for root, _, files in os.walk(folder_src):
        for name in files:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, folder_src)
            yield full, os.path.join(arc_root, rel)


def build():
    make_texture()
    os.makedirs(OUT_DIR, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc in list(pack(BP, "ghost_bp")) + list(pack(RP, "ghost_rp")):
            z.write(src, arc)
    print("wrote", OUT)


if __name__ == "__main__":
    build()
