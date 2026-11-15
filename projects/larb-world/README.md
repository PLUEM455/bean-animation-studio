# ถ้าโลกนี้ลาบคือของมีค่า?! (150 s, 1080x1920, 30 fps)

Built with the cartoon-studio-pro kit (`.claude/skills/cartoon-studio-pro/kit`).

- `web/story.js` shot plan (38 shots), captions, bubbles, overlays
- `web/main.js` sets (night city + market, wooden house by the field), ink pass, lens, 2D overlay
- `web/cast.js` 2D cast (hero, Tong, auntie, old man, investor, extras, cat)
- `vo/` narration clips (ElevenLabs, voice "Ohm", model eleven_v4), placed by `audio.py`
- `audio.py` synthesized music bed + SFX + ambience; `mix.py` locks music/SFX at -6 dB vs voice

Rebuild: run `bash .claude/skills/cartoon-studio-pro/kit/tools/setup.sh <dir>`, copy these files over, then
`cat web/toonbase.js web/cast.js > web/toon.js`, `node render.mjs frames 0-4499`, `python3 audio.py`,
`python3 mix.py work/voice.wav work/music.wav work/sfx.wav`, `bash finish.sh "larb-world"`.
Needs `web/Loma-Bold.otf` (TLWG Loma, GPL with font exception) copied from /usr/share/fonts/opentype/tlwg/.
