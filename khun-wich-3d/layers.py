# Cut the poster into paper layers for a 3D diorama.
# Outputs: back.png (artwork removed under the cut layers), layer_<name>.png (RGBA, cropped), text_<i>.png (ink alpha, cropped), layers.json
import json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
src = Image.open('source.png').convert('RGB'); W, H = src.size
a = np.asarray(src).astype(np.float32)
clean = np.asarray(Image.open('clean.png').convert('RGB')).astype(np.float32)
ink = np.asarray(Image.open('ink.png')).astype(np.float32)
ink_a, ink_id, ink_hole = ink[..., 0]/255, np.rint(ink[..., 1]/40).astype(int), ink[..., 2]/255

def _box(x, r, ax):
    c = np.cumsum(np.pad(x, [(r+1, r) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax); n = x.shape[ax]
    return (np.take(c, np.arange(2*r+1, 2*r+1+n), axis=ax) - np.take(c, np.arange(0, n), axis=ax))/(2*r+1)
def blur(x, r):
    r = max(1, int(r)); 
    for _ in range(3): x = _box(_box(x, r, 0), r, 1)
    return x.astype(np.float32)
def poly(points, feather=6):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon([tuple(p) for p in points], fill=255)
    return blur(np.asarray(im).astype(np.float32)/255, feather)
def grow(m, px): return (blur(m.astype(np.float32), max(1, px*0.6)) > 0.08).astype(np.float32)  # round-ish dilation

# paper colour from the (text-free) paper in clean.png
paper = np.median(clean[240:600, 460:1000].reshape(-1, 3), axis=0)
dist = np.sqrt(((clean - paper)**2 * [0.45, 0.4, 0.15]).sum(-1))       # clean.png: lettering already removed
art = np.clip((dist - 14)/26, 0, 1)
art = blur(art, 1.2)

warrior = [(262,85),(300,250),(360,330),(372,470),(335,505),(440,560),(472,700),(492,900),(505,1060),(525,1175),(475,1185),(470,1300),(545,1448),(0,1448),(0,555),(150,500),(160,430),(200,330),(226,250)]
W_m = poly(warrior, 4)
W_alpha = np.clip(np.maximum(art, blur((W_m > 0.99).astype(np.float32), 2)*0.0) , 0, 1)
W_alpha = np.clip(W_m * np.maximum(art, (blur(W_m, 14) > 0.97)), 0, 1)       # solid inside, art-shaped at the rim

regions = {  # name: (polygon, z, art-masked)
  'mtn_top':  ([(380,30),(1086,30),(1086,330),(380,330)], 0.45),
  'tree':     ([(0,0),(640,0),(640,200),(420,235),(300,280),(170,400),(80,520),(0,560)], 1.15),
  'mtn_mid':  ([(420,610),(1086,610),(1086,1000),(420,1000)], 0.8),
  'front':    ([(470,960),(1086,960),(1086,1448),(560,1448),(500,1300)], 1.6),
}
layers = []
taken = W_alpha.copy()
order = [('warrior', None, 2.6)] + [(k, v[0], v[1]) for k, v in regions.items()]
alphas = {'warrior': W_alpha}
for name, pts, z in order[1:]:
    m = poly(pts, 10) * art * (1 - grow(ink_hole, 2)) * (1 - W_alpha)
    alphas[name] = np.clip(m, 0, 1)

meta = {'size': [W, H], 'paper': (paper/255).tolist(), 'layers': [], 'text': []}
for name, pts, z in order:
    al = alphas[name]
    core = (al > 0.35).astype(np.float32)
    if name != 'warrior':   # drop specks: open with a 7 px window
        core = (blur(core, 3) > 0.5).astype(np.float32)   # smooth contour, drops specks; al = al * grow(core, 2)
    rim = np.clip(blur(grow(core, 4), 1.0), 0, 1)             # paper-cut border around the art
    rgba = np.zeros((H, W, 4), np.float32)
    rgba[..., :3] = np.where(core[..., None] > 0, clean, paper*1.04)
    rgba[..., 3] = np.maximum(rim, al)*255
    ys, xs = np.where(rgba[..., 3] > 2)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max()+1, ys.max()+1
    Image.fromarray(np.clip(rgba[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA').save(f'layer_{name}.png')
    meta['layers'].append({'name': name, 'z': z, 'box': [int(x0), int(y0), int(x1), int(y1)]})

# back plate: artwork under the cut layers painted out to paper
hole = grow(np.clip(sum((alphas[k] > 0.3).astype(np.float32) for k in alphas), 0, 1), 5)
keep = 1 - hole; back = clean.copy()
for r in (6, 12, 24, 48, 96):
    w = blur(keep, r); sel = (hole > 0) & (w > 0.3) & (keep < 1)
    for c in range(3):
        f = blur(back[..., c]*keep, r)/np.maximum(w, 1e-3); back[..., c][sel] = f[sel]
    keep = np.maximum(keep, (w > 0.3)*hole)
back = np.where(((hole > 0) & (keep < 1))[..., None], paper, back)   # centre of big holes: plain paper
back = np.where(hole[..., None] > 0, 0.6*back + 0.4*paper + np.random.default_rng(3).normal(0, 3, (H, W, 1)), back)
Image.fromarray(np.clip(back, 0, 255).astype(np.uint8)).save('back.png')

# text lines: ink alpha per line (id 1..5), coloured from the source strokes later in the shader
for i in range(1, 6):
    m = np.where(ink_id == i, ink_a, 0)
    ys, xs = np.where(m > 0.02); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max()+1, ys.max()+1
    Image.fromarray((m[y0:y1, x0:x1]*255).astype(np.uint8)).save(f'text_{i}.png')
    meta['text'].append({'id': i, 'box': [int(x0), int(y0), int(x1), int(y1)]})
json.dump(meta, open('layers.json', 'w'), indent=1)
print(json.dumps(meta['layers']), meta['text'])
