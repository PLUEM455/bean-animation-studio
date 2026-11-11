"""Synthesized SFX + very quiet music bed for the wish short, plus meme cues from the user's library. Writes work/sfx.wav, work/music.wav (48 kHz stereo)."""
import numpy as np, subprocess, wave
SR = 48000; DUR = 65.0; N = int(DUR * SR)
rng = np.random.default_rng(11)
t_ = lambda n: np.arange(n) / SR
def env(n, a=0.005, r=0.2): t = t_(n); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)
def fft_f(x, f, mode):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR); g = 1 / (1 + (fr / f) ** 4)
    return np.fft.irfft(X * (g if mode == 'lp' else 1 - g), len(x)).astype(np.float32)
lp = lambda x, f: fft_f(x, f, 'lp'); hp = lambda x, f: fft_f(x, f, 'hp')
noise = lambda n: rng.standard_normal(n).astype(np.float32)
def place(buf, sig, t0, g=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if 0 <= i < N and j > i: buf[i:j] += sig[:j - i] * g
def thump(dur=0.7, f0=110, f1=34, decay=5.5):
    n = int(dur * SR); t = t_(n); f = f1 + (f0 - f1) * np.exp(-t * 14); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * decay)).astype(np.float32)
def boom(dur=2.0, g_noise=0.9):
    n = int(dur * SR); b = thump(dur, 90, 28, 3.0); nz = lp(noise(n), 900) * np.exp(-t_(n) * 3.2) * g_noise
    return (b + nz + hp(noise(n), 3000) * np.exp(-t_(n) * 9) * 0.35).astype(np.float32)
def whoosh(dur, peak=0.5, lo=300, hi=3500, rise=2.0):
    n = int(dur * SR); t = t_(n) / dur; a = (np.sin(np.pi * np.clip(t, 0, 1)) ** rise)
    nz = noise(n); out = lp(hp(nz, lo), hi) * a
    return out.astype(np.float32) * peak
def chime(f, dur=1.4):
    n = int(dur * SR); t = t_(n); s = np.zeros(n)
    for k, a in [(1, 1), (2.76, 0.45), (5.4, 0.22), (8.9, 0.1)]: s += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (3 + 2 * k))
    return (s * np.minimum(1, t / 0.004)).astype(np.float32)
def gun_shot():
    n = int(0.09 * SR); t = t_(n); return (hp(noise(n), 400) * np.exp(-t * 55) + thump(0.09, 160, 70, 40)[:n] * 0.8).astype(np.float32)
def clank(f=420):
    n = int(0.5 * SR); t = t_(n); s = sum(np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (14 + 6 * k)) for k in (1, 1.52, 2.31, 3.4)); return (s * 0.4).astype(np.float32)
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()
LIB = 'work/lib/sounds/'
sfx = np.zeros(N, np.float32)
# --- ambience beds (very low) ---
def bed(t0, t1, f_hi, g, wob=0.0):
    n = int((t1 - t0) * SR); s = lp(noise(n), f_hi) * g; a = np.minimum(1, t_(n) / 0.6) * np.minimum(1, (t1 - t0 - t_(n)) / 0.6).clip(0)
    if wob: s *= 1 + wob * np.sin(2 * np.pi * 0.7 * t_(n))
    place(sfx, s * a, t0)
bed(0.0, 14.0, 700, 0.10, 0.3)            # crowd murmur
bed(19.0, 26.0, 500, 0.07)                 # wind after everyone slumps
bed(40.6, 46.0, 650, 0.09, 0.4)            # ruined-city wind + embers
bed(46.6, 57.0, 800, 0.06, 0.3)            # stadium murmur
bed(59.0, 64.5, 1200, 0.10, 0.5)           # cheering
# --- intro ---
for t0, f in [(0.15, 880), (1.2, 1175), (2.3, 1568), (4.0, 1319), (5.0, 1760)]: place(sfx, chime(f, 1.2), t0, 0.25)
# --- sky crack ---
n = int(3.7 * SR); rumble = lp(noise(n), 160) * np.linspace(0, 1, n) ** 2 * 0.9; place(sfx, rumble, 10.6)
for t0 in [11.3, 11.9, 12.4, 12.9, 13.3, 13.7]:
    n = int(0.25 * SR); place(sfx, (hp(noise(n), 2500) * np.exp(-t_(n) * 18) * (np.sin(t_(n) * 900) > 0)).astype(np.float32), t0, 0.35)
place(sfx, boom(2.2), 14.0, 0.9)
# --- rules boards (pop + wood thock) ---
for t0 in [14.3, 15.9, 17.5]: place(sfx, thump(0.35, 180, 70, 14), t0, 0.7); place(sfx, whoosh(0.35, 0.3, 500, 4000), t0 - 0.05, 0.6)
# --- slump: soft thuds as people drop ---
for i in range(10): place(sfx, thump(0.25, 100, 50, 18), 19.1 + i * 0.09 + (i % 3) * 0.04, 0.22)
# --- live feed beep + footsteps ---
n = int(0.12 * SR); place(sfx, (np.sin(2 * np.pi * 1000 * t_(n)) * 0.3).astype(np.float32), 21.85)
for i in range(8): place(sfx, thump(0.2, 140, 70, 20), 22.3 + i * 0.5, 0.18)
# --- tank ---
place(sfx, thump(1.0, 70, 25, 3.5), 26.6, 1.0); place(sfx, lp(noise(int(1.2 * SR)), 300) * 0.8, 26.6)
place(sfx, boom(2.4), 27.9, 1.2)
# --- flying car (pass-by at 29.8) ---
place(sfx, whoosh(2.0, 0.9, 150, 2500, 1.6), 28.8)
n = int(2.3 * SR); t = t_(n); f = 140 + 110 * np.exp(-((t - 1.0) ** 2) * 2.0); eng = (np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.12 * np.sin(np.pi * np.clip(t / 2.3, 0, 1))).astype(np.float32)
place(sfx, lp(eng, 1500), 28.8)
# --- machine gun burst ---
for i in range(28): place(sfx, gun_shot(), 31.6 + i * 0.05, 0.7)
for t0 in [33.2, 33.5, 33.8]: place(sfx, chime(2200, 0.4), t0, 0.1)
# --- robot ---
for i, t0 in enumerate([33.9, 34.35, 34.7]): place(sfx, boom(1.0, 0.5), t0, 0.55); place(sfx, clank(380 + i * 30), t0, 0.5)
n = int(1.6 * SR); t = t_(n); creak = (np.sin(2 * np.pi * np.cumsum(900 - 600 * t / 1.6) / SR) * 0.25 * (0.6 + 0.4 * np.sin(t * 40))).astype(np.float32); place(sfx, creak, 35.0, 0.6)
place(sfx, whoosh(1.6, 0.5, 100, 1800, 1.0), 35.0)
place(sfx, boom(3.0, 1.1), 36.6, 1.4); place(sfx, clank(300), 36.65, 0.9); place(sfx, clank(520), 36.9, 0.6)
# --- giant footsteps (match camera kicks) ---
for t0 in [37.5, 38.25, 39.0, 39.75, 40.5]: place(sfx, thump(1.0, 80, 24, 3.2), t0, 1.1); place(sfx, lp(noise(int(0.8 * SR)), 250) * np.exp(-t_(int(0.8 * SR)) * 5), t0, 0.9)
# --- golden wish ---
for i, f in enumerate([523, 659, 784, 1047, 1319, 1568, 2093]): place(sfx, chime(f, 1.6), 44.4 + i * 0.13, 0.28)
place(sfx, whoosh(1.2, 0.5, 400, 5000, 0.8), 44.4)
# --- football ---
place(sfx, boom(1.2, 0.3), 51.0, 0.8)                 # reveal stab
place(sfx, thump(0.4, 180, 80, 14), 53.9, 1.0); place(sfx, whoosh(0.9, 0.5, 600, 5000), 53.95)
place(sfx, clank(260), 54.8, 1.0); place(sfx, thump(0.4, 140, 60, 12), 54.8, 0.9)
n = int(1.1 * SR); t = t_(n); place(sfx, (np.sin(2 * np.pi * np.cumsum(1600 - 1300 * t / 1.1) / SR) * 0.18 * np.exp(-t * 1.2)).astype(np.float32), 54.9)   # falling whistle
place(sfx, boom(1.5, 0.7), 55.9, 0.9); place(sfx, clank(200), 55.95, 0.7)
place(sfx, hp(noise(int(0.4 * SR)), 1800) * np.exp(-t_(int(0.4 * SR)) * 8), 56.0, 0.5)   # net swish
place(sfx, whoosh(1.2, 0.6, 300, 4000), 56.0)
# --- three days later: glitch + ticks ---
for t0 in [57.5, 58.1, 58.7]: n = int(0.05 * SR); place(sfx, (hp(noise(n), 1500) * np.exp(-t_(n) * 60)).astype(np.float32), t0, 0.6)
place(sfx, whoosh(1.8, 0.4, 200, 3000), 57.2)
# --- poster / finale ---
place(sfx, whoosh(0.5, 0.5, 600, 5000), 59.0)
for i in range(18): n = int(0.05 * SR); place(sfx, (hp(noise(n), 2000) * np.exp(-t_(n) * 40)).astype(np.float32), 59.2 + i * 0.1, 0.18)
n = int(1.9 * SR); rise = (lp(noise(n), 3000) * np.linspace(0, 1, n) ** 2.2 * 0.6).astype(np.float32); place(sfx, rise, 62.5)
for t0 in [63.0, 63.4, 63.8, 64.1]: n = int(0.2 * SR); place(sfx, (hp(noise(n), 2500) * np.exp(-t_(n) * 15) * (np.sin(t_(n) * 700) > 0)).astype(np.float32), t0, 0.35)
place(sfx, boom(1.0, 0.6), 64.7, 0.8)
# --- meme cues from the user's library (5 only) ---
for fn, t0, g in [('snapchat-message.mp3', 14.35, 0.9), ('chinese-gong.mp3', 45.4, 0.9), ('awkward-moment.mp3', 49.8, 0.9), ('goofy-car-horn.mp3', 54.85, 0.9), ('glitch-gameboy.mp3', 57.3, 0.9)]:
    m = load(LIB + fn); place(sfx, m / max(np.abs(m).max(), 1e-6), t0, g)
# --- music bed: soft plucks, C Am F G, 96 bpm, stops under the finale ---
music = np.zeros(N, np.float32); beat = 60 / 96
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
def pluck(f, dur=0.5):
    n = int(dur * SR); t = t_(n); s = sum((0.5 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) for k in range(4)); return (s * env(n, 0.004, 0.18)).astype(np.float32)
prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [59, 62, 67])]
tt = 0.5; bar = 0
while tt < 62.5:
    root, ch = prog[bar % 4]
    for b in range(8):
        tb = tt + b * beat / 2
        if tb >= 62.5: break
        place(music, pluck(mid(ch[(b * 2 + bar) % 3] + 12), 0.45), tb, 0.5)
        if b % 4 == 0: place(music, pluck(mid(root), 0.7), tb, 0.7)
    bar += 1; tt += beat * 4
fade = int(2.0 * SR); music[int(62.5 * SR):] = 0; music[int(60.5 * SR):int(62.5 * SR)] *= np.linspace(1, 0, int(2.0 * SR)) ** 2
def save(x, path):
    x = np.clip(x, -1, 1); pcm = (np.stack([x, x], 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
sfx /= max(np.abs(sfx).max(), 1e-6) / 0.95; save(sfx, 'work/sfx.wav'); save(music / max(np.abs(music).max(), 1e-6) * 0.9, 'work/music.wav')
print('sfx/music written', N / SR)
