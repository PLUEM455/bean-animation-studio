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


def once(length, bones, loop=False, **extra):
    """non-looping skill animation; bones: {bone: {channel: {time: [x,y,z]}}}"""
    out = {"loop": loop, "animation_length": length, "bones": {}}
    for b, chans in bones.items():
        out["bones"][b] = {ch: (kf(v) if isinstance(v, dict) else v) for ch, v in chans.items()}
    out.update(extra)
    return out


Z = [0, 0, 0]
CHAIN_SPEED = "math.clamp(8 / math.max(4, q.property('jjk:chain_len')), 0.4, 2.0)"

GOJO_SKILLS = {
    "combo": once(0.9, {
        "rightArm": {"rotation": {0: Z, 0.15: [20, -10, 10], 0.25: [-95, 15, 0], 0.35: [-20, 0, 5],
                                  0.65: [30, -10, 10], 0.75: [-110, 10, 0], 0.9: Z}},
        "leftArm": {"rotation": {0: Z, 0.4: [20, 10, -10], 0.5: [-95, -15, 0], 0.6: [-10, 0, -5], 0.9: Z}},
        "waist": {"rotation": {0: Z, 0.15: [0, 15, 0], 0.25: [5, -20, 0], 0.4: [0, -15, 0], 0.5: [5, 20, 0],
                               0.65: [0, 15, 0], 0.75: [8, -25, 0], 0.9: Z}},
    }),
    "black_flash": once(0.5, {
        "rightArm": {"rotation": {0: Z, 0.1: [40, -20, 15], 0.15: [-100, 10, 0], 0.35: [-90, 10, 0], 0.5: Z}},
        "leftArm": {"rotation": {0: Z, 0.1: [-30, 0, -15], 0.15: [25, 0, -10], 0.5: Z}},
        "waist": {"rotation": {0: Z, 0.1: [-5, 25, 0], 0.15: [12, -30, 0], 0.5: Z}},
        "hair": {"rotation": {0: Z, 0.15: [-12, 0, 0], 0.5: Z}},
    }),
    "blue": once(1.2, {
        "rightArm": {"rotation": {0: Z, 0.3: [-85, -20, 0], 1.0: [-80, -20, 0], 1.2: Z}},
        "leftArm": {"rotation": {0: Z, 0.3: [-10, 0, -10], 1.2: Z}},
        "head": {"rotation": {0: Z, 0.3: [-5, 0, 0], 1.2: Z}},
    }),
    "red": once(0.8, {
        "rightArm": {"rotation": {0: Z, 0.2: [-70, 30, -30], 0.4: [-90, -5, 0], 0.8: Z}},
        "leftArm": {"rotation": {0: Z, 0.2: [-30, 0, -10], 0.8: Z}},
        "waist": {"rotation": {0: Z, 0.2: [0, 20, 0], 0.4: [4, -10, 0], 0.8: Z}},
    }),
    "pull": once(0.7, {
        "rightArm": {"rotation": {0: Z, 0.15: [-90, 0, 0], 0.3: [-40, 0, 0], 0.45: [-95, 10, 0], 0.7: Z}},
        "waist": {"rotation": {0: Z, 0.3: [-6, 15, 0], 0.45: [8, -20, 0], 0.7: Z}},
    }),
    "purple_charge": once(1.5, {
        "rightArm": {"rotation": {0: Z, 0.4: [-80, 25, 0], 1.5: [-85, 8, 0]}},
        "leftArm": {"rotation": {0: Z, 0.4: [-80, -25, 0], 1.5: [-85, -8, 0]}},
        "waist": {"rotation": {0: Z, 0.4: [5, 0, 0], 1.5: [6, 0, 0]}},
        "hair": {"rotation": {0: Z, 1.5: [-6, 0, 0]}},
    }),
    "purple_fire": once(0.8, {
        "rightArm": {"rotation": {0: [-85, 8, 0], 0.1: [-95, 0, 0], 0.5: [-90, 0, 0], 0.8: Z}},
        "leftArm": {"rotation": {0: [-85, -8, 0], 0.1: [-95, 0, 0], 0.5: [-90, 0, 0], 0.8: Z}},
        "waist": {"rotation": {0: [6, 0, 0], 0.1: [-8, 0, 0], 0.8: Z}},
        "hair": {"rotation": {0: Z, 0.1: [-15, 0, 0], 0.8: Z}},
    }),
    "domain": once(1.2, {
        "rightArm": {"rotation": {0: Z, 0.4: [-130, -30, 30], 0.9: [-130, -30, 30], 1.2: Z}},
        "leftArm": {"rotation": {0: Z, 0.4: [-10, 0, -15], 1.2: Z}},
        "head": {"rotation": {0: Z, 0.4: [-10, 0, 0], 1.2: Z}},
    }),
    "blink": once(0.3, {
        "waist": {"rotation": {0: Z, 0.1: [20, 0, 0], 0.3: Z}},
        "root": {"position": {0: Z, 0.1: [0, -1.5, 0], 0.3: Z}},
    }),
    "rct": once(1.0, {
        "rightArm": {"rotation": {0: Z, 0.3: [-10, 0, 60], 0.7: [-10, 0, 55], 1.0: Z}},
        "leftArm": {"rotation": {0: Z, 0.3: [-10, 0, -60], 0.7: [-10, 0, -55], 1.0: Z}},
        "head": {"rotation": {0: Z, 0.3: [-20, 0, 0], 1.0: Z}},
    }),
}

TOJI_SKILLS = {
    "cloud": once(1.0, {
        "rightArm": {"rotation": {0: Z, 0.15: [-150, 30, 40], 0.25: [-40, -30, -40], 0.45: [-160, -20, -30],
                                  0.6: [-50, 30, 40], 0.85: [-20, 0, 0], 1.0: Z}},
        "waist": {"rotation": {0: Z, 0.15: [0, 30, 0], 0.25: [8, -30, 0], 0.45: [0, -25, 0], 0.6: [8, 30, 0], 1.0: Z}},
    }),
    "slam": once(0.9, {
        "rightArm": {"rotation": {0: Z, 0.3: [-175, 0, 10], 0.5: [-40, 0, 5], 0.75: [-40, 0, 5], 0.9: Z}},
        "leftArm": {"rotation": {0: Z, 0.3: [-170, 0, -10], 0.5: [-45, 0, -5], 0.75: [-45, 0, -5], 0.9: Z}},
        "waist": {"rotation": {0: Z, 0.3: [-15, 0, 0], 0.5: [30, 0, 0], 0.75: [25, 0, 0], 0.9: Z}},
        "root": {"position": {0: Z, 0.3: [0, 1.5, 0], 0.5: [0, -1, 0], 0.9: Z}},
    }),
    "fists": once(0.8, {
        "rightArm": {"rotation": {0: Z, 0.15: [20, -10, 10], 0.25: [-95, 15, 0], 0.35: [-20, 0, 5],
                                  0.65: [30, -10, 10], 0.75: [-110, 10, 0], 0.8: [-60, 0, 0]}},
        "leftArm": {"rotation": {0: Z, 0.4: [20, 10, -10], 0.5: [-95, -15, 0], 0.6: [-10, 0, -5], 0.8: Z}},
        "waist": {"rotation": {0: Z, 0.25: [8, -20, 0], 0.5: [8, 20, 0], 0.75: [10, -25, 0], 0.8: [5, -10, 0]}},
    }),
    "spear": once(0.6, {
        "rightArm": {"rotation": {0: Z, 0.12: [20, 0, 10], 0.25: [-90, 0, 0], 0.45: [-85, 0, 0], 0.6: Z}},
        "waist": {"rotation": {0: Z, 0.12: [-5, 20, 0], 0.25: [12, -15, 0], 0.6: Z}},
    }),
    "chain_aim": once(0.8, {
        "rightArm": {"rotation": {0: Z, 0.3: [-170, 0, 20], 0.5: [-100, 0, 0], 0.8: [-95, 0, 0]}},
        "waist": {"rotation": {0: Z, 0.3: [0, 25, 0], 0.5: [5, -20, 0], 0.8: [0, -10, 0]}},
    }, loop="hold_on_last_frame",
        anim_time_update="q.anim_time + q.delta_time * math.clamp(12 / math.max(12, q.property('jjk:chain_len')), 0.5, 1.0)"),
    "chain_sweep": once(1.0, {
        "rightArm": {"rotation": ["-160", "q.anim_time * 360", "15 + math.sin(q.anim_time * 360) * 10"]},
        "waist": {"rotation": [4, "math.sin(q.anim_time * 360) * 6", 0]},
        "head": {"rotation": ["-8", 0, 0]},
    }, loop=True, anim_time_update=f"q.anim_time + q.delta_time * {CHAIN_SPEED}"),
    "gun": once(0.9, {
        "rightArm": {"rotation": {0: Z, 0.15: [-90, 0, 0], 0.2: [-105, 0, 0], 0.3: [-90, 0, 0], 0.45: [-105, 0, 0],
                                  0.55: [-90, 0, 0], 0.7: [-105, 0, 0], 0.8: [-90, 0, 0], 0.9: Z}},
        "head": {"rotation": {0: Z, 0.15: [0, -5, 0], 0.8: [0, -5, 0], 0.9: Z}},
    }),
    "blitz": once(0.6, {
        "waist": {"rotation": {0: Z, 0.1: [35, 0, 0], 0.5: [35, 0, 0], 0.6: Z}},
        "rightArm": {"rotation": {0: Z, 0.1: [50, 0, 10], 0.5: [50, 0, 10], 0.6: Z}},
        "leftArm": {"rotation": {0: Z, 0.1: [50, 0, -10], 0.5: [50, 0, -10], 0.6: Z}},
        "head": {"rotation": {0: Z, 0.1: [-30, 0, 0], 0.5: [-30, 0, 0], 0.6: Z}},
        "root": {"position": {0: Z, 0.1: [0, -1, 0], 0.5: [0, -1, 0], 0.6: Z}},
    }),
    "backstab": once(0.5, {
        "rightArm": {"rotation": {0: [-30, 0, 0], 0.1: [20, 0, 15], 0.2: [-100, -10, -10], 0.35: [-90, 0, 0], 0.5: Z}},
        "waist": {"rotation": {0: Z, 0.1: [-5, 20, 0], 0.2: [12, -25, 0], 0.5: Z}},
    }),
    "inventory": once(0.4, {
        "head": {"rotation": {0: Z, 0.15: [25, -30, 0], 0.4: Z}},
        "rightArm": {"rotation": {0: Z, 0.15: [-160, 0, 20], 0.3: [-60, 0, 10], 0.4: Z}},
    }),
    "skm": once(1.0, {
        "head": {"rotation": {0: Z, 0.3: [-35, 0, 0], 0.8: [-30, 0, 0], 1.0: Z}},
        "rightArm": {"rotation": {0: Z, 0.3: [-20, 0, 45], 0.8: [-20, 0, 40], 1.0: Z}},
        "leftArm": {"rotation": {0: Z, 0.3: [-20, 0, -45], 0.8: [-20, 0, -40], 1.0: Z}},
        "waist": {"rotation": {0: Z, 0.3: [-12, 0, 0], 1.0: Z}},
    }),
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
    for name, extra in (("gojo", GOJO_SKILLS), ("toji", TOJI_SKILLS)):
        files[name].update({f"animation.jjk.{name}.{k}": v for k, v in extra.items()})
    for name, anims in files.items():
        (RP / f"animations/{name}.animation.json").write_text(
            json.dumps({"format_version": "1.8.0", "animations": anims}, indent=2) + "\n")
        wire(name)
    (RP / "animation_controllers/jjk.animation_controllers.json").write_text(
        json.dumps({"format_version": "1.10.0", "animation_controllers": CONTROLLERS}, indent=2) + "\n")


if __name__ == "__main__":
    main()
