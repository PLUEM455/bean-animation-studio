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
        **bill(0, [f"0.16 + 0.08 * {AGE}", f"0.16 + 0.08 * {AGE}"]),
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
        **burst(28),
        "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.2 + v.particle_random_1 * 0.12"},
        "minecraft:particle_initial_speed": "3 + v.particle_random_2 * 2",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 7},
        **bill(1, [f"0.32 * (1 - {AGE})", f"0.32 * (1 - {AGE})"]),
        **tint("#FFFFFFFF", "#0046AAFF"),
    }),
    # Arc of streaks tangent to a diagonal circle in front of Toji = sword trail.
    "toji_slash": particle("jjk:toji_slash", "particles_add", {
        **burst(44), **LOCAL,
        "minecraft:emitter_shape_custom": {
            "offset": ["math.cos(-40 + v.particle_random_1 * 170) * 1.8",
                       "math.sin(-40 + v.particle_random_1 * 170) * 1.8", 0],
            "direction": ["-math.sin(-40 + v.particle_random_1 * 170)",
                          "math.cos(-40 + v.particle_random_1 * 170)", 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.16 + v.particle_random_2 * 0.08"},
        "minecraft:particle_initial_speed": 2.5,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 8},
        **bill(2, [f"0.8 * (1 - {AGE} * 0.6)", "0.1"], mode="lookat_direction"),
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


def mk(ident, material, spr, n, life, size, colors, speed=0.0, shape=None, accel=(0, 0, 0), drag=0.0,
       mode="rotate_xyz", grow=0.0):
    """one-shot burst particle. size shrinks to 0 unless grow>0 (then grows by `grow`)."""
    sz = f"{size} + {grow} * {AGE}" if grow else f"{size} * (1 - {AGE} * 0.85)"
    bb = bill(spr, [sz, sz] if mode != "lookat_direction" else [f"{size * 3} * (1 - {AGE})", f"{size * 0.4}"], mode)
    return particle(ident, material, {
        **burst(n),
        **(shape or {"minecraft:emitter_shape_sphere": {"radius": 0.1, "direction": "outwards"}}),
        "minecraft:particle_lifetime_expression": {"max_lifetime": f"{life} * (0.75 + v.particle_random_1 * 0.5)"},
        "minecraft:particle_initial_speed": f"{speed} * (0.6 + v.particle_random_2 * 0.8)" if speed else 0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": list(accel), "linear_drag_coefficient": drag},
        **bb, **tint(*colors),
    })


def sphere(r, direction="outwards", surface=False):
    return {"minecraft:emitter_shape_sphere": {"radius": r, "direction": direction, "surface_only": surface}}


ADD, BLEND = "particles_add", "particles_blend"
SKILL_FX = {
    # --- Gojo ---
    "blue_orb": mk("jjk:blue_orb", ADD, 0, 30, 0.35, 0.8, ("#FFDFF6FF", "#000F5AFF"), 3.5, sphere(1.4, "inwards", True)),
    "blue_core": mk("jjk:blue_core", ADD, 0, 1, 0.2, 2.2, ("#FFE6F8FF", "#0028A0FF")),
    "blue_swirl": mk("jjk:blue_swirl", ADD, 0, 1, 0.35, 0.28, ("#E664C8FF", "#001E50C8")),
    "red_orb": mk("jjk:red_orb", ADD, 0, 12, 0.25, 0.7, ("#FFFFD2B4", "#00C81E1E"), 0.8, sphere(0.45)),
    "red_burst": mk("jjk:red_burst", ADD, 0, 120, 0.7, 0.75, ("#FFFFE6B4", "#00B4140A"), 12, sphere(0.4), drag=4),
    "purple_beam": mk("jjk:purple_beam", ADD, 1, 6, 0.6, 0.9, ("#FFF0D2FF", "#005A0096"), 2, sphere(1.0, "random")),
    "purple_core": mk("jjk:purple_core", ADD, 0, 16, 0.5, 1.6, ("#FFFFFFFF", "#0078289B"), 2.5, sphere(0.8)),
    "beam_core": mk("jjk:beam_core", ADD, 0, 1, 0.35, 2.6, ("#FFFFF0FF", "#00961EC8")),
    "domain_shell": mk("jjk:domain_shell", BLEND, 0, 1, 0.7, 0.55, ("#F014081E", "#00140A28")),
    "domain_star": mk("jjk:domain_star", ADD, 1, 1, 1.2, 0.28, ("#FFFFFFFF", "#0096DCFF")),
    "void_fog": mk("jjk:void_fog", BLEND, 3, 1, 1.4, 2.6, ("#A00A0614", "#00000000"), grow=1.0),
    "black_flash": mk("jjk:black_flash", BLEND, 2, 60, 0.4, 0.6, ("#FF0A0A0F", "#00B4141E"), 9, sphere(0.2),
                      drag=5, mode="lookat_direction"),
    "lightning_black": mk("jjk:lightning_black", BLEND, 0, 1, 0.25, 0.26, ("#FF050508", "#00280A0A")),
    "lightning_red": mk("jjk:lightning_red", ADD, 0, 1, 0.25, 0.22, ("#FFFF2814", "#00780000")),
    "lightning_purple": mk("jjk:lightning_purple", ADD, 0, 1, 0.2, 0.2, ("#FFE6B4FF", "#005000A0")),
    "rct_aura": mk("jjk:rct_aura", ADD, 0, 10, 1.0, 0.25, ("#E6FFFFFF", "#00C8F0FF"), 0.5, sphere(0.6),
                   accel=(0, 1.4, 0)),
    "blink": mk("jjk:blink", ADD, 1, 40, 0.35, 0.3, ("#FFE6FFFF", "#003CA0FF"), 3.5, sphere(0.7), drag=4),
    "infinity_ripple": mk("jjk:infinity_ripple", ADD, 0, 28, 0.45, 0.25, ("#C8C8F5FF", "#0050A0FF"), 2.2,
                          sphere(0.5, "outwards", True), drag=3),
    "debris": mk("jjk:debris", BLEND, 3, 10, 1.0, 0.5, ("#CC8C8278", "#008C8278"), 2, sphere(0.5), drag=2, grow=0.4),
    # --- Toji ---
    "chain_link": mk("jjk:chain_link", BLEND, 0, 1, 0.1, 0.17, ("#FFD2D7E1", "#FF8C96A5")),
    "spear_tip": mk("jjk:spear_tip", ADD, 1, 3, 0.15, 0.38, ("#FFFFFFFF", "#00B4A0FF")),
    "negate": mk("jjk:negate", ADD, 1, 70, 0.6, 0.38, ("#FFFFFFFF", "#007828C8"), 7, sphere(0.4), drag=5),
    "muzzle": mk("jjk:muzzle", ADD, 0, 18, 0.12, 0.45, ("#FFFFF0A0", "#00FF781E"), 3, sphere(0.08)),
    "tracer": mk("jjk:tracer", ADD, 0, 1, 0.1, 0.11, ("#FFFFE6A0", "#00FFB43C")),
    "afterimage": mk("jjk:afterimage", BLEND, 3, 1, 0.45, 0.9, ("#C8281432", "#00140A1E"), grow=0.15),
    "skm_aura": mk("jjk:skm_aura", ADD, 0, 2, 0.6, 0.3, ("#E6FF3C28", "#00780A0A"), accel=(0, 1.8, 0)),
    "slam_dust": mk("jjk:slam_dust", BLEND, 3, 14, 1.0, 0.7, ("#CCA08C78", "#00A08C78"), 3.5, sphere(0.4),
                    drag=3, grow=0.6),
    "worm_spit": mk("jjk:worm_spit", BLEND, 0, 10, 0.5, 0.16, ("#FFA046C8", "#005A1E78"), 1.6, sphere(0.1),
                    accel=(0, -8, 0)),
    "cloud_trail": mk("jjk:cloud_trail", ADD, 2, 12, 0.25, 0.5, ("#FFFF6E5A", "#00961E1E"), 5, sphere(0.3),
                      drag=6, mode="lookat_direction"),
    # --- shared impact layers ---
    "flash": mk("jjk:flash", ADD, 0, 1, 0.14, 2.0, ("#FFFFFFFF", "#00FFFFFF")),
    "flash_big": mk("jjk:flash_big", ADD, 0, 1, 0.22, 5.5, ("#FFFFFFFF", "#00FFFFFF")),
    "sparks": mk("jjk:sparks", ADD, 2, 30, 0.5, 0.25, ("#FFFFF0B4", "#00FF6414"), 11, sphere(0.15),
                 accel=(0, -14, 0), drag=1.5, mode="lookat_direction"),
    "smoke_big": mk("jjk:smoke_big", BLEND, 3, 18, 2.2, 1.1, ("#B4504B46", "#00504B46"), 1.4, sphere(0.8),
                    accel=(0, 0.6, 0), drag=1.2, grow=1.6),
    "fireball": mk("jjk:fireball", ADD, 0, 18, 0.7, 1.4, ("#FFFFDC8C", "#00C81E0A"), 3.5, sphere(0.6), drag=3,
                   grow=0.8),
    "speed_line": mk("jjk:speed_line", ADD, 2, 1, 0.18, 0.5, ("#C8FFFFFF", "#00FFFFFF")),
    "ember": mk("jjk:ember", ADD, 0, 3, 0.9, 0.12, ("#FFFFA03C", "#00FF1E0A"), 0.6, sphere(0.5),
                accel=(0, 2.2, 0)),
}
# expanding flat rings (shockwaves): many fast particles leaving a disc in the ground plane
for key, col in (("shockwave", ("#DCF0F0F0", "#00A0A0A0")), ("shock_blue", ("#FFB4E6FF", "#001E64FF")),
                 ("shock_red", ("#FFFF8C64", "#00B4140A")), ("shock_purple", ("#FFE6B4FF", "#005A0096"))):
    SKILL_FX[key] = mk(f"jjk:{key}", ADD if key != "shockwave" else BLEND, 0, 64, 0.5, 0.5, col, 16,
                       {"minecraft:emitter_shape_disc": {"radius": 0.4, "plane_normal": [0, 1, 0],
                                                         "direction": "outwards", "surface_only": True}},
                       drag=3.2)
EFFECTS.update(SKILL_FX)


def main():
    atlas()
    d = RP / "particles"
    d.mkdir(exist_ok=True)
    for name, j in EFFECTS.items():
        (d / f"{name}.json").write_text(json.dumps(j, indent=2) + "\n")


if __name__ == "__main__":
    main()
