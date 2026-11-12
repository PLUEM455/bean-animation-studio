#!/usr/bin/env python3
"""Synthesised placeholder sounds (Vorbis .ogg) + sound_definitions.json + sounds.json.

To use your own audio: replace any file in resource_pack/sounds/jjk/ keeping the same
name (Ogg Vorbis, mono, 44.1 kHz). Existing files are never overwritten unless
this script is run with --force, so build.sh keeps your replacements.
"""
import json
import sys
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
SR = 44100
rng = np.random.default_rng(455)
FORCE = "--force" in sys.argv


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack, decay):
    """attack/decay in seconds; exponential decay."""
    x = np.arange(n) / SR
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(x - attack, 0) / decay)


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (Hz) for sweeps."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def tone(f0, f1, sec):
    """Sine gliding exponentially from f0 to f1."""
    x = t(sec)
    f = f0 * (f1 / f0) ** (x / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def place(buf, sig, at):
    i = int(at * SR)
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[: end - i]


def thud(pitch=1.0, sec=0.25):
    n = int(SR * sec)
    body = tone(110 * pitch, 45 * pitch, sec) * env(n, 0.003, 0.07)
    click = lowpass(noise(sec), 2500) * env(n, 0.001, 0.015) * 0.8
    return body + click


def whoosh(sec, f0, f1, peak=0.45):
    n = int(SR * sec)
    sweep = np.geomspace(f0, f1, n)
    w = highpass(lowpass(noise(sec), sweep), sweep * 0.35)
    shape = np.sin(np.pi * np.clip(np.arange(n) / (n * peak * 2), 0, 1)) ** 2
    shape[int(n * peak):] = np.linspace(1, 0, n - int(n * peak)) ** 1.5
    return w * shape


def metal_ring(sec, base=2100):
    n = int(SR * sec)
    out = np.zeros(n)
    for ratio, amp in ((1.0, 0.5), (1.62, 0.35), (2.47, 0.25), (3.9, 0.12)):
        out += amp * np.sin(2 * np.pi * base * ratio * t(sec))
    return out * env(n, 0.002, 0.12)


def finish(x, gain_db=-1.0):
    x = x - np.mean(x)
    fade = min(len(x), int(0.01 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(x)) or 1
    return x / peak * 10 ** (gain_db / 20)


# ---------- sound recipes ----------
def step(v):
    sec = 0.12
    n = int(SR * sec)
    s = lowpass(noise(sec), 900 + 250 * v) * env(n, 0.002, 0.03) + 0.6 * tone(95 + 10 * v, 60, sec) * env(n, 0.002, 0.04)
    return finish(s, -6)


def gojo_attack(v):
    buf = np.zeros(int(SR * 0.6))
    place(buf, whoosh(0.2, 600, 3200 + 400 * v) * 0.7, 0.0)
    place(buf, thud(0.9 + 0.08 * v, 0.3) * 1.0, 0.16)
    shimmer = np.sin(2 * np.pi * (1760 + 220 * v) * t(0.4)) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t(0.4)))
    place(buf, shimmer * env(len(shimmer), 0.005, 0.12) * 0.18, 0.16)  # Infinity shimmer
    return finish(buf)


def toji_attack(v):
    buf = np.zeros(int(SR * 0.6))
    place(buf, whoosh(0.16, 1500, 9000 + 800 * v, peak=0.3), 0.0)
    place(buf, metal_ring(0.45, 2000 + 180 * v) * 0.25, 0.04)
    return finish(buf)


def hurt(pitch):
    def make(v):
        sec = 0.35
        n = int(SR * sec)
        grunt = lowpass(noise(sec), 500) * env(n, 0.01, 0.08) * 0.8
        voice = tone(170 * pitch * (1 + 0.06 * v), 120 * pitch, sec) * env(n, 0.01, 0.09) * 0.5
        return finish(thud(pitch, sec) + grunt + voice)
    return make


def gojo_death(_):
    buf = np.zeros(int(SR * 1.6))
    sec = 1.4
    n = int(SR * sec)
    place(buf, tone(1400, 180, sec) * env(n, 0.02, 0.5) * 0.4, 0.0)
    place(buf, tone(1870, 240, sec) * env(n, 0.02, 0.45) * 0.25, 0.0)
    place(buf, thud(0.6, 0.6), 0.05)
    place(buf, lowpass(noise(1.2), 1200) * env(int(SR * 1.2), 0.2, 0.35) * 0.3, 0.1)
    return finish(buf)


def toji_death(_):
    buf = np.zeros(int(SR * 1.4))
    place(buf, thud(0.5, 0.7) * 1.2, 0.0)
    place(buf, lowpass(noise(1.2), 400) * env(int(SR * 1.2), 0.05, 0.4) * 0.6, 0.02)
    place(buf, thud(0.45, 0.5) * 0.7, 0.45)  # body hits ground
    return finish(buf)


SOUNDS = {  # definition id -> (file stem, recipe, variants)
    "jjk.step": ("step", step, 3),
    "jjk.gojo.attack": ("gojo_attack", gojo_attack, 2),
    "jjk.gojo.hurt": ("gojo_hurt", hurt(1.0), 2),
    "jjk.gojo.death": ("gojo_death", gojo_death, 1),
    "jjk.toji.attack": ("toji_attack", toji_attack, 2),
    "jjk.toji.hurt": ("toji_hurt", hurt(0.82), 2),
    "jjk.toji.death": ("toji_death", toji_death, 1),
}


# ---------- skill sounds ----------
def chord(freqs, sec, decay, amp=0.3):
    n = int(SR * sec)
    return sum(np.sin(2 * np.pi * f * t(sec)) for f in freqs) * env(n, 0.01, decay) * amp


def g_blue(_):
    sec = 1.6; n = int(SR * sec)
    hum = (np.sin(2 * np.pi * 55 * t(sec)) + 0.5 * np.sin(2 * np.pi * 110.7 * t(sec))) * env(n, 0.15, 0.9)
    suck = lowpass(noise(sec), np.geomspace(3000, 200, n)) * env(n, 0.05, 0.6) * 1.5
    return finish(hum + suck)


def g_red_charge(_):
    sec = 0.5; n = int(SR * sec)
    return finish(tone(300, 1500, sec) * np.linspace(0.2, 1, n) * 0.5 + highpass(noise(sec), 3000) * 0.15 * np.linspace(0, 1, n))


def boom(sec, pitch=1.0, bright=1500):
    n = int(SR * sec)
    return (tone(70 * pitch, 28 * pitch, sec) * env(n, 0.005, 0.35) * 1.3
            + lowpass(noise(sec), np.geomspace(bright, 120, n)) * env(n, 0.002, 0.3))


def g_red_boom(_): return finish(boom(1.3))


def g_purple_charge(_):
    sec = 1.6; n = int(SR * sec)
    a = tone(220, 660, sec); b = tone(226, 668, sec)  # beating pair = unstable mass
    return finish((a + b) * np.linspace(0.1, 1, n) * 0.5 + lowpass(noise(sec), 800) * np.linspace(0, 0.6, n))


def g_purple_fire(_):
    sec = 1.8; n = int(SR * sec)
    roar = lowpass(noise(sec), np.geomspace(6000, 300, n)) * env(n, 0.01, 0.7) * 1.4
    sub = tone(90, 30, sec) * env(n, 0.01, 0.6) * 1.2
    whine = tone(1200, 300, sec) * env(n, 0.01, 0.4) * 0.25
    return finish(roar + sub + whine)


def g_domain(_):
    sec = 2.6; n = int(SR * sec)
    drone = (np.sin(2 * np.pi * 41 * t(sec)) + 0.6 * np.sin(2 * np.pi * 61.7 * t(sec))) * env(n, 0.4, 1.5)
    buf = drone * 0.8
    for i, f0 in enumerate((1318, 1760, 2349, 2637)):
        place(buf, chord([f0, f0 * 2.01], 1.2, 0.5, 0.18), 0.5 + i * 0.25)
    return finish(buf)


def g_blink(_):
    sec = 0.22; n = int(SR * sec)
    return finish(highpass(noise(sec), np.geomspace(800, 7000, n)) * env(n, 0.01, 0.06) + tone(600, 2400, sec) * env(n, 0.005, 0.05) * 0.3, -3)


def g_black_flash(_):
    buf = np.zeros(int(SR * 0.8))
    place(buf, whoosh(0.12, 3000, 400, peak=0.8) * 0.6, 0)  # reverse-ish rush in
    crack = highpass(noise(0.05), 2000) * env(int(SR * 0.05), 0.0005, 0.01) * 2
    place(buf, crack, 0.11)
    place(buf, boom(0.6, 0.8, 2500), 0.11)
    return finish(buf)


def g_rct(_): return finish(chord([523, 659, 784, 1046], 1.3, 0.6), -4)


def g_infinity(v):
    sec = 0.6; f0 = 2600 + 150 * v
    return finish(chord([f0, f0 * 1.003, f0 * 2.4], sec, 0.18, 0.4), -5)


def t_cloud(v):
    buf = np.zeros(int(SR * 0.5))
    place(buf, whoosh(0.22, 300, 1800 + 200 * v) * 0.8, 0)
    place(buf, thud(0.7, 0.25), 0.18)
    return finish(buf)


def t_slam(_):
    buf = boom(1.1, 0.8, 900)
    rattle = highpass(noise(0.8), 1200) * env(int(SR * 0.8), 0.05, 0.2) * 0.25
    place(buf, rattle, 0.08)
    return finish(buf)


def t_fist(v): return finish(thud(0.95 + 0.1 * v, 0.25), -2)


def t_spear(_):
    buf = np.zeros(int(SR * 0.6))
    place(buf, whoosh(0.1, 2000, 8000, peak=0.3), 0)
    place(buf, metal_ring(0.4, 3100) * 0.4, 0.06)
    place(buf, thud(1.2, 0.2) * 0.6, 0.08)
    return finish(buf)


def t_negate(_):
    sec = 0.9; buf = np.zeros(int(SR * sec))
    for _i in range(18):  # shattering glass
        f0 = rng.uniform(2500, 7500)
        place(buf, np.sin(2 * np.pi * f0 * t(0.25)) * env(int(SR * 0.25), 0.001, 0.05) * rng.uniform(0.2, 0.5), rng.uniform(0, 0.35))
    place(buf, highpass(noise(0.4), 4000) * env(int(SR * 0.4), 0.001, 0.08) * 0.6, 0)
    place(buf, tone(900, 150, 0.6) * env(int(SR * 0.6), 0.01, 0.2) * 0.3, 0.02)
    return finish(buf)


def t_chain_throw(_):
    buf = np.zeros(int(SR * 0.7))
    place(buf, whoosh(0.3, 600, 4000) * 0.7, 0)
    for i in range(6):
        place(buf, metal_ring(0.12, 2600 + 300 * (i % 3)) * 0.25, 0.05 + i * 0.06)
    return finish(buf)


def t_clink(v): return finish(metal_ring(0.15, 2400 + 380 * v) + highpass(noise(0.15), 5000) * env(int(SR * 0.15), 0.001, 0.01) * 0.3, -4)


def t_gun(_):
    sec = 0.6; n = int(SR * sec)
    snap = highpass(noise(sec), 1500) * env(n, 0.0005, 0.02) * 1.5
    body = lowpass(noise(sec), 900) * env(n, 0.001, 0.08) * 1.2 + tone(160, 50, sec) * env(n, 0.001, 0.06)
    tail = lowpass(noise(sec), 500) * env(n, 0.03, 0.25) * 0.25
    return finish(snap + body + tail)


def t_blitz(_):
    return finish(whoosh(0.35, 400, 6000, peak=0.25), -2)


def t_inventory(_):
    sec = 0.5; n = int(SR * sec)
    wob = lowpass(noise(sec), 250 + 200 * np.sin(2 * np.pi * 9 * t(sec)) ** 2) * env(n, 0.03, 0.15) * 2
    return finish(wob + tone(180, 90, sec) * env(n, 0.05, 0.12) * 0.4, -3)


def t_skm(_):
    sec = 1.4; n = int(SR * sec)
    growl = lowpass(noise(sec), 350) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t(sec))) * env(n, 0.2, 0.8) * 1.8
    return finish(growl + tone(70, 110, sec) * env(n, 0.2, 0.7) * 0.6)


SOUNDS.update({
    "jjk.gojo.blue": ("gojo_blue", g_blue, 1),
    "jjk.gojo.red_charge": ("gojo_red_charge", g_red_charge, 1),
    "jjk.gojo.red_boom": ("gojo_red_boom", g_red_boom, 1),
    "jjk.gojo.purple_charge": ("gojo_purple_charge", g_purple_charge, 1),
    "jjk.gojo.purple_fire": ("gojo_purple_fire", g_purple_fire, 1),
    "jjk.gojo.domain": ("gojo_domain", g_domain, 1),
    "jjk.gojo.blink": ("gojo_blink", g_blink, 1),
    "jjk.gojo.black_flash": ("gojo_black_flash", g_black_flash, 1),
    "jjk.gojo.rct": ("gojo_rct", g_rct, 1),
    "jjk.gojo.infinity": ("gojo_infinity", g_infinity, 2),
    "jjk.toji.cloud": ("toji_cloud", t_cloud, 2),
    "jjk.toji.slam": ("toji_slam", t_slam, 1),
    "jjk.toji.fist": ("toji_fist", t_fist, 2),
    "jjk.toji.spear": ("toji_spear", t_spear, 1),
    "jjk.toji.negate": ("toji_negate", t_negate, 1),
    "jjk.toji.chain_throw": ("toji_chain_throw", t_chain_throw, 1),
    "jjk.toji.chain_clink": ("toji_chain_clink", t_clink, 3),
    "jjk.toji.gun": ("toji_gun", t_gun, 1),
    "jjk.toji.blitz": ("toji_blitz", t_blitz, 1),
    "jjk.toji.inventory": ("toji_inventory", t_inventory, 1),
    "jjk.toji.skm": ("toji_skm", t_skm, 1),
})


def write_ogg(x, out):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name,
                        "-c:a", "libvorbis", "-q:a", "6", str(out)], check=True)


def main():
    d = RP / "sounds/jjk"
    d.mkdir(parents=True, exist_ok=True)
    defs = {}
    for sid, (stem, recipe, variants) in SOUNDS.items():
        files = []
        for v in range(variants):
            name = f"{stem}_{v + 1}" if variants > 1 else stem
            audio = recipe(v)  # always run so the random stream (and other files) stay deterministic
            if FORCE or not (d / f"{name}.ogg").exists():
                write_ogg(audio, d / f"{name}.ogg")
            files.append(f"sounds/jjk/{name}")
        defs[sid] = {"category": "neutral", "sounds": files}
    (RP / "sounds/sound_definitions.json").write_text(
        json.dumps({"format_version": "1.14.0", "sound_definitions": defs}, indent=2) + "\n")
    ents = {}
    for name in ("gojo", "toji"):
        ents[f"jjk:{name}"] = {"volume": 1.0, "pitch": [0.92, 1.08], "events": {
            "hurt": f"jjk.{name}.hurt",
            "death": f"jjk.{name}.death",
            "step": {"sound": "jjk.step", "volume": 0.35, "pitch": [0.9, 1.1]},
        }}
    (RP / "sounds.json").write_text(json.dumps({"entity_sounds": {"entities": ents}}, indent=2) + "\n")


if __name__ == "__main__":
    main()
