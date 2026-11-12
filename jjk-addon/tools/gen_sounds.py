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
