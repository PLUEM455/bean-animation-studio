# Usage: python3 contact_sheet.py clip.mp4 sheet.png [count]  -> evenly spaced frames in one strip
import subprocess, sys, json
clip, out = sys.argv[1], sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=nb_frames', '-of', 'json', clip]))
total = int(info['streams'][0]['nb_frames']); idx = [int((i + 0.5) * total / n) for i in range(n)]
sel = '+'.join(f'eq(n\\,{i})' for i in idx)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', clip, '-vf', f"select='{sel}',scale=240:-2,tile={n}x1", '-frames:v', '1', out], check=True)
print(out, 'frames', idx)
