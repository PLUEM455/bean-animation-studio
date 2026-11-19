---
name: poster-to-clip
description: Turn one still image (poster, painting, illustrated quote card, artwork with calligraphy or captions) into a short cinematic MP4 with Three.js. The image's own lettering is painted out and then re-written stroke by stroke, the camera moves through the image in 2.5D parallax, and the clip gets water/mist/leaves, an optional seal stamp, and a soundtrack synthesized in code. Every frame is a pure function of time, so renders are identical each run. Use when the user says "make a clip/video from this image", "animate this poster", "ทำคลิปจากภาพนี้", "ทำภาพนี้ให้ขยับ", or uploads an artwork and asks for motion. Not for generating new footage (use an AI video skill) or for drawing a new cartoon from scratch (use animation-studio).
---

# Poster to clip

One image + one `config.json` → `clip.mp4` (H.264 + AAC, defaults to 1080 px wide, same aspect as the image).
Work without asking the user questions unless the image itself is unusable: read the image, decide, render, check, deliver.

## Pipeline

```
SK=<this skill dir>              # e.g. .claude/skills/poster-to-clip
bash $SK/scripts/new_project.sh <image> <project-dir>   # copies template, installs three (+ preinstalled playwright)
cd <project-dir>
python3 find_text.py source.png                          # ink rows -> text line boxes
#   ...write config.json (see below)...
python3 prep.py                                          # clean.png (text painted out), ink.png, depth.png
node render.mjs x.mp4 0,60,120,180                       # PNG stills only: still_000.png ...
python3 audio.py                                         # soundtrack.wav from the same timeline
node render.mjs clip.mp4                                 # full render, muxes soundtrack.wav if present
bash $SK/scripts/verify.sh clip.mp4                      # second render, MD5 compare -> must print DETERMINISTIC: yes
python3 $SK/scripts/contact_sheet.py clip.mp4 sheet.png  # look at it before delivering
```
A full render runs ~2–4 min for 360 frames on the container's software GL, so run it in the background (`run_in_background`) and wait for its notification.

## Writing config.json

All coordinates are **source-image pixels** (x right, y down). `template/config.json` is a complete worked example (a 1086×1448 Thai warrior poster with a 3-line verse and a signature); start from it and replace every value.

1. **Read the image** (Read tool) and note: where the lettering is, the main subject, water, sky/mountain bands, empty paper for a seal.
2. **`text.lines`** — one entry per written line in reading order: `box [x0,y0,x1,y1]` tight around the line (including its swashes), `start`/`end` seconds for its write-on. Get the y ranges from `find_text.py` (pass a region `x0 y0 x1 y1` to skip busy art, `--out mask.png` to see what counts as ink). Boxes must not include non-text art: anything dark inside a box gets erased and re-written. Up to 8 lines. `text.threshold` (default 18) lower = catches fainter ink. No text in the image → `"lines": []`.
3. **`depth`** — near = moves more. `far`/`near` set a top-to-bottom ground gradient; `shapes` paint flat values over it (`polygon` or `rect`, value 0–1): the main figure ~0.9, foreground trees ~0.6, the text block a flat ~0.35 so the lettering moves as one sheet. Keep polygons loose; `blur` hides their edges.
4. **`camera`** — keys `[t, centreX, centreY, zoom]`, eased between keys, auto-clamped inside the image. Zoom 1 = whole image. Usual story: open on the scenery (1.3) → each text line as it is written (1.5, framed so the full line width fits: view width = imageWidth/zoom) → signature + seal → hero/face (1.7–1.9) → pull back to the whole image (1.0–1.02) for the last 1–2 s. Hold the camera on the text while it is written.
5. **Ambient effects** — `waterfalls` rects (falling streaks + spray at the bottom), `rivers` rects (shimmer), `mist.bands` `[y0,y1]` with `minX` to keep it off the subject, `amount` 0.2–0.4 (mist is automatically kept off text boxes), `leaves` 0–16. Omit anything the image does not have.
6. **`seal`** — optional red stamp after the signature: `text` (1–3 chars; Thai renders with the Loma font), `x,y` centre, `size` px, `time`. Remove the key for no seal.
7. **`audio`** — wind always; water noise follows `waterLevel` keys `[t, gain]`; `drums` `[t, gain]`; brush scratches follow the text lines automatically; gong at the seal time; `plucks` `[t, Hz]` (pentatonic, e.g. 392, 440, 523.25, 587.33). Set `"audio": {}` for wind + brush only. Delete `soundtrack.wav` for a silent clip.
8. `duration`, `fps`, `outWidth`, `fadeIn`, `fadeOut` as needed. Keep the camera keys, text lines and seal inside `duration`.

## Checks before delivering

- Stills mid-line: the unwritten part of a line is plain paper (no grey ghost blobs). If blobs remain, raise `text.median` (e.g. 61) or lower `threshold`, then re-run `prep.py`.
- Nothing outside the text boxes gets erased (compare a still at t=0 of text-free areas with the source).
- Parallax: no visible tearing at the subject's edge. If it tears, reduce `parallax.sway` / `follow` or blur the depth more.
- The verify script prints `DETERMINISTIC: yes`.
- Look at the contact sheet. Report what was verified and what was not (e.g. audio is checked for level only, not by ear).

## Tell the user

What the clip does beat by beat (time → action), which elements were invented (seal, music), and any limitation (hand-authored depth, not ML depth).
