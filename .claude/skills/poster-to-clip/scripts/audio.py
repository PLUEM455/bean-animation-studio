# Usage (in a project dir): python3 audio.py  -> soundtrack.wav, timed from config.json. Fixed seed = identical output.
import json, wave, numpy as np
C = json.load(open('config.json')); A = C.get('audio', {})
SR, DUR = 48000, float(C['duration']); N = int(SR*DUR); t = np.arange(N)/SR
rng = np.random.default_rng(2026)
def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/SR)
    X *= np.exp(-0.5*((np.log(np.maximum(f, 1))-np.log(np.sqrt(lo*hi)))/(np.log(hi/lo)/2))**2)
    return np.fft.irfft(X, len(x))
norm = lambda x: x/np.max(np.abs(x))
def sm(x0, x1, x): k = np.clip((x-x0)/(x1-x0), 0, 1); return k*k*(3-2*k)
out = np.zeros((N, 2))
for ch in range(2):  # wind
    out[:, ch] += 0.07*norm(band(rng.standard_normal(N), 180, 900))*(0.6+0.4*np.sin(2*np.pi*t*0.11+ch*1.7))
if C.get('waterfalls') or C.get('rivers'):
    keys = A.get('waterLevel', [[0, 0.04]])
    lvl = np.interp(t, [k[0] for k in keys], [k[1] for k in keys])
    out += (norm(band(rng.standard_normal(N), 900, 6000))*lvl)[:, None]*[0.9, 1.0]
for at, gain in A.get('drums', []):
    s = np.maximum(t-at, 0); f = 52+40*np.exp(-s*18)
    d = np.where(t >= at, np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-s*5.5), 0)
    d += 0.4*band(rng.standard_normal(N), 120, 900)*np.where(t >= at, np.minimum(s/0.002, 1)*np.exp(-s/0.05), 0)
    out += (gain*0.5*d)[:, None]
brush = norm(band(rng.standard_normal(N), 1800, 7000)); gate = np.zeros(N)
for ln in C['text']['lines']:
    a, b = ln['start'], ln['end']
    for m in a + np.sort(rng.uniform(0, 1, int((b-a)*6)+2))*(b-a):
        L = rng.uniform(0.06, 0.18); s = t-m; k = (s >= 0) & (s < L)
        gate[k] = np.maximum(gate[k], np.sin(np.pi*s[k]/L)**0.7*rng.uniform(0.5, 1))
out += (0.16*brush*gate)[:, None]*[1.0, 0.85]
if C.get('seal'):  # gong
    T0 = C['seal']['time']; s = np.maximum(t-T0, 0); gg = np.zeros(N)
    for r, amp, dec in [(1, 1, 3.5), (1.48, .6, 2.6), (2.0, .35, 2.0), (2.61, .3, 1.4), (3.2, .2, 1.0), (4.1, .12, .7)]:
        gg += amp*np.sin(2*np.pi*98*r*s*(1+0.002*np.sin(2*np.pi*3*s)))*np.exp(-s/dec)
    out += (0.22*np.where(t >= T0, gg*np.minimum(s/0.004, 1), 0))[:, None]
def pluck(f, dur=2.5):
    n = int(SR*dur); p = int(SR/f); buf = rng.uniform(-1, 1, p); y = np.zeros(n)
    for i in range(n): y[i] = buf[i % p]; buf[i % p] = 0.497*(buf[i % p]+buf[(i+1) % p])
    return y
for i, (at, f) in enumerate(A.get('plucks', [])):
    y = pluck(f); st = int(at*SR); e = min(N, st+len(y))
    out[st:e] += (0.2*y[:e-st])[:, None]*([0.8, 1.0] if i % 2 else [1.0, 0.8])
out *= (sm(0, 0.25, t)*sm(DUR, DUR-C.get('fadeOut', 0.45), t))[:, None]
out *= 10**(-1/20)/np.max(np.abs(out))
with wave.open('soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype('<i2').tobytes())
print('soundtrack.wav', DUR, 's')
