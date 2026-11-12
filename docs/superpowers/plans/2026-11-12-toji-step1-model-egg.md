# Toji Step 1: Model + Weapons + Texture + Spawn Egg — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.mcaddon` เดิมมีเพิ่ม `jjk:toji` โมเดล 2.5D ถืออาวุธ + ไข่เสก "Toji Fushiguro" (ยังไม่มีอนิเมชัน/AI/สกิล)

**Architecture:** แยกโค้ดร่วมจาก `gen_gojo_model.py` เป็น `tools/modelkit.py` (pack UV, faces, ระบายสี, เขียน geo, พรีวิว) แล้วใช้กับทั้งสองตัว. อาวุธเป็น bone ลูกของ `rightArm`; render controller ซ่อน/แสดงด้วย `part_visibility` (ขั้นนี้แสดง katana อย่างเดียว).

**Tech Stack:** เหมือนแผนโกโจ: Bedrock JSON, Python + Pillow, Node `node:test`, zip

**Spec:** `docs/superpowers/specs/2026-11-12-jjk-toji-mob-design.md` (+ กฎร่วมใน `2026-11-12-jjk-gojo-addon-design.md`)

## Global Constraints
- entity `jjk:toji`, เลือด 400, เกิดจากไข่เท่านั้น, เป็นกลาง (พฤติกรรมต่อสู้ = ขั้น 3)
- สี: ผมดำ, ตาดำมีเงา, แผลเป็นมุมปาก, เสื้อดำรัดรูป, หนอนม่วงพันเฉียง, กางเกงขาวหลวม, เข็มขัดผ้าดำ, รองเท้าดำ
- อาวุธ 5 ชิ้นเป็น bone: `katana`, `playfulCloud`, `spear`, `chain`, `pistol`
- ไข่: โทนดำ-ม่วง-ขาว, ชื่อ "Toji Fushiguro"; th: "ไข่เสก Toji Fushiguro"
- ห้ามเปลี่ยนผลลัพธ์ของโกโจ (geo/texture ต้อง byte-identical หลัง refactor)

## Review Focus
1. refactor ทำให้โมเดลโกโจเปลี่ยนโดยไม่ตั้งใจ → Task 1 ตรวจ `git diff --exit-code` บนไฟล์ผลลัพธ์โกโจ
2. อาวุธทั้งหมดแสดงพร้อมกันในมือ → Task 3 เทสต์ `part_visibility`
3. หนอนพันตัวซ้อนเสื้อแล้วกะพริบ → Task 3 เทสต์ inflate ของ `worm`
4. ไข่/ชื่อ Toji ทับของโกโจใน lang หรือ item_texture → Task 4 เทสต์ว่าคีย์โกโจยังอยู่
5. แพ็กมี Toji แต่ไม่มีโกโจ (หรือกลับกัน) → Task 5 เทสต์รายการไฟล์ใน `.mcaddon`

---

### Task 1: แยก `tools/modelkit.py`
**Files:** Create `jjk-addon/tools/modelkit.py`; Modify `jjk-addon/tools/gen_gojo_model.py`
**Produces:** `modelkit.build(name: str, bones: list, cubes: list, painters: dict[str, Callable], palette: dict, tex: int, preview_name: str)` — เขียน `models/entity/{name}.geo.json`, `textures/entity/{name}.png`, `preview/{name}_preview.png`; helpers `fill, clear, put, shade, faces, spike`
- [ ] ย้ายโค้ดร่วม; `gen_gojo_model.py` เหลือ palette + BONES + CUBES + painters ของโกโจ
- [ ] รัน `python3 jjk-addon/tools/gen_gojo_model.py && git diff --exit-code jjk-addon/resource_pack` → ไม่มี diff
- [ ] เทสต์ทั้งหมดผ่าน; commit `refactor(jjk): shared modelkit`

### Task 2: Behavior entity `jjk:toji`
**Files:** Create `behavior_pack/entities/toji.json`; Modify `tests/entity.test.mjs` (วนทดสอบทั้งสองตัว)
- [ ] เทสต์: id `jjk:toji`, spawnable/summonable, health 400/400, collision 0.6×1.8, ไม่มี spawn_rules → FAIL
- [ ] เขียนไฟล์ (components เหมือนโกโจ, `movement` 0.36, `type_family ["toji","jjk","mob"]`) → PASS; commit

### Task 3: โมเดล Toji + อาวุธ + client entity
**Files:** Create `tools/gen_toji_model.py`, `resource_pack/entity/toji.entity.json`, `resource_pack/render_controllers/toji.render_controllers.json`; Modify `tests/model.test.mjs` (พารามิเตอร์ต่อตัวละคร)
**Produces:** geometry `geometry.jjk.toji`; bones ร่วมชื่อเดียวกับโกโจ + `worm, katana, playfulCloud, spear, chain, pistol`
- [ ] เทสต์ (ใช้ชุดเดียวกับโกโจ + เพิ่ม): bones ครบ; `worm` cube ≥ 5 และ inflate > 0; weapon bones มี parent `rightArm`; render controller `part_visibility` katana `true`, อีก 4 ชิ้น `false`; texture ขนาดตรง `texture_width/height` → FAIL
- [ ] เขียน generator: ผมดำปอยยุ่ง (≥ 6 ปอย), หน้า+แผลเป็น, เสื้อดำ, หนอนข้อ ๆ พันเฉียงจากไหล่ขวาลงเอวซ้าย + หัวหนอนมีปาก, กางเกงขาวหลวม + เข็มขัดดำปม, รองเท้า; อาวุธ: katana (ใบเงิน/ด้ามพันผ้า), playfulCloud (3 ท่อนแดงเข้ม), spear (ใบสองแฉก + ด้าม), chain (ข้อโซ่ 4 ข้อ), pistol
- [ ] รัน generator + ดูพรีวิว (พรีวิวรวมภาพอาวุธ) → เทสต์ PASS; commit

### Task 4: ไข่เสก + ชื่อ
**Files:** Modify `tools/gen_icons.py` (ฟังก์ชันไข่รับพาเลต), `item_texture.json`, `en_US.lang`, `th_TH.lang`, `toji.entity.json`; Modify `tests/egg.test.mjs`
- [ ] เทสต์: `spawn_egg.texture === "jjk_toji_spawn_egg"`, png 32×32, คีย์ lang ของ Toji ครบ **และคีย์โกโจยังอยู่** → FAIL
- [ ] ไข่: บนดำ (ผม) แถบม่วงเฉียง (หนอน) ล่างขาว + แผลเป็นเส้นเล็ก; รัน → PASS; commit

### Task 5: Build รวมสองตัว
**Files:** Modify `tools/build.sh`, `tests/build.test.mjs`
- [ ] เทสต์: archive มีไฟล์ทั้งโกโจและ Toji (entity, geo, texture, egg) → FAIL
- [ ] build.sh รัน `gen_toji_model.py` ด้วย → PASS; commit; push; ส่ง `.mcaddon` + พรีวิว
- [ ] ผู้ใช้ทดสอบ: เสก Toji, ถือดาบ, หนอนไม่กะพริบ, สีตรงสกินอ้างอิง; โกโจยังเหมือนเดิม
