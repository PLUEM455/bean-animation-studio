# Procedural soundtrack, timed to the same timeline as main.js. Fixed seed -> identical every run.
import numpy as np, wave
SR, DUR = 48000, 12.0
N = int(SR*DUR); t = np.arange(N)/SR
rng = np.random.default_rng(2026)
LINES = [(1.7,3.0),(3.0,4.3),(4.3,5.7),(5.4,6.0),(6.6,7.6)]
SEAL_T = 7.75

def band(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/SR)
    X *= np.exp(-0.5*((np.log(np.maximum(f,1))-np.log(np.sqrt(lo*hi)))/(np.log(hi/lo)/2))**2)
    return np.fft.irfft(X, len(x))
def norm(x): return x/np.max(np.abs(x))
def env(start, a, d):
    e = np.zeros(N); s = t-start; m = s>=0
    e[m] = np.minimum(s[m]/a, 1)*np.exp(-np.maximum(s[m]-a,0)/d); return e
def sm(x0, x1, x):  # smoothstep
    k = np.clip((x-x0)/(x1-x0),0,1); return k*k*(3-2*k)

out = np.zeros((N,2))
# wind: slow swells, stereo decorrelated
for ch in range(2):
    w = norm(band(rng.standard_normal(N), 180, 900))
    out[:,ch] += 0.07*w*(0.6+0.4*np.sin(2*np.pi*t*0.11+ch*1.7))
# waterfall: loud on the opening shot, then distant
wf = norm(band(rng.standard_normal(N), 900, 6000))
wfl = 0.11*(1-sm(1.2,2.2,t)) + 0.025 + 0.03*sm(8.9,10.5,t)
out += (wf*wfl)[:,None]*[0.9,1.0]
# taiko-like drum at the open and before the first line
for at, g in [(0.12,0.9),(1.55,0.55)]:
    s = t-at; m = s>=0
    f = 52+40*np.exp(-np.maximum(s,0)*18)
    ph = 2*np.pi*np.cumsum(f)/SR
    d = np.where(m, np.sin(ph)*np.exp(-np.maximum(s,0)*5.5), 0)
    d += 0.4*band(rng.standard_normal(N),120,900)*env(at,0.002,0.05)
    out += (g*0.5*d)[:,None]
# brush on paper: bursts of filtered noise while each line is written
brush = norm(band(rng.standard_normal(N), 1800, 7000))
gate = np.zeros(N)
for li,(a,b) in enumerate(LINES):
    n = int((b-a)*6)+2
    marks = a + np.sort(rng.uniform(0,1,n))*(b-a)
    for m in marks:
        ln = rng.uniform(0.06,0.18)
        s = t-m; k = (s>=0)&(s<ln)
        gate[k] = np.maximum(gate[k], np.sin(np.pi*s[k]/ln)**0.7 * rng.uniform(0.5,1))
out += (0.16*brush*gate)[:,None]*[1.0,0.85]
# gong for the seal
s = np.maximum(t-SEAL_T,0); m = t>=SEAL_T
g = np.zeros(N)
for r,a,dec in [(1,1,3.5),(1.48,.6,2.6),(2.0,.35,2.0),(2.61,.3,1.4),(3.2,.2,1.0),(4.1,.12,.7)]:
    g += a*np.sin(2*np.pi*98*r*s*(1+0.002*np.sin(2*np.pi*3*s)))*np.exp(-s/dec)
g = np.where(m, g*np.minimum(s/0.004,1), 0)
out += (0.22*g)[:,None]
# plucked pentatonic motif on the pull-back (Karplus-Strong)
def pluck(f, dur=2.5):
    n = int(SR*dur); p = int(SR/f); buf = rng.uniform(-1,1,p); y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i%p]; buf[i%p] = 0.497*(buf[i%p]+buf[(i+1)%p])
    return y
notes = [(9.05,392.0),(9.35,440.0),(9.65,523.25),(10.1,587.33),(10.55,523.25),(11.0,392.0)]
for i,(at,f) in enumerate(notes):
    y = pluck(f); st = int(at*SR); e = min(N, st+len(y))
    pan = [0.8,1.0] if i%2 else [1.0,0.8]
    out[st:e] += (0.2*y[:e-st])[:,None]*pan
# master fade + normalise to -1 dBFS
out *= (sm(0,0.25,t)*sm(DUR, DUR-0.45, t))[:,None]
out *= 10**(-1/20)/np.max(np.abs(out))
with wave.open('soundtrack.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out*32767).astype('<i2').tobytes())
print('soundtrack.wav', DUR, 's')
