"""Package the three packs into dist/RealDarkness.mcaddon. Run: python3 tools/build.py"""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = ["RealDarkness_BP", "RealDarkness_RP", "RealDarkness_Sky_RP"]
out = os.path.join(ROOT, "dist", "RealDarkness.mcaddon")
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for pack in PACKS:
        for base, _, files in os.walk(os.path.join(ROOT, pack)):
            for f in files:
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, ROOT))
print(out)
