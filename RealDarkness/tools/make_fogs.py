"""Generate fog definitions: 4 darkness levels x 10 night profiles + sun phenomena.
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
# sun phenomena
write("golden", 24, 140, "#b5652a")        # golden hour (sunrise / sunset)
write("halo", 64, 220, "#dfe3ee")          # sun halo day: milky-white sky
write("haze", 16, 110, "#b3a27a")          # hazy / dusty day
for k, (end, color) in enumerate([(160, "#3a3f4c"), (90, "#16181f"), (40, "#040406")], 1):
    write(f"eclipse_total_{k}", 0, end, color)          # total solar eclipse, ramps to k=3
for k, (end, color) in enumerate([(200, "#5a5f6a"), (150, "#3a3e48"), (110, "#262a33")], 1):
    write(f"eclipse_annular_{k}", 8, end, color)        # annular eclipse, milder
print(len(os.listdir(OUT)), "fog files")
