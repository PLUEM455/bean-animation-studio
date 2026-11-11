# Cut the narration into phrase blocks (at silence midpoints) and place them on the picture timeline. No stretching.
import subprocess, numpy as np, wave
SR = 48000; TOTAL = 65.0
src = subprocess.run(['ffmpeg','-v','error','-i','work/lib/sounds/content-1.mp3','-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
v = np.frombuffer(src, np.float32)
# (orig_start, orig_end, new_start, label)
BLOCKS = [(0.00,2.95,0.20,'A hook'),(4.00,6.72,3.60,'B'),(7.08,8.84,6.70,'C'),(9.02,11.34,8.80,'D'),(11.82,14.60,11.30,'EFG'),
 (15.16,18.92,22.00,'H'),(19.34,21.16,29.00,'I'),(21.45,22.62,37.80,'J'),(23.18,25.37,41.30,'K'),(26.25,29.17,46.80,'LM'),
 (29.72,31.60,50.30,'NO'),(32.22,33.80,61.30,'P')]
out = np.zeros(int(TOTAL*SR), np.float32); fade = int(0.012*SR)
for a,b,n,l in BLOCKS:
    seg = v[int(a*SR):int(b*SR)].copy()
    seg[:fade] *= np.linspace(0,1,fade); seg[-fade:] *= np.linspace(1,0,fade)
    i = int(n*SR); out[i:i+len(seg)] += seg
    print(f'{l:5s} orig {a:5.2f}-{b:5.2f}  ->  new {n:5.2f}-{n+(b-a):5.2f}')
pcm = (np.clip(out,-1,1)*32767).astype('<i2')
with wave.open('work/voice.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('voice.wav', len(out)/SR, 's')
