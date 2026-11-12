#!/usr/bin/env python3
"""Particle texture atlas + particle effects (format 1.10.0)."""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
TEX = "textures/particle/jjk_particles"
AGE = "v.particle_age / v.particle_lifetime"


def atlas():
    """64x16: [0] soft dot, [1] 4-point sparkle, [2] streak, [3] smoke puff."""
    img = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            r = math.hypot(dx, dy)
            a = max(0.0, 1 - r / 7.5) ** 1.6                                   # dot
            img.putpixel((x, y), (255, 255, 255, int(255 * a)))
            s = max(0.0, 1 - (abs(dx) * abs(dy)) / 6 - r / 9)                  # sparkle
            img.putpixel((16 + x, y), (255, 255, 255, int(255 * min(1, s * 1.4))))
            st = max(0.0, 1 - abs(dy) / 2.2) * max(0.0, 1 - abs(dx) / 8)        # streak
            img.putpixel((32 + x, y), (255, 255, 255, int(255 * st)))
            n = (math.sin(x * 1.7) + math.cos(y * 1.3)) * 0.08                  # smoke
            sm = max(0.0, 1 - r / 7.2 + n) ** 1.2
            img.putpixel((48 + x, y), (255, 255, 255, int(200 * min(1, sm))))
    out = RP / f"{TEX}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)


def sprite(i):
    return {"texture_width": 64, "texture_height": 16, "uv": [16 * i, 0], "uv_size": [16, 16]}


def particle(ident, material, comps):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": ident,
                        "basic_render_parameters": {"material": material, "texture": TEX}},
        "components": comps}}


def tint(start, end):
    return {"minecraft:particle_appearance_tinting": {
        "color": {"interpolant": AGE, "gradient": {"0.0": start, "1.0": end}}}}


def bill(i, size, mode="rotate_xyz"):
    return {"minecraft:particle_appearance_billboard": {
        "size": size, "facing_camera_mode": mode, "uv": sprite(i)}}


def burst(n):
    return {"minecraft:emitter_rate_instant": {"num_particles": n},
            "minecraft:emitter_lifetime_once": {"active_time": 0.1}}


def steady(rate, cap):
    return {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": cap},
            "minecraft:emitter_lifetime_looping": {"active_time": 1}}


LOCAL = {"minecraft:emitter_local_space": {"position": True, "rotation": True}}

EFFECTS = {
    "gojo_eye_glow": particle("jjk:gojo_eye_glow", "particles_add", {
        **steady(12, 8), **LOCAL,
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
        "minecraft:particle_initial_speed": 0,
        **bill(0, [f"0.11 * (1 - {AGE}) + 0.03", f"0.11 * (1 - {AGE}) + 0.03"]),
        **tint("#FFBDF2FF", "#0050B4FF"),
    }),
    "gojo_aura": particle("jjk:gojo_aura", "particles_add", {
        **steady(16, 30), **LOCAL,
        "minecraft:emitter_shape_box": {"half_dimensions": [0.45, 0.95, 0.3], "surface_only": True,
                                        "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_1 * 0.4"},
        "minecraft:particle_initial_speed": 0.15,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.9, 0], "linear_drag_coefficient": 1.5},
        **bill(0, [f"0.09 + 0.05 * {AGE}", f"0.09 + 0.05 * {AGE}"]),
        **tint("#CC8CDCFF", "#002A7DE6"),
    }),
    "run_dust": particle("jjk:run_dust", "particles_blend", {
        **burst(5),
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.45 + v.particle_random_1 * 0.3"},
        "minecraft:particle_initial_speed": 1.0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 3},
        **bill(3, [f"0.14 + 0.14 * {AGE}", f"0.14 + 0.14 * {AGE}"]),
        **tint("#99B4AA9B", "#00B4AA9B"),
    }),
    "gojo_hit": particle("jjk:gojo_hit", "particles_add", {
        **burst(16),
        "minecraft:emitter_shape_sphere": {"radius": 0.1, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.2 + v.particle_random_1 * 0.12"},
        "minecraft:particle_initial_speed": "3 + v.particle_random_2 * 2",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 7},
        **bill(1, [f"0.16 * (1 - {AGE})", f"0.16 * (1 - {AGE})"]),
        **tint("#FFFFFFFF", "#0046AAFF"),
    }),
    # Arc of streaks tangent to a diagonal circle in front of Toji = sword trail.
    "toji_slash": particle("jjk:toji_slash", "particles_add", {
        **burst(22), **LOCAL,
        "minecraft:emitter_shape_custom": {
            "offset": ["math.cos(-40 + v.particle_random_1 * 170) * 1.1",
                       "math.sin(-40 + v.particle_random_1 * 170) * 1.1", 0],
            "direction": ["-math.sin(-40 + v.particle_random_1 * 170)",
                          "math.cos(-40 + v.particle_random_1 * 170)", 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.16 + v.particle_random_2 * 0.08"},
        "minecraft:particle_initial_speed": 2.5,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 8},
        **bill(2, [f"0.42 * (1 - {AGE} * 0.6)", "0.06"], mode="lookat_direction"),
        **tint("#FFFFFFFF", "#00C8D2E6"),
    }),
    "gojo_death": particle("jjk:gojo_death", "particles_add", {
        **burst(40),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": "1.5 + v.particle_random_2",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 2},
        **bill(1, [f"0.14 * (1 - {AGE})", f"0.14 * (1 - {AGE})"]),
        **tint("#FFE6FAFF", "#003C9BFF"),
    }),
    "toji_death": particle("jjk:toji_death", "particles_blend", {
        **burst(30),
        "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1.0 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_speed": 0.8,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.7, 0], "linear_drag_coefficient": 2},
        **bill(3, [f"0.2 + 0.25 * {AGE}", f"0.2 + 0.25 * {AGE}"]),
        **tint("#CC3C2350", "#00140A1E"),
    }),
}


def main():
    atlas()
    d = RP / "particles"
    d.mkdir(exist_ok=True)
    for name, j in EFFECTS.items():
        (d / f"{name}.json").write_text(json.dumps(j, indent=2) + "\n")


if __name__ == "__main__":
    main()
