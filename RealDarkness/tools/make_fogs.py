"""Generate fog definitions: 4 darkness levels x 10 night profiles + dusk + eclipse.
Run: python3 tools/make_fogs.py"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "RealDarkness_RP", "fogs")

# level -> (fog_start, fog_end) for a normal full-moon night
LEVELS = {"thin": (8, 48), "medium": (4, 32), "thick": (0, 20), "pitch": (0, 8)}
# profile -> (distance multiplier, fog color)
PROFILES = {
    "new": (0.6, "#000000"),
    "crescent": (0.75, "#000000"),
    "quarter": (0.85, "#000000"),
    "gibbous": (0.95, "#000000"),
    "full": (1.0, "#020306"),
    "super": (1.25, "#04060c"),
    "micro": (0.9, "#010204"),
    "blood": (0.7, "#2a0200"),
    "honey": (1.0, "#1e1404"),
    "loykrathong": (1.4, "#160c05"),
}

def write(name, start, end, color):
    layer = {"fog_start": start, "fog_end": end, "fog_color": color, "render_distance_type": "fixed"}
    data = {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": f"realdarkness:{name}"},
        "distance": {"air": layer, "weather": layer}}}
    with open(os.path.join(OUT, f"{name}.json"), "w") as f:
        json.dump(data, f, indent=2)

os.makedirs(OUT, exist_ok=True)
for level, (start, end) in LEVELS.items():
    for profile, (mul, color) in PROFILES.items():
        e = max(4.0, round(end * mul, 1))
        write(f"{level}_{profile}", min(round(start * mul, 1), e - 2), e, color)
write("dusk", 16, 72, "#0b0c12")
write("eclipse", 0, 40, "#050508")
print(len(os.listdir(OUT)), "fog files")
