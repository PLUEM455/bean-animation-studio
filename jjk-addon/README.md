# JJK Addon (Minecraft Bedrock)

Mobs: **Satoru Gojo** (`jjk:gojo`), **Toji Fushiguro** (`jjk:toji`). No Experimental toggles needed.

## ติดตั้ง
เปิด `dist/JJK_Addon.mcaddon` → สร้างโลก → เปิดทั้ง *JJK Addon BP* และ *JJK Addon RP* → หาไข่เสกในโหมด Creative

## เปลี่ยนเสียงเป็นไฟล์ของคุณ
วางไฟล์ **Ogg Vorbis (mono, 44.1 kHz)** ทับชื่อเดิมใน `resource_pack/sounds/jjk/` แล้วรัน `tools/build.sh`
(build จะไม่เขียนทับไฟล์ที่มีอยู่แล้ว; สร้างเสียงสังเคราะห์ใหม่ทั้งหมดด้วย `python3 tools/gen_sounds.py --force`)

| ไฟล์ | ใช้ตอน |
|---|---|
| `step_1..3.ogg` | ฝีเท้า (ทั้งสองตัว) |
| `gojo_attack_1..2.ogg`, `toji_attack_1..2.ogg` | ตอนโจมตี |
| `gojo_hurt_1..2.ogg`, `toji_hurt_1..2.ogg` | โดนตี |
| `gojo_death.ogg`, `toji_death.ogg` | ตาย |

## Build
`tools/build.sh` — สร้างโมเดล/ท่าทาง/เอฟเฟกต์/เสียง → รันเทสต์ → `dist/JJK_Addon.mcaddon`
