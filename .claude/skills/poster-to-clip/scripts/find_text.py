# Usage: python3 find_text.py source.png [x0 y0 x1 y1] [--out preview.png]
# Prints rows of dark ink strokes (y ranges + x extent) inside the region, to help write config.text.lines.
import sys, numpy as np
from PIL import Image, ImageFilter
args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = sys.argv[sys.argv.index('--out')+1] if '--out' in sys.argv else None
if out: args.remove(out)
im = Image.open(args[0]).convert('RGB'); W, H = im.size
x0, y0, x1, y1 = map(int, args[1:5]) if len(args) >= 5 else (0, 0, W, H)
crop = im.crop((x0, y0, x1, y1))
g = np.asarray(crop.convert('L')).astype(float)
med = np.asarray(crop.filter(ImageFilter.MedianFilter(45)).convert('L')).astype(float)
sub = (med - g) > 38
ink = np.zeros((H, W), bool); ink[y0:y1, x0:x1] = sub; rows = sub.sum(1); on = False
print(f'image {W}x{H}; ink rows in [{x0},{y0},{x1},{y1}]:')
for i, v in enumerate(list(rows) + [0]):
    if v > 8 and not on: s, on = i, True
    elif v <= 8 and on:
        on = False
        if i - s < 6: continue
        cols = np.where(sub[s:i].sum(0) > 0)[0]
        print(f'  y {s+y0:5d}-{i+y0:5d}   x {cols.min()+x0:5d}-{cols.max()+x0:5d}')
if out: Image.fromarray((ink*255).astype('uint8')).save(out); print('mask ->', out)
