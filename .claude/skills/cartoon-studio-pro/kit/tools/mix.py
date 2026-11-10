# usage: python3 mix.py voice.mp3 music.wav sfx.wav  -> mix_raw.wav
# Music = 50% of voice gated RMS (-6 dB). SFX = 50% of voice gated RMS, peaks capped at 0.7x voice peak.
# Only linear gain + global peak safety scale. Finish with finish.sh (loudnorm).
import sys, subprocess, numpy as np, wave

def load(path, sr=48000):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).reshape(-1, 2).copy()

def gated_rms(x, sr=48000, block=0.4, gate_db=-40):
    n = int(block * sr)
    mono = x.mean(axis=1)
    blocks = [mono[i:i + n] for i in range(0, max(len(mono) - n, 1), n)]
    rms = np.array([np.sqrt(np.mean(b ** 2)) + 1e-12 for b in blocks])
    keep = rms > rms.max() * 10 ** (gate_db / 20)
    return float(np.sqrt(np.mean(rms[keep] ** 2)))

def write_wav(path, x, sr=48000):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())

voice_p, music_p, sfx_p = sys.argv[1:4]
sr = 48000
v = load(voice_p, sr); m = load(music_p, sr); s = load(sfx_p, sr)
L = len(v)
pad = lambda a: np.vstack([a[:L], np.zeros((max(0, L - len(a)), 2), np.float32)])
m, s = pad(m), pad(s)
v_rms = gated_rms(v, sr); v_peak = float(np.abs(v).max())
m_rms = gated_rms(m, sr)
s_rms = gated_rms(s, sr) if np.abs(s).max() > 0 else 1e-9
mg = 0.5 * v_rms / max(m_rms, 1e-9)
sg = 0.5 * v_rms / max(s_rms, 1e-9)
s_scaled = s * sg
s_peak = float(np.abs(s_scaled).max())
if s_peak > 0.7 * v_peak:
    s_scaled *= (0.7 * v_peak) / s_peak
mix = v + m * mg + s_scaled
peak = float(np.abs(mix).max())
if peak > 0.98:
    mix *= 0.98 / peak
write_wav('mix_raw.wav', mix, sr)
db = lambda a, b: 20 * np.log10(max(a, 1e-12) / max(b, 1e-12))
print(f"voice gated RMS {v_rms:.4f}")
print(f"music {db(gated_rms(m * mg, sr), v_rms):+.2f} dB vs voice (target -6.0)")
print(f"sfx   {db(gated_rms(s_scaled, sr), v_rms):+.2f} dB vs voice (target <= -6.0)")
print(f"mix peak {min(peak, 0.98):.3f} -> mix_raw.wav")
