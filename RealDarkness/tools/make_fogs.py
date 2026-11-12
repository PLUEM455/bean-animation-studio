"""Generate automatic-fog definitions: 8 tints x 15 visibility steps.
Steps must match FOG_STEPS in RealDarkness_BP/scripts/main.js. Run: python3 tools/make_fogs.py"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "RealDarkness_RP", "fogs")
STEPS = [6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 50, 64]
TINTS = {
    "black": "#000000",        # darkness / caves / normal nights
    "blood": "#2a0200",        # blood moon (lunar eclipse)
    "honey": "#1e1404",        # honey moon
    "loykrathong": "#160c05",  # Loy Krathong full moon
    "golden": "#b5652a",       # golden hour
    "halo": "#dfe3ee",         # sun halo day
    "haze": "#b3a27a",         # hazy / dusty day
    "eclipse": "#08090c",      # solar eclipse
}

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
for tint, color in TINTS.items():
    for i, end in enumerate(STEPS):
        layer = {"fog_start": round(end * 0.5, 1) if end <= 8 else round(end * 0.2, 1), "fog_end": end, "fog_color": color, "render_distance_type": "fixed"}
        data = {"format_version": "1.16.100", "minecraft:fog_settings": {
            "description": {"identifier": f"realdarkness:{tint}_{i}"},
            "distance": {"air": layer, "weather": layer}}}
        with open(os.path.join(OUT, f"{tint}_{i}.json"), "w") as fh:
            json.dump(data, fh, indent=2)
print(len(os.listdir(OUT)), "fog files")
