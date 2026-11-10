---
name: cartoon-studio-pro
description: Premium 2.5D cartoon short director. Runs brief -> storyboard -> user approval -> production (2D hero characters in a 3D foreground / 2D backdrop world, 3D weapons/vehicles, fast 2-5 s cuts, pro hooks, meme-library sound). Use for any request to make a polished vertical animated short, "สร้างคลังการ์ตูน/คลิปอนิเมชัน 2.5D", or when the user wants storyboard-first animation. Builds on the cartoon-audio-short engine kit.
---

# Cartoon Studio Pro: brief -> storyboard -> approval -> production

Same engine family as `cartoon-audio-short` (its kit is bundled in this skill folder at `kit/`, including `mix.py`), but director-led: nothing is built before the user approves a storyboard. Output: 1080x1920, 30 fps MP4 (60 fps is optional; the user said it is not required).

## Hard rules
- **No production before approval.** Stages 0-1 are conversation only. Do not install, render or generate paid audio until the user approves the storyboard.
- Characters are **2D only** (never 3D). Quality over speed: no placeholder faces, no stiff poses.
- Weapons (ranged and melee), vehicles, and anything where 3D reads better are **always 3D**. Buildings/props near camera are 3D; far backdrop is 2D; small numerous things (seeds, leaves, bullets, sparks) are 2D sprites.
- Stories are original. No real named living people, no brand mascots/logos. Verify any "true" fact with a web search and cite the source; say plainly when something is a legend or from general knowledge.
- Never edit or re-time the voice. Picture is timed to it; each reaction lands 0-3 frames before its word.
- Report only what was actually checked. If something could not be verified (e.g. audio cannot be heard), say so.

## Stage 0: Brief (ask, don't guess)
Ask one focused question at a time until clear: topic and purpose, audience/platform, target length, narration language, tone, must-haves, banned content, and which libraries to use (meme sounds, meme images, 3D model library). If the user already gave these, write them back as a short note and invite correction.

## Stage 1: Storyboard (present, then wait for "approved")
Deliver a table, one row per shot:
`# | time (s) | narration | visual | shot size | camera move | transition | SFX/meme cue | assets (2D cast / 3D props / 2D backdrop)`

Pacing rules:
- **Cut every 2-5 s.** Hold longer only for a payoff and say why.
- Never repeat the same shot size or camera move twice in a row. Vary: extreme close-up, medium, wide, insert, low angle, over-the-shoulder, whip, push-in, orbit, rack focus, Dutch tilt on tension.
- Every move is motivated (follows a character, reveals a prop, builds dread). No static holds over ~1 s without creep.
- Hook in the first 2 s, written as pro hook formulas, e.g. "ในปี ____ ..." / "ในวันที่ ____ ..." / "ถ้าเรา ____ จะเกิดอะไรขึ้น?" / "ทุกคนรู้ไหมว่า ____". Open on a paradox or a question the video pays off at the end.
- Escalate in beats; end on a twist or ironic payoff that lands on the last word.
- Flag any shot that needs an asset the libraries do not have, so the user can decide before production.

## Stage 2: Asset plan
- **Characters (2D, premium):** per hero: 8 view directions (front, 3/4 front, side, 3/4 back, back and mirrors), a pose library, an expression set that blends (not just swaps), and layered outfits (clothing drawn as separate layers with folds, so costume changes do not need redrawing). Motion uses anticipation, overshoot, follow-through, weight shift, and secondary motion for cloth and hair. Rotation between views is done by pre-drawn views joined with smooth transitions; true out-of-plane rotation of one 2D drawing is not possible, so say so when planning.
- **3D props:** check the 3D model library artifact first. Build missing ones in three.js and, when approved, save them to the library artifact for reuse.
- **Backdrop:** 2D painted layers far away; 3D set pieces in front.

## Stage 3: Voice and timing
Reuse the bundled kit (`kit/tools/setup.sh`, `timing.py`). Gaps found on the Dust Creek job:
- `timing.py` is English-oriented. For Thai, split phrases by line and count Thai letters instead of syllables, or install faster-whisper for word timestamps.
- Check `work/phrases.json`: pauses must fall at sentence ends. Cannot hear audio; say so.

## Stage 4: Build
Follow `cartoon-audio-short` Stage 4 (world, cast, motion, look check) with the standards above. Practical traps:
- **Narrow vertical frame:** horizontal half-width = distance * tan(hfov/2), hfov = 2*atan(tan(vfov/2) * 0.5625). A 20 m span needs ~60 m camera distance, so stage characters in depth, use cuts, or crane high instead of wide side shots. Rooftops of a facing row block high wide shots.
- Cards are billboards: they always face the camera (yaw only). The camera side decides which way "screen-right" is.
- No Thai font in the sandbox: put diegetic text in English or numerals, or load a Thai font.
- `setup.sh` does not copy `finish.sh`; copy it from the kit's tools folder.
- Render ~2 s/frame on CPU: always review a stills contact sheet before the full render, then render in the background with `RESUME=1` and watch progress.
- If a host such as elevenlabsusercontent.com is blocked, the user must download the generated audio and upload it.

## Stage 5: Sound
Pick from the user's meme-sound library artifact first (ask for its URL; read it with the Artifact tool, action `read`). Synthesized SFX and music are the fallback. Mix only with `mix.py` (music and SFX locked relative to voice; finish.sh applies loudness).

## Stage 6: QA and delivery
Contact sheet per shot (framing, mirrored text, characters out of frame), freeze/black detection, loudness, duration vs voice. State exactly what was checked and what was not. Deliver the MP4, list each shot in one line, offer fixes, and offer to save new 3D models and assets to the library artifacts.

## Status of this skill (be honest with the user)
Built: the workflow, rules, pacing and QA standards above, plus the proven engine kit it relies on.
Not yet built (phase 2, needs separate work and art): the 8-direction character rig and blending expression system, cloth-layer system, high-quality 3D weapon/vehicle models, and automatic connection to the meme-sound, meme-image and 3D-model library artifacts.
