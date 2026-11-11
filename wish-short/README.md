# wish-short — "ถ้าคนทั้งโลกขอพรได้ข้อเดียว" (65 s, 1080x1920, 30 fps)
Built on the cartoon-studio-pro kit (2D bean cards in an inked 3D world, headless Chromium + three.js).
- `web/story.js` shot plan / actors / fx timeline, `web/main.js` world + 3D props (tank, flying car, machine gun, robot) + post
- `place_voice.py` cuts the narration into phrase blocks and places them (no stretching); `audio_wish.py` SFX + music bed; `mix2.py`; `make_ass.py` Thai subtitles (Prompt font, OFL)
- Render: `node render.mjs frames 0-1949`, then ffmpeg with `ass=work/wish.ass:fontsdir=fonts`.
Not included: rendered frames, the narration mp3 and the meme sounds (they live in the user's sound artifact).
