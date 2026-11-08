#!/usr/bin/env python3
"""สร้างไฟล์ BP/RP ของ JJK addon + ตรวจ + แพ็ก .mcaddon  (ใช้: python3 build.py)"""
import json, os, re, struct, uuid, zlib, zipfile, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BP, RP = os.path.join(ROOT, "BP"), os.path.join(ROOT, "RP")
NS = uuid.UUID("6f1c1a4e-0d6a-4f1e-9a55-3c9a7c0f2b11")
U = lambda n: str(uuid.uuid5(NS, n))
MIN_ENGINE = [1, 26, 60]  # ตามตัวอย่างทางการ Mojang/bedrock-samples
SERVER_VER = "2.11.0"  # npm @minecraft/server latest (ยังไม่ทดสอบในเกม)
ENTITY_FV = "1.26.50"  # ตามตัวอย่างทางการ
ITEM_FV = "1.21.50"


def wj(rel, obj):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def wt(rel, txt):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(txt)


class Img:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.px = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def set(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.px[y][x] = c if len(c) == 4 else c + (255,)

    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                s.set(x + i, y + j, c)

    def save(s, rel):
        raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in s.px)
        def chunk(t, d):
            c = struct.pack(">I", len(d)) + t + d
            return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
        data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", s.w, s.h, 8, 6, 0, 0, 0))
        data += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
        p = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(data)


# ---------------- สี ----------------
SK, SKD = (224, 172, 138), (190, 140, 110)
HAIR, BLK, BLK2 = (20, 20, 28), (28, 28, 34), (46, 46, 56)
WH, WH2 = (235, 235, 240), (205, 205, 215)
SASH, SHOE = (60, 74, 110), (40, 40, 46)
EYE, EYEW, SCAR, MOUTH = (15, 15, 15), (240, 240, 240), (170, 90, 90), (120, 60, 60)
PALETTE = {  # ชื่อ -> สี (วางเป็นพิกเซลที่ x=32+i, y=0 ของ texture)
    "steel": (190, 195, 205), "steel_d": (120, 125, 135), "blade": (235, 240, 250),
    "wood_d": (60, 40, 30), "red_d": (110, 25, 25), "green": (40, 110, 70),
    "chain": (150, 150, 160), "grip": (40, 40, 45), "purple": (130, 60, 170),
    "purple_d": (90, 35, 125), "eyeY": (230, 230, 80), "gold": (200, 170, 60),
    "band": (110, 110, 120),
}
PIDX = {n: i for i, n in enumerate(PALETTE)}


def faces(u, v, w, h, d):
    return {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h),
    }


def paint_entity_texture():
    im = Img(64, 64)
    for n, c in PALETTE.items():
        im.set(32 + PIDX[n], 0, c)
    # หัว 8x8x8 ที่ (0,0)
    f = faces(0, 0, 8, 8, 8)
    for k, (x, y, w, h) in f.items():
        im.rect(x, y, w, h, HAIR)
    x, y, w, h = f["front"]
    im.rect(x, y + 2, w, 6, SK)
    im.rect(x, y, 1, 3, HAIR); im.rect(x + 7, y, 1, 3, HAIR)  # หน้าม้า
    im.rect(x + 1, y + 2, 2, 1, HAIR); im.rect(x + 5, y + 2, 2, 1, HAIR)  # คิ้ว
    im.set(x + 1, y + 3, EYEW); im.set(x + 2, y + 3, EYE)
    im.set(x + 5, y + 3, EYE); im.set(x + 6, y + 3, EYEW)
    im.rect(x + 3, y + 4, 2, 1, SKD)  # จมูก
    im.rect(x + 2, y + 5, 4, 1, MOUTH); im.set(x + 6, y + 4, SCAR)  # ยิ้ม + แผลเป็นมุมปาก
    for side in ("right", "left"):
        x, y, w, h = f[side]
        im.rect(x, y + 3, w, 5, SK)
    x, y, w, h = f["back"]; im.rect(x, y + 7, w, 1, SK)
    x, y, w, h = f["bottom"]; im.rect(x, y, w, h, SK)
    # ตัว 10x12x5 ที่ (0,16)
    f = faces(0, 16, 10, 12, 5)
    for k, (x, y, w, h) in f.items():
        im.rect(x, y, w, h, BLK)
    x, y, w, h = f["front"]
    im.rect(x + 1, y + 1, 4, 3, BLK2); im.rect(x + 5, y + 1, 4, 3, BLK2)  # กล้ามอก
    im.rect(x + 4, y + 1, 2, 5, (22, 22, 28))
    for k in ("front", "back", "left", "right"):
        x, y, w, h = f[k]; im.rect(x, y + 10, w, 2, SASH)  # สายคาดเอว
    # แขน 5x12x5: ซ้าย (32,16) ขวา (32,34)
    for u, v in ((32, 16), (32, 34)):
        f = faces(u, v, 5, 12, 5)
        for k, (x, y, w, h) in f.items():
            if k in ("top",):
                im.rect(x, y, w, h, BLK)
            elif k == "bottom":
                im.rect(x, y, w, h, SK)
            else:
                im.rect(x, y, w, 5, BLK); im.rect(x, y + 5, w, h - 5, SK)
    # ขา 4x12x4: ขวา (0,34) ซ้าย (16,34)
    for u, v in ((0, 34), (16, 34)):
        f = faces(u, v, 4, 12, 4)
        for k, (x, y, w, h) in f.items():
            if k == "top":
                im.rect(x, y, w, h, WH)
            elif k == "bottom":
                im.rect(x, y, w, h, SHOE)
            else:
                im.rect(x, y, w, 10, WH); im.rect(x, y + 10, w, 2, SHOE)
                im.rect(x + 1, y + 2, 1, 6, WH2)
    im.save("RP/textures/entity/toji.png")


# ---------------- โมเดล ----------------
def cube(origin, size, color):
    p = [32 + PIDX[color], 0]
    face = {"uv": p, "uv_size": [1, 1]}
    return {"origin": origin, "size": size, "uv": {k: face for k in ("north", "south", "east", "west", "up", "down")}}


def box(origin, size, uv):
    return {"origin": origin, "size": size, "uv": uv}


def geo():
    HX, HY, HZ = -7.5, 11, -1  # จุดมือขวา
    bones = [
        {"name": "body", "pivot": [0, 12, 0], "cubes": [box([-5, 12, -2.5], [10, 12, 5], [0, 16])]},
        {"name": "head", "pivot": [0, 24, 0], "cubes": [box([-4, 24, -4], [8, 8, 8], [0, 0])]},
        {"name": "leftArm", "pivot": [7.5, 22, 0], "cubes": [box([5, 12, -2.5], [5, 12, 5], [32, 16])]},
        {"name": "rightArm", "pivot": [-7.5, 22, 0], "cubes": [box([-10, 12, -2.5], [5, 12, 5], [32, 34])]},
        {"name": "leftLeg", "pivot": [2, 12, 0], "cubes": [box([0, 0, -2], [4, 12, 4], [16, 34])]},
        {"name": "rightLeg", "pivot": [-2, 12, 0], "cubes": [box([-4, 0, -2], [4, 12, 4], [0, 34])]},
        # โซ่ที่ตัว + หนอนวิญญาณม่วง (แสดงตลอด)
        {"name": "chain_body", "pivot": [0, 12, 0], "cubes": [
            cube([-5.3, 18, -2.8], [10.6, 1, 5.6], "chain"),
            cube([-5.3, 16.5, -2.8], [10.6, 1, 5.6], "band"),
        ]},
        {"name": "worm", "pivot": [0, 12, 0], "cubes": [
            cube([3, 23, -5.5], [3, 3, 3], "purple"), cube([1, 20.5, -5.5], [3, 3, 3], "purple_d"),
            cube([-1, 18, -5.5], [3, 3, 3], "purple"), cube([-3, 15.5, -5.5], [3, 3, 3], "purple_d"),
            cube([-5, 13, -5.5], [3, 3, 3], "purple"),
            cube([-7, 11, -5.8], [4, 4, 4], "purple_d"), cube([-7.3, 12.8, -6], [1, 1, 0.4], "eyeY"),
            cube([-5.3, 12.8, -6], [1, 1, 0.4], "eyeY"),
        ]},
        # อาวุธ (ติดแขนขวา โชว์ตามค่า jjk:weapon)
        {"name": "sword", "parent": "rightArm", "pivot": [HX, HY, HZ], "cubes": [
            cube([HX - 0.6, HY, HZ - 0.6], [1.2, 3, 1.2], "grip"),
            cube([HX - 2, HY + 3, HZ - 0.8], [4, 0.8, 1.6], "gold"),
            cube([HX - 0.5, HY + 3.8, HZ - 0.3], [1, 19, 0.6], "blade"),
        ]},
        {"name": "spear", "parent": "rightArm", "pivot": [HX, HY, HZ], "cubes": [
            cube([HX - 0.5, HY - 6, HZ - 0.5], [1, 30, 1], "red_d"),
            cube([HX - 1, HY + 24, HZ - 0.3], [2, 6, 0.6], "steel"),
            cube([HX - 2, HY + 23, HZ - 0.3], [4, 1, 0.6], "steel_d"),
        ]},
        {"name": "pistol", "parent": "rightArm", "pivot": [HX, HY, HZ], "cubes": [
            cube([HX - 0.8, HY - 1, HZ - 0.8], [1.6, 4, 1.6], "grip"),
            cube([HX - 0.8, HY + 3, HZ - 6], [1.6, 2, 7], "steel_d"),
            cube([HX - 0.5, HY + 5, HZ - 5.5], [1, 0.5, 5], "steel"),
        ]},
        {"name": "yuun", "parent": "rightArm", "pivot": [HX, HY, HZ], "cubes": [
            cube([HX - 0.6, HY - 3, HZ - 0.6], [1.2, 8, 1.2], "green"),
            cube([HX - 0.2, HY + 5, HZ - 0.2], [0.4, 1.5, 0.4], "chain"),
            cube([HX - 0.6, HY + 6.5, HZ - 0.6], [1.2, 8, 1.2], "grip"),
            cube([HX - 0.2, HY + 14.5, HZ - 0.2], [0.4, 1.5, 0.4], "chain"),
            cube([HX - 0.6, HY + 16, HZ - 0.6], [1.2, 8, 1.2], "green"),
        ]},
        {"name": "chain_spear", "parent": "rightArm", "pivot": [HX, HY, HZ], "cubes": [
            cube([HX - 0.5, HY - 6, HZ - 0.5], [1, 30, 1], "red_d"),
            cube([HX - 1, HY + 24, HZ - 0.3], [2, 6, 0.6], "steel"),
        ] + [cube([HX - 0.4 + (0.6 if i % 2 else -0.2), HY - 6 - 1.2 * i - 1, HZ - 0.4], [0.8, 1, 0.8], "chain") for i in range(9)]},
    ]
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": "geometry.jjk_toji", "texture_width": 64, "texture_height": 64,
                            "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": bones,
        }],
    }


# ---------------- ไอเทม ----------------
WEAPONS = {  # id -> (ชื่อไทย, damage, durability)
    "split_soul_katana": ("ดาบฟันวิญญาณ", 12, 900),
    "inverted_spear": ("หอกพลิกฟ้า", 10, 700),
    "chain_thousand": ("โซ่หมื่นลี้", 8, 700),
    "playful_cloud": ("ยูอุน (กระบองสามท่อน)", 11, 800),
    "pistol_9mm": ("ปืนพก 9 มม.", 6, 400),
}


def icon(name):
    im = Img(16, 16)
    OUT = (20, 20, 25)
    def line(pts, c):
        for x, y in pts:
            im.set(x, y, c)
    diag = [(i, 15 - i) for i in range(2, 14)]
    if name == "split_soul_katana":
        line(diag[3:], (235, 240, 250)); line([(x + 1, y) for x, y in diag[3:]], (150, 155, 170))
        line(diag[:3], (60, 40, 30)); im.set(5, 9, (200, 170, 60)); im.set(4, 10, (200, 170, 60)); im.set(6, 10, (200, 170, 60))
    elif name == "inverted_spear":
        line(diag, (110, 25, 25)); line([(12, 3), (13, 2), (13, 3), (14, 2), (12, 2), (14, 4)], (190, 195, 205))
    elif name == "chain_thousand":
        for i, (x, y) in enumerate(diag):
            im.set(x, y, (150, 150, 160) if i % 2 == 0 else (95, 95, 105))
            if i % 2 == 0: im.set(x + 1, y, (95, 95, 105))
    elif name == "playful_cloud":
        for s, e, c in ((2, 5, (40, 110, 70)), (6, 9, (40, 40, 45)), (10, 13, (40, 110, 70))):
            line(diag[s - 2:e - 1], c)
        im.set(6, 11, (150, 150, 160)); im.set(10, 7, (150, 150, 160))
    elif name == "pistol_9mm":
        im.rect(2, 5, 11, 3, (120, 125, 135)); im.rect(3, 5, 9, 1, (190, 195, 205))
        im.rect(3, 8, 3, 5, (40, 40, 45)); im.rect(7, 8, 2, 1, (40, 40, 45))
    im.save(f"RP/textures/items/jjk_{name}.png")


def build_items():
    tex = {}
    for wid, (th, dmg, dur) in WEAPONS.items():
        icon(wid)
        tex[f"jjk_{wid}"] = {"textures": f"textures/items/jjk_{wid}"}
        wj(f"BP/items/{wid}.json", {
            "format_version": ITEM_FV,
            "minecraft:item": {
                "description": {"identifier": f"jjk:{wid}",
                                "menu_category": {"category": "equipment", "group": "itemGroup.name.sword"}},
                "components": {
                    "minecraft:icon": {"textures": {"default": f"jjk_{wid}"}},
                    "minecraft:max_stack_size": 1,
                    "minecraft:hand_equipped": True,
                    "minecraft:damage": dmg,
                    "minecraft:durability": {"max_durability": dur},
                },
            },
        })
    wj("RP/textures/item_texture.json", {"resource_pack_name": "jjk", "texture_name": "atlas.items", "texture_data": tex})
    wj("BP/loot_tables/entities/toji.json", {"pools": [{"rolls": 1, "entries": (
        [{"type": "item", "name": f"jjk:{w}", "weight": 1} for w in WEAPONS] + [{"type": "empty", "weight": 5}])}]})


# ---------------- เอนทิตีโทจิ ----------------
def build_entity():
    wj("BP/entities/toji.json", {
        "format_version": ENTITY_FV,
        "minecraft:entity": {
            "description": {
                "identifier": "jjk:toji", "is_spawnable": True, "is_summonable": True,
                "properties": {"jjk:weapon": {"type": "int", "range": [0, 5], "default": 0, "client_sync": True}},
            },
            "components": {
                "minecraft:type_family": {"family": ["toji", "monster"]},
                "minecraft:health": {"value": 300, "max": 300},
                "minecraft:attack": {"damage": 10},
                "minecraft:movement": {"value": 0.34},
                "minecraft:knockback_resistance": {"value": 0.8},
                "minecraft:follow_range": {"value": 40, "max": 40},
                "minecraft:collision_box": {"width": 0.7, "height": 1.95},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:navigation.walk": {"can_path_over_water": False, "avoid_damage_blocks": True},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True},
                "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
                "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 12},
                "minecraft:behavior.random_look_around": {"priority": 8},
                "minecraft:behavior.hurt_by_target": {"priority": 1},
                "minecraft:behavior.nearest_attackable_target": {
                    "priority": 2, "must_see": False,
                    "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 40}],
                },
                "minecraft:loot": {"table": "loot_tables/entities/toji.json"},
            },
        },
    })
    wj("BP/spawn_rules/toji.json", {
        "format_version": "1.8.0",
        "minecraft:spawn_rules": {
            "description": {"identifier": "jjk:toji", "population_control": "monster"},
            "conditions": [{
                "minecraft:spawns_on_surface": {},
                "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": False},
                "minecraft:weight": {"default": 3},
                "minecraft:herd": {"min_size": 1, "max_size": 1},
                "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": "overworld"},
            }],
        },
    })
    wj("RP/entity/toji.entity.json", {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "jjk:toji",
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": "textures/entity/toji"},
            "geometry": {"default": "geometry.jjk_toji"},
            "animations": {"walk": "animation.jjk_toji.walk", "raise": "animation.jjk_toji.raise"},
            "scripts": {"animate": ["walk", {"raise": "query.property('jjk:weapon') > 0"}]},
            "render_controllers": ["controller.render.jjk_toji"],
            "spawn_egg": {"base_color": "#1c1c22", "overlay_color": "#7a3cad"},
        }},
    })
    names = ["sword", "spear", "pistol", "yuun", "chain_spear"]
    wj("RP/render_controllers/toji.render_controllers.json", {
        "format_version": "1.8.0",
        "render_controllers": {"controller.render.jjk_toji": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
            "part_visibility": [{"*": True}] + [{n: f"query.property('jjk:weapon') == {i + 1}"} for i, n in enumerate(names)],
        }},
    })
    swing = lambda sign: [f"math.cos(query.modified_distance_moved * 38.17) * {sign * 35}", 0, 0]
    wj("RP/animations/toji.animation.json", {
        "format_version": "1.8.0",
        "animations": {
            "animation.jjk_toji.walk": {"loop": True, "bones": {
                "leftArm": {"rotation": swing(-1)}, "rightArm": {"rotation": swing(1)},
                "leftLeg": {"rotation": swing(1)}, "rightLeg": {"rotation": swing(-1)}}},
            "animation.jjk_toji.raise": {"loop": True, "bones": {"rightArm": {"rotation": [-70, 0, 0]}}},
        },
    })


def build_lang_and_misc():
    lines = ["entity.jjk:toji.name=โทจิ", "item.spawn_egg.entity.jjk:toji.name=ไข่เกิด โทจิ"]
    lines += [f"item.jjk:{w}={v[0]}" for w, v in WEAPONS.items()]
    txt = "\n".join(lines) + "\n"
    for lang in ("en_US", "th_TH"):
        wt(f"RP/texts/{lang}.lang", txt)
    wj("RP/texts/languages.json", ["en_US", "th_TH"])
    wj("RP/manifest.json", {
        "format_version": 2,
        "header": {"name": "JJK Toji (RP)", "description": "Toji resource pack", "uuid": U("rp-header"),
                   "version": [1, 0, 0], "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": U("rp-module"), "version": [1, 0, 0], "description": "resources"}],
    })
    wj("BP/manifest.json", {
        "format_version": 2,
        "header": {"name": "JJK Toji (BP)", "description": "Toji mob + 5 weapons", "uuid": U("bp-header"),
                   "version": [1, 0, 0], "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": U("bp-data"), "version": [1, 0, 0], "description": "data"},
            {"type": "script", "language": "javascript", "uuid": U("bp-script"), "version": [1, 0, 0],
             "entry": "scripts/main.js", "description": "toji ai"},
        ],
        "dependencies": [
            {"uuid": U("rp-header"), "version": [1, 0, 0]},
            {"module_name": "@minecraft/server", "version": SERVER_VER},
        ],
    })
    # สำรอง: /function hp  (ใช้ได้แม้คำสั่ง /jjk:hp ไม่ทำงาน)
    wt("BP/functions/hp.mcfunction", "effect @s health_boost 1000000 49 true\neffect @s instant_health 1 6 true\n")


# ---------------- ตรวจ + แพ็ก ----------------
def validate():
    errs, ids = [], set()
    for base in (BP, RP):
        for d, _, fs in os.walk(base):
            for fn in fs:
                p = os.path.join(d, fn)
                if fn.endswith(".json"):
                    try:
                        json.load(open(p, encoding="utf-8"))
                    except Exception as e:
                        errs.append(f"JSON เสีย {p}: {e}")
    uu = [U(k) for k in ("rp-header", "rp-module", "bp-header", "bp-data", "bp-script")]
    if len(set(uu)) != len(uu):
        errs.append("UUID ซ้ำ")
    lang = open(os.path.join(RP, "texts/en_US.lang"), encoding="utf-8").read()
    for w in WEAPONS:
        for need in (f"item.jjk:{w}=", ):
            if need not in lang: errs.append(f"lang ขาด {need}")
        if not os.path.exists(os.path.join(RP, f"textures/items/jjk_{w}.png")): errs.append(f"icon ขาด {w}")
        if not os.path.exists(os.path.join(BP, f"items/{w}.json")): errs.append(f"item ขาด {w}")
    g = json.load(open(os.path.join(RP, "models/entity/toji.geo.json")))
    bones = {b["name"] for b in g["minecraft:geometry"][0]["bones"]}
    rc = json.load(open(os.path.join(RP, "render_controllers/toji.render_controllers.json")))
    for pv in rc["render_controllers"]["controller.render.jjk_toji"]["part_visibility"][1:]:
        for k in pv:
            if k not in bones: errs.append(f"bone ไม่พบ {k}")
    for b in g["minecraft:geometry"][0]["bones"]:
        p = b.get("parent")
        if p and p not in bones: errs.append(f"parent ไม่พบ {p}")
        for c in b["cubes"]:
            if isinstance(c["uv"], list):
                u, v = c["uv"]; w_, h_, d_ = c["size"]
                if u + 2 * d_ + 2 * w_ > 64 or v + d_ + h_ > 64: errs.append(f"UV ล้น {b['name']}")
    for s in ("main.js", "ai.js"):
        if not os.path.exists(os.path.join(BP, "scripts", s)): errs.append(f"script ขาด {s}")
    return errs


def pack():
    out = os.path.join(ROOT, "dist")
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "JJK_Toji.mcaddon")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for base, top in ((BP, "JJK_Toji_BP"), (RP, "JJK_Toji_RP")):
            for d, _, fs in os.walk(base):
                for fn in sorted(fs):
                    p = os.path.join(d, fn)
                    z.write(p, os.path.join(top, os.path.relpath(p, base)))
    return path


if __name__ == "__main__":
    paint_entity_texture()
    wj("RP/models/entity/toji.geo.json", geo())
    build_items(); build_entity(); build_lang_and_misc()
    e = validate()
    if e:
        print("\n".join(e)); sys.exit(1)
    print("OK ->", pack())
