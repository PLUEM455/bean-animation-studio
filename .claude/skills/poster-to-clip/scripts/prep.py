# Usage (in a project dir): python3 prep.py
# Reads config.json + the source image, writes clean.png (text painted out), ink.png, depth.png.
import json, numpy as np
from PIL import Image, ImageFilter, ImageDraw
C = json.load(open('config.json'))
src = Image.open(C['image']).convert('RGB'); W, H = src.size
a = np.asarray(src).astype(np.float32)
g = np.asarray(src.convert('L')).astype(np.float32)
T = C['text']
# local paper tone via a large median, computed only around the text boxes (it is slow on whole images)
K = T.get('median', 45); dark = np.zeros((H, W), np.float32)
for ln in T['lines']:
    x0, y0, x1, y1 = ln['box']; m = K
    X0, Y0, X1, Y1 = max(0, x0-m), max(0, y0-m), min(W, x1+m), min(H, y1+m)
    crop = src.crop((X0, Y0, X1, Y1))
    med = np.asarray(crop.filter(ImageFilter.MedianFilter(K)).convert('L')).astype(np.float32)
    d = np.clip((med - g[Y0:Y1, X0:X1] - T.get('threshold', 18)) / 40, 0, 1)
    dark[Y0:Y1, X0:X1] = np.maximum(dark[Y0:Y1, X0:X1], d)

alpha = np.zeros((H, W), np.float32); lid = np.zeros((H, W), np.uint8)
for i, ln in enumerate(T['lines'], 1):          # line id i -> G = i*30
    x0, y0, x1, y1 = ln['box']
    alpha[y0:y1, x0:x1] = dark[y0:y1, x0:x1]; lid[y0:y1, x0:x1] = i * 30

def _box(x, r, ax):
    c = np.cumsum(np.pad(x, [(r+1, r) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax)
    n = x.shape[ax]
    return (np.take(c, np.arange(2*r+1, 2*r+1+n), axis=ax) - np.take(c, np.arange(0, n), axis=ax)) / (2*r+1)
def blur(x, r):
    r = max(1, int(r * 0.9))
    for _ in range(3): x = _box(_box(x, r, 0), r, 1)
    return x.astype(np.float32)

# paint strokes out: normalized convolution, growing radius, only from known pixels
hole = np.asarray(Image.fromarray((alpha > 0.05).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(11))).astype(np.float32)/255
keep = 1 - hole; clean = a.copy()
for r in (5, 8, 12, 18, 26, 40):
    w = blur(keep, r); sel = (hole > 0) & (w > 0.35) & (keep < 1)
    for c in range(3):
        fill = blur(clean[..., c]*keep, r) / np.maximum(w, 1e-3)
        clean[..., c][sel] = fill[sel]
    keep = np.maximum(keep, (w > 0.35)*hole)
clean = np.where(hole[..., None] > 0, clean + np.random.default_rng(7).normal(0, 3.0, (H, W, 1)), clean)
Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).save('clean.png')

ink = np.zeros((H, W, 3), np.uint8)
ink[..., 0] = (np.clip(alpha*1.15, 0, 1)*255).astype(np.uint8)
ink[..., 1] = np.asarray(Image.fromarray(np.where(alpha > 0.05, lid, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(13)))
ink[..., 2] = (hole*255).astype(np.uint8)
Image.fromarray(ink).save('ink.png')

D = C['depth']
yy = np.linspace(0, 1, H)[:, None]*np.ones((1, W))
dimg = Image.fromarray(((D.get('far', .1) + (D.get('near', .5)-D.get('far', .1))*yy**1.5)*255).astype(np.uint8))
dr = ImageDraw.Draw(dimg)
for s in D.get('shapes', []):
    v = int(s['value']*255)
    if 'polygon' in s: dr.polygon([tuple(p) for p in s['polygon']], fill=v)
    else: dr.rectangle(tuple(s['rect']), fill=v)
dimg.filter(ImageFilter.GaussianBlur(D.get('blur', 22))).save('depth.png')
print(f'prep ok: {W}x{H}, {len(T["lines"])} text lines, hole px {int(hole.sum())}')
