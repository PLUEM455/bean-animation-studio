"""Voice track + synthesized music bed + SFX/ambience for "ถ้าโลกนี้ลาบคือของมีค่า?!" (all generated here, no samples)."""
import numpy as np, subprocess, wave

SR = 48000; DUR = 150.0; N = int(DUR * SR)
rng = np.random.default_rng(11)

VO = [(0.30, 's01'), (5.00, 's02'), (14.80, 's03'), (26.40, 's04'), (37.00, 's05'), (48.50, 's06'), (61.00, 's07'),
      (75.00, 's08'), (89.50, 's09'), (103.50, 's10'), (117.50, 's11'), (134.00, 's12')]

def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def place(buf, x, t, g=1.0):
    i = int(t * SR); j = min(N, i + len(x))
    if j > i: buf[i:j] += x[:j - i] * g

def write(path, x):
    x = np.clip(x, -1, 1); st = np.stack([x, x], 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())

def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)
def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (fc / np.maximum(f, 1)) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)
def bp(x, lo, hi): return hp(lp(x, hi), lo)
T = lambda d: np.arange(int(d * SR)) / SR
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)

# ---------------- voice ----------------
voice = np.zeros(N, np.float32)
for t, k in VO: place(voice, load(f'vo/{k}.mp3'), t)

# ---------------- instruments ----------------
def pluck(f, d=0.35):
    t = T(d); s = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.4 for h in range(1, 6))
    return (s * np.exp(-t * 9) * np.minimum(1, t / 0.003)).astype(np.float32)
def marimba(f, d=0.45):
    t = T(d); s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30)
    return (s * np.exp(-t * 7) * np.minimum(1, t / 0.002)).astype(np.float32)
def bass(f, d=0.3):
    t = T(d); s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return (s * np.exp(-t * 6) * np.minimum(1, t / 0.005)).astype(np.float32)
def pad(fs, d, a=0.4):
    t = T(d); s = sum(np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.3 * t) * 0.4) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for f in fs) / len(fs)
    env = np.minimum(1, t / a) * np.minimum(1, (d - t) / a).clip(0); return (lp(s.astype(np.float32), 1800) * env).astype(np.float32)
def kick():
    t = T(0.3); f = 50 + 100 * np.exp(-t * 35); return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10)).astype(np.float32)
def snare():
    t = T(0.16); return hp((rng.standard_normal(len(t)) * np.exp(-t * 30) * 0.6 + np.sin(2 * np.pi * 200 * t) * np.exp(-t * 25) * 0.4).astype(np.float32), 400)
def hat():
    t = T(0.05); return hp((rng.standard_normal(len(t)) * np.exp(-t * 90)).astype(np.float32), 6000)
def wood():
    t = T(0.08); return (np.sin(2 * np.pi * 1100 * t) * np.exp(-t * 60)).astype(np.float32)

music = np.zeros(N, np.float32)
def groove(t0, t1, bpm, prog, lead=True, drums=True, gain=1.0, inst=marimba):
    beat = 60 / bpm; t = t0; bar = 0
    while t < t1 - 0.05:
        root, ch = prog[bar % len(prog)]
        for b in range(4):
            tb = t + b * beat
            if tb >= t1: break
            place(music, bass(midi(root - 12)), tb, 0.55 * gain * (1 if b % 2 == 0 else 0.7))
            if drums:
                if b % 2 == 0: place(music, kick(), tb, 0.5 * gain)
                else: place(music, snare(), tb, 0.28 * gain)
                place(music, hat(), tb + beat / 2, 0.12 * gain)
            else: place(music, wood(), tb, 0.12 * gain)
            if lead:
                for k in range(2):
                    n = ch[(b * 2 + k + bar) % len(ch)] + 12
                    place(music, inst(midi(n)), tb + k * beat / 2, 0.16 * gain)
        bar += 1; t += beat * 4

P1 = [(60, [60, 64, 67, 72]), (65, [65, 69, 72, 76]), (67, [67, 71, 74, 79]), (60, [64, 67, 72, 67])]
P2 = [(57, [57, 60, 64, 69]), (62, [62, 65, 69, 74]), (64, [64, 68, 71, 76]), (57, [60, 64, 69, 64])]
P3 = [(62, [62, 66, 69, 74]), (67, [67, 71, 74, 79]), (69, [69, 73, 76, 81]), (62, [66, 69, 74, 69])]
groove(0.0, 26.0, 112, P1)
groove(26.0, 36.0, 100, P1, drums=False, inst=pluck, gain=0.8)
place(music, pad([midi(57), midi(60), midi(64)], 12.0), 36.0, 0.35)
for i in range(24): place(music, wood(), 36.2 + i * 0.5, 0.1)
groove(48.0, 60.0, 116, P2, gain=0.9)
groove(60.0, 74.0, 104, P2, drums=False, inst=pluck, gain=0.85)
groove(74.0, 88.0, 132, P1, gain=1.0)
groove(88.0, 102.0, 108, P3, gain=0.95)
groove(102.0, 110.8, 140, P3, gain=1.0)
t = T(1.6); f = 330 * 2 ** (-t * 1.1); wah = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 5 * t)) * np.exp(-t * 0.8)
place(music, lp(wah.astype(np.float32), 2500), 110.9, 0.6)
groove(112.5, 116.0, 90, [(57, [57, 60, 64, 60])], drums=False, inst=pluck, gain=0.6)
place(music, pad([midi(45), midi(52), midi(57)], 16.0, 2.0), 116.0, 0.45)
for i in range(12): place(music, bass(midi(33), 0.6), 116.5 + i * 1.3, 0.35)
place(music, pad([midi(46), midi(53), midi(58)], 14.4, 0.8), 132.0, 0.45)
for i in range(22): place(music, bass(midi(34), 0.25), 132.2 + i * 0.65, 0.4)
st = T(2.0); sting = (np.sin(2 * np.pi * midi(34) * st) + 0.5 * np.sin(2 * np.pi * midi(41) * st)) * np.exp(-st * 1.4)
place(music, sting.astype(np.float32), 148.0, 0.6)

# ---------------- ambience ----------------
amb = np.zeros(N, np.float32)
def fade(x, a=0.3):
    n = len(x); k = min(int(a * SR), n // 2); e = np.ones(n, np.float32); e[:k] = np.linspace(0, 1, k); e[-k:] = np.linspace(1, 0, k); return x * e
CITY = [(0, 26), (82, 116)]; RURAL_DAY = [(26, 36)]; INSIDE = [(36, 80), (132, 146.5)]; RURAL_NIGHT = [(80, 82)]; RAIN = [(116, 146.5), (148, 150)]
for a, b in CITY:
    place(amb, fade(lp(noise(b - a), 300) * 0.5 + bp(noise(b - a), 800, 2500) * 0.05), a, 0.6)
    for k in np.arange(a + 1.0, b - 2.4, 3.7):
        t = T(2.4); e = np.exp(-((t - 1.2) / 0.5) ** 2); place(amb, (lp(noise(2.4), 900) * e).astype(np.float32), k, 0.9)
for a, b in RURAL_DAY:
    n = int((b - a) * SR); x = lp(noise(b - a), 500) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.2 * np.arange(n) / SR)); place(amb, fade(x.astype(np.float32)), a, 0.5)
    for k in np.arange(a + 0.5, b, 1.3): t = T(0.18); place(amb, (np.sin(2 * np.pi * (2800 + 900 * t / 0.18) * t) * np.exp(-t * 18)).astype(np.float32), k, 0.08)
def crickets(a, b, g=0.06):
    for k in np.arange(a, b, 0.42):
        t = T(0.12); ch = np.sin(2 * np.pi * 4600 * t) * (np.sin(2 * np.pi * 60 * t) > 0) * np.exp(-t * 8); place(amb, ch.astype(np.float32), k + rng.random() * 0.1, g)
for a, b in INSIDE:
    crickets(a, b, 0.035)
    for k in np.arange(a, b, 0.11):
        if rng.random() < 0.35: t = T(0.02); place(amb, hp((noise(0.02) * np.exp(-t * 300)).astype(np.float32), 1500), k, 0.25 * rng.random())
for a, b in RURAL_NIGHT: crickets(a, b, 0.08); place(amb, fade(lp(noise(b - a), 400)), a, 0.4)
for a, b in RAIN: place(amb, fade(bp(noise(b - a), 600, 7000) * 0.5 + lp(noise(b - a), 200) * 0.3, 0.5), a, 0.45 if a >= 132 else 0.8)

# ---------------- sfx ----------------
sfx = np.zeros(N, np.float32)
def whoosh(d=0.35):
    t = T(d); e = np.sin(np.pi * t / d) ** 2; return (bp(noise(d), 500, 4000) * e).astype(np.float32)
def pop():
    t = T(0.09); return (np.sin(2 * np.pi * (500 + 900 * t / 0.09) * t) * np.exp(-t * 40)).astype(np.float32)
def boing(f0=180, d=0.5):
    t = T(d); f = f0 * (1 + 0.6 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4)); return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)).astype(np.float32)
def ding(f=1320):
    t = T(0.9); return ((np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-t * 4)).astype(np.float32)
def crunch():
    t = T(0.25); return (bp(noise(0.25), 1500, 6000) * np.exp(-t * 14) * (np.sin(2 * np.pi * 40 * t) > -0.2)).astype(np.float32)
def clatter(n=20):
    x = np.zeros(int((0.05 * n + 0.3) * SR), np.float32)
    for i in range(n):
        t = T(0.12); c = np.sin(2 * np.pi * (1800 + 900 * rng.random()) * t) * np.exp(-t * 35); s = int((0.05 * i + 0.03 * rng.random()) * SR); x[s:s + len(c)] += c[:len(x) - s] * 0.5
    return x
def meow():
    t = T(0.6); f = 520 + 280 * np.sin(np.pi * t / 0.6); s = sum(np.sin(2 * np.pi * np.cumsum(f * h) / SR) / h for h in (1, 2, 3)); return (s * np.sin(np.pi * t / 0.6) ** 0.5 * 0.6).astype(np.float32)
def thunder():
    t = T(3.5); return (lp(noise(3.5), 300) * (np.exp(-t * 1.2) + 0.6 * np.exp(-((t - 0.4) / 0.2) ** 2))).astype(np.float32) * 2
def hit():
    t = T(1.2); s = sum(np.sin(2 * np.pi * midi(m) * t) for m in (46, 53, 58, 65)) + bp(noise(1.2), 200, 3000) * 0.4 * np.exp(-t * 8); return (s * np.exp(-t * 3) * 0.5).astype(np.float32)
def sniffs():
    x = np.zeros(int(0.9 * SR), np.float32)
    for i in range(3): t = T(0.14); s = int(i * 0.25 * SR); x[s:s + len(t)] += (bp(noise(0.14), 1500, 5000) * np.sin(np.pi * t / 0.14)).astype(np.float32)
    return x
def puff():
    t = T(1.2); return (lp(noise(1.2), 800) * np.minimum(1, t / 0.1) * np.exp(-t * 2)).astype(np.float32)
def stir():
    x = np.zeros(int(2 * SR), np.float32)
    for i in range(16): t = T(0.07); s = int(i * 0.125 * SR); x[s:s + len(t)] += (np.sin(2 * np.pi * 900 * t) * np.exp(-t * 50)).astype(np.float32)
    return x

for t in [2.4, 5.0, 7.0, 9.0, 11.0, 26.0, 28.0, 30.0, 33.0, 48.0, 50.0, 53.0, 56.0, 74.0, 76.0, 78.0, 80.0, 82.0, 85.0, 102.0, 104.0, 106.0, 108.0, 110.0, 112.0, 114.0, 132.0, 135.0, 138.0, 141.0, 143.5]:
    place(sfx, whoosh(), t - 0.18, 0.5)
for t in [3.5, 22.9]: place(sfx, sniffs(), t, 0.5)
place(sfx, ding(1760), 4.3, 0.35)
for t in [5.4, 7.2, 8.0, 50.9, 53.6, 64.6, 70.4, 72.3, 80.4, 91.0, 96.0, 102.2, 108.2]: place(sfx, pop(), t, 0.45)
place(sfx, clatter(3), 9.1, 0.5)
place(sfx, crunch(), 11.95, 0.9)
place(sfx, meow(), 22.6, 0.5); place(sfx, boing(260, 0.5), 23.6, 0.6)
place(sfx, boing(150, 0.6), 34.4, 0.4)
for i in range(5): place(sfx, wood(), 37.0 + i * 1.2, 0.6)
for i in range(5): place(sfx, boing(400 + i * 60, 0.25), 43.5 + i * 0.6, 0.35)
place(sfx, pop(), 50.25, 0.5)
place(sfx, puff(), 53.3, 0.8)
place(sfx, boing(120, 0.7), 61.6, 0.5); place(sfx, boing(90, 0.9), 64.6, 0.6)
place(sfx, whoosh(0.3), 68.4, 0.6)
place(sfx, stir(), 74.0, 0.4)
for t in [74.1, 76.1, 78.1]: place(sfx, ding(), t, 0.45)
place(sfx, clatter(20), 82.5, 0.8)
place(sfx, boing(200, 1.2), 85.2, 0.3)
place(sfx, ding(990), 104.2, 0.25); place(sfx, ding(1180), 106.2, 0.25)
place(sfx, thunder(), 126.85, 0.9)
place(sfx, hit(), 141.35, 0.8)
sfx = sfx + amb
for x in (music, sfx): x[int(146.5 * SR):int(148.0 * SR)] = 0   # freeze frame: total silence
write('work/voice.wav', voice); write('work/music.wav', music); write('work/sfx.wav', sfx)
print('ok', N / SR)
