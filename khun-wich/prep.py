# Builds the layers the shader needs from source.png:
#   clean.png  - poster with the calligraphy painted out (for the ink write-on)
#   ink.png    - R: ink alpha of text strokes, G: line id (for write order)
#   depth.png  - soft hand-authored depth map for 2.5D parallax
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
src = Image.open('source.png').convert('RGB')
W, H = src.size
a = np.asarray(src).astype(np.float32)
g = np.asarray(src.convert('L')).astype(np.float32)
med = np.asarray(src.filter(ImageFilter.MedianFilter(45)).convert('L')).astype(np.float32)
dark = np.clip((med - g - 18) / 40, 0, 1)            # soft ink strength

# text boxes (x0,x1,y0,y1,id)  id: 1..3 lines, 4 bottom swirl, 5 signature
boxes = [(385,1086,222,338,1),(385,1086,338,445,2),(385,1086,445,542,3),(398,1086,542,622,4),(640,995,1262,1392,5)]
alpha = np.zeros((H,W),np.float32); lid = np.zeros((H,W),np.uint8)
for x0,x1,y0,y1,i in boxes:
    alpha[y0:y1,x0:x1] = dark[y0:y1,x0:x1]; lid[y0:y1,x0:x1] = i*40
# fill strokes: normalized convolution over non-ink pixels
m = Image.fromarray((alpha>0.05).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(11))
hole = np.asarray(m).astype(np.float32)/255
keep = 1-hole
def _box(x, r, ax):
    c = np.cumsum(np.pad(x, [(r+1, r) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax)
    n = x.shape[ax]
    hi = np.take(c, np.arange(2*r+1, 2*r+1+n), axis=ax); lo = np.take(c, np.arange(0, n), axis=ax)
    return (hi - lo) / (2*r+1)
def blur(x, r):
    r = max(1, int(r*0.9))
    for _ in range(3):
        x = _box(_box(x, r, 0), r, 1)
    return x.astype(np.float32)
clean = a.copy()
for r in (5, 8, 12, 18, 26):
    w = blur(keep, r)
    for c in range(3):
        fill = blur(clean[...,c]*keep, r)/np.maximum(w,1e-3)
        sel = (hole>0)&(w>0.35)
        clean[...,c][sel & (keep<1)] = fill[sel & (keep<1)]
    keep = np.maximum(keep, (w>0.35)*hole)   # filled pixels now count as known
# restore paper grain on the patches
rng = np.random.default_rng(7)
grain = rng.normal(0, 3.0, (H,W,1)).astype(np.float32)
clean = np.where(hole[...,None]>0, clean+grain, clean)
Image.fromarray(np.clip(clean,0,255).astype(np.uint8)).save('clean.png')
ink = np.zeros((H,W,3),np.uint8); ink[...,0] = (np.clip(alpha*1.15,0,1)*255).astype(np.uint8)
# G: line id dilated to cover the whole patched area; B: patched area (where clean differs from source)
ink[...,1] = np.asarray(Image.fromarray(np.where(alpha>0.05, lid, 0).astype(np.uint8)).filter(ImageFilter.MaxFilter(13)))
ink[...,2] = (hole*255).astype(np.uint8)
Image.fromarray(ink).save('ink.png')

# depth: background falls off with height, warrior is near, text sits flat
yy = np.linspace(0,1,H)[:,None]*np.ones((1,W))
depth = 0.10 + 0.40*yy**1.5
dimg = Image.fromarray((depth*255).astype(np.uint8))
d = ImageDraw.Draw(dimg)
warrior = [(262,85),(300,250),(360,330),(372,470),(335,505),(440,560),(472,700),(492,900),(505,1060),(525,1175),(475,1185),(470,1300),(545,1448),(0,1448),(0,555),(150,500),(160,430),(200,330),(226,250)]
d.polygon(warrior, fill=235)
d.rectangle((385,222,1086,622), fill=95)
d.polygon([(0,0),(330,0),(250,200),(120,420),(0,470)], fill=150)  # tree, upper left
dimg = dimg.filter(ImageFilter.GaussianBlur(22))
dimg.save('depth.png')
print('ok')
