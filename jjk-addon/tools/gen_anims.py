#!/usr/bin/env python3
"""Animations, shared animation controllers and client-entity wiring for Gojo & Toji.

Conventions (Bedrock): negative X on an arm swings the hand forward; positive X on
`waist` leans the upper body forward. Rotations from overlapping animations add up.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"


def kf(frames):
    """{time: [x,y,z]} -> smooth catmull-rom keyframes."""
    return {f"{t:g}": {"post": v, "lerp_mode": "catmullrom"} for t, v in frames.items()}


def sin(speed, amp, phase=0, off=0):
    s = f"math.sin(q.anim_time * {speed} + {phase}) * {amp}"
    return f"{off} + {s}" if off else s


WALK_TIME = "q.anim_time + q.delta_time * math.clamp(q.ground_speed / 2.2, 0.6, 1.5)"
RUN_TIME = "q.anim_time + q.delta_time * math.clamp(q.ground_speed / 3.0, 1.0, 2.2)"


def common(name, run_lean, run_arms_back, attack, death_extra=None):
    A = {}
    A["idle"] = {
        "loop": True, "animation_length": 4,
        "bones": {
            "waist": {"rotation": [sin(90, 0.8), 0, 0]},
            "head": {"rotation": [sin(90, 1.2, 60), sin(45, 3), 0]},
            "rightArm": {"rotation": [sin(90, 2, 30), 0, sin(90, 1.5, 0, 3)]},
            "leftArm": {"rotation": [sin(90, 2, 210), 0, sin(90, -1.5, 0, -3)]},
            "hair": {"rotation": [0, 0, sin(180, 1)]},
            "belt": {"rotation": [sin(90, 2), 0, 0]},
        },
    }
    A["walk"] = {
        "loop": True, "animation_length": 1, "anim_time_update": WALK_TIME,
        "bones": {
            "rightLeg": {"rotation": [sin(360, 30), 0, 0]},
            "leftLeg": {"rotation": [sin(360, -30), 0, 0]},
            "rightArm": {"rotation": [sin(360, -24), 0, 0]},
            "leftArm": {"rotation": [sin(360, 24), 0, 0]},
            "waist": {"rotation": [2, sin(360, 4), 0]},
            "root": {"position": [0, "math.abs(math.sin(q.anim_time * 360)) * 0.5", 0]},
            "hair": {"rotation": [sin(720, 2), 0, 0]},
            "belt": {"rotation": [sin(720, 4), 0, 0]},
        },
    }
    arm_r = f"{run_arms_back} + math.sin(q.anim_time * 360) * -40"
    arm_l = f"{run_arms_back} + math.sin(q.anim_time * 360) * 40"
    A["run"] = {
        "loop": True, "animation_length": 1, "anim_time_update": RUN_TIME,
        "bones": {
            "rightLeg": {"rotation": [sin(360, 50), 0, 0]},
            "leftLeg": {"rotation": [sin(360, -50), 0, 0]},
            "rightArm": {"rotation": [arm_r, 0, 8]},
            "leftArm": {"rotation": [arm_l, 0, -8]},
            "waist": {"rotation": [run_lean, sin(360, 6), 0]},
            "head": {"rotation": [-run_lean * 0.85, 0, 0]},
            "root": {"position": [0, "math.abs(math.sin(q.anim_time * 360)) * 0.9 - 0.3", 0]},
            "hair": {"rotation": [sin(720, 3, 0, -8), 0, 0]},
            "belt": {"rotation": [sin(720, 6, 0, 10), 0, 0]},
        },
        "particle_effects": {"0.0": {"effect": "run_dust", "locator": "feet"},
                             "0.5": {"effect": "run_dust", "locator": "feet"}},
    }
    A["attack"] = attack
    A["hurt"] = {
        "loop": False, "animation_length": 0.35,
        "bones": {
            "waist": {"rotation": kf({0: [0, 0, 0], 0.08: [-10, 0, 4], 0.35: [0, 0, 0]})},
            "head": {"rotation": kf({0: [0, 0, 0], 0.08: [-12, 0, 0], 0.35: [0, 0, 0]})},
            "rightArm": {"rotation": kf({0: [0, 0, 0], 0.08: [-8, 0, 12], 0.35: [0, 0, 0]})},
            "leftArm": {"rotation": kf({0: [0, 0, 0], 0.08: [-8, 0, -12], 0.35: [0, 0, 0]})},
        },
    }
    A["death"] = {
        "loop": "hold_on_last_frame", "animation_length": 1.2,
        "bones": {
            "waist": {"rotation": kf({0: [0, 0, 0], 0.4: [-18, 0, 0], 1.2: [-25, 0, 0]})},
            "head": {"rotation": kf({0: [0, 0, 0], 0.4: [-20, 0, 0], 1.2: [-30, 0, 0]})},
            "rightArm": {"rotation": kf({0: [0, 0, 0], 0.5: [-15, 0, 20], 1.2: [-10, 0, 25]})},
            "leftArm": {"rotation": kf({0: [0, 0, 0], 0.5: [-15, 0, -20], 1.2: [-10, 0, -25]})},
            "rightLeg": {"rotation": kf({0: [0, 0, 0], 1.2: [12, 0, 4]})},
            "leftLeg": {"rotation": kf({0: [0, 0, 0], 1.2: [6, 0, -4]})},
        },
        "particle_effects": {"0.05": {"effect": "death_burst", "locator": "center"}},
    }
    if death_extra:
        A["death"]["bones"].update(death_extra)
    return {f"animation.jjk.{name}.{k}": v for k, v in A.items()}


GOJO_ATTACK = {  # straight right punch with a guard hand
    "loop": False, "animation_length": 0.55,
    "bones": {
        "rightArm": {"rotation": kf({0: [0, 0, 0], 0.12: [25, -10, 10], 0.22: [-95, 15, 0],
                                     0.36: [-85, 10, 0], 0.55: [0, 0, 0]})},
        "leftArm": {"rotation": kf({0: [0, 0, 0], 0.12: [-25, 0, -10], 0.22: [15, 0, -6], 0.55: [0, 0, 0]})},
        "waist": {"rotation": kf({0: [0, 0, 0], 0.12: [0, 18, 0], 0.22: [6, -22, 0], 0.55: [0, 0, 0]})},
    },
    "particle_effects": {"0.22": {"effect": "hit", "locator": "hand_r"}},
    "sound_effects": {"0.16": {"effect": "attack"}},
}
TOJI_ATTACK = {  # overhead diagonal katana slash
    "loop": False, "animation_length": 0.6,
    "bones": {
        "rightArm": {"rotation": kf({0: [0, 0, 0], 0.14: [-165, 10, 25], 0.26: [-40, -20, -35],
                                     0.4: [-25, -15, -30], 0.6: [0, 0, 0]})},
        "leftArm": {"rotation": kf({0: [0, 0, 0], 0.14: [-30, 0, -15], 0.26: [15, 0, -5], 0.6: [0, 0, 0]})},
        "waist": {"rotation": kf({0: [0, 0, 0], 0.14: [0, 28, 0], 0.26: [10, -32, 0], 0.6: [0, 0, 0]})},
    },
    "particle_effects": {"0.24": {"effect": "hit", "locator": "slash"}},
    "sound_effects": {"0.18": {"effect": "attack"}},
}

# Shared controllers. Movement blends by weight (no hard cuts): v.fight is a smoothed
# 0..1 of the synced property jjk:fighting, so walk -> run fades in combat.
MOVING = "math.clamp(q.ground_speed * 1.2, 0, 1)"
CONTROLLERS = {
    "controller.animation.jjk.move": {
        "initial_state": "default",
        "states": {
            "default": {
                "animations": [
                    {"idle": f"1.0 - {MOVING}"},
                    {"walk": f"{MOVING} * (1.0 - v.fight)"},
                    {"run": f"{MOVING} * v.fight"},
                ],
                "transitions": [{"dead": "!q.is_alive"}],
                "blend_transition": 0.2,
            },
            "dead": {"animations": ["death"], "blend_transition": 0.15},
        },
    },
    "controller.animation.jjk.attack": {
        "initial_state": "default",
        "states": {
            "default": {"transitions": [{"swing": "v.attack_time > 0 && v.attack_time < 0.2 && q.is_alive"}]},
            "swing": {"animations": ["attack"], "transitions": [{"default": "q.all_animations_finished"}],
                      "blend_transition": 0.08},
        },
    },
    "controller.animation.jjk.hurt": {
        "initial_state": "default",
        "states": {
            "default": {"transitions": [{"hurt": "q.hurt_time > 0 && q.is_alive"}]},
            "hurt": {"animations": ["hurt"], "transitions": [{"default": "q.hurt_time <= 0"}],
                     "blend_transition": 0.1},
        },
    },
    "controller.animation.jjk.gojo_fx": {  # Six Eyes glow always; Infinity aura in combat
        "initial_state": "calm",
        "states": {
            "calm": {
                "particle_effects": [{"effect": "eye_glow", "locator": "eye_l"},
                                     {"effect": "eye_glow", "locator": "eye_r"}],
                "transitions": [{"combat": "q.property('jjk:fighting') && q.is_alive"}, {"dead": "!q.is_alive"}],
            },
            "combat": {
                "particle_effects": [{"effect": "eye_glow", "locator": "eye_l"},
                                     {"effect": "eye_glow", "locator": "eye_r"},
                                     {"effect": "aura", "locator": "center"}],
                "transitions": [{"calm": "!q.property('jjk:fighting') && q.is_alive"}, {"dead": "!q.is_alive"}],
            },
            "dead": {},
        },
    },
}

ENTITY = {
    "gojo": {
        "particles": {"eye_glow": "jjk:gojo_eye_glow", "aura": "jjk:gojo_aura", "run_dust": "jjk:run_dust",
                      "hit": "jjk:gojo_hit", "death_burst": "jjk:gojo_death"},
        "fx": "controller.animation.jjk.gojo_fx",
    },
    "toji": {
        "particles": {"run_dust": "jjk:run_dust", "hit": "jjk:toji_slash", "death_burst": "jjk:toji_death"},
        "fx": None,
    },
}


def wire(name):
    f = RP / f"entity/{name}.entity.json"
    j = json.loads(f.read_text())
    d = j["minecraft:client_entity"]["description"]
    anims = {k: f"animation.jjk.{name}.{k}" for k in ("idle", "walk", "run", "attack", "hurt", "death")}
    anims.update({
        "look_at": "animation.common.look_at_target",
        "move_ctrl": "controller.animation.jjk.move",
        "attack_ctrl": "controller.animation.jjk.attack",
        "hurt_ctrl": "controller.animation.jjk.hurt",
    })
    animate = ["look_at", "move_ctrl", "attack_ctrl", "hurt_ctrl"]
    if ENTITY[name]["fx"]:
        anims["fx_ctrl"] = ENTITY[name]["fx"]
        animate.append("fx_ctrl")
    d["animations"] = anims
    d["scripts"] = {
        "initialize": ["v.fight = 0.0;"],
        "pre_animation": ["v.fight = math.lerp(v.fight, q.property('jjk:fighting') ? 1.0 : 0.0, 0.12);"],
        "animate": animate,
    }
    d["particle_effects"] = ENTITY[name]["particles"]
    d["sound_effects"] = {"attack": f"jjk.{name}.attack"}
    f.write_text(json.dumps(j, indent=2, ensure_ascii=False) + "\n")


def main():
    (RP / "animations").mkdir(exist_ok=True)
    (RP / "animation_controllers").mkdir(exist_ok=True)
    files = {
        "gojo": common("gojo", run_lean=14, run_arms_back=0, attack=GOJO_ATTACK),
        "toji": common("toji", run_lean=28, run_arms_back=35, attack=TOJI_ATTACK),
    }
    for name, anims in files.items():
        (RP / f"animations/{name}.animation.json").write_text(
            json.dumps({"format_version": "1.8.0", "animations": anims}, indent=2) + "\n")
        wire(name)
    (RP / "animation_controllers/jjk.animation_controllers.json").write_text(
        json.dumps({"format_version": "1.10.0", "animation_controllers": CONTROLLERS}, indent=2) + "\n")


if __name__ == "__main__":
    main()
