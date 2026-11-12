# Basic Animation + Combat + FX + Sound (Gojo & Toji) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** ทั้งสองตัวมีท่าทางลื่น (ยืน/เดิน/วิ่ง/โจมตี/โดนตี/ตาย), ต่อสู้ระยะประชิดแบบเป็นกลาง, เอฟเฟกต์ติดตัว, เสียงพื้นฐาน — เสถียร ไม่ต้องเปิด Experimental

**Architecture:** พฤติกรรมด้วย component JSON ล้วน (ไม่ใช้ Script API ในรอบนี้ → ไม่ต้องเปิด Beta APIs). ท่าทาง/particle/เสียง สร้างด้วยสคริปต์ Python (`gen_anims.py`, `gen_fx.py`, `gen_sounds.py`) เพื่อแก้ซ้ำได้. animation controller ร่วม (`controller.animation.jjk.*`) ใช้ชื่อท่าสั้นเดียวกันทั้งสองตัว. การเดิน/วิ่งใช้ blend ด้วยน้ำหนักตาม `q.ground_speed` (ไม่มีการตัดท่ากระตุก). ท่าโจมตีเริ่มจาก `v.attack_time > 0` (ต้องมี melee AI, ห้ามมี `runtime_identifier` — อ้างอิง wiki.bedrock.dev / MCPE-110042).

**Spec:** `2026-11-12-jjk-gojo-addon-design.md`, `2026-11-12-jjk-toji-mob-design.md`

## Global Constraints
- ไม่ใช้ฟีเจอร์ Experimental / Beta APIs
- ดาเมจพื้นฐาน: โกโจหมัด 8, Toji ดาบ 14
- เป็นกลาง: `hurt_by_target` + `nearest_attackable_target` (family `monster`) — ไม่โจมตีผู้เล่นก่อน
- boss bar: แสดงเมื่อโดนดาเมจ แล้วหายหลังไม่โดน 20 วินาที (`damage_sensor` → group `jjk:combat` + `timer`)
- ไฟล์เสียงชื่อคงที่ใน `resource_pack/sounds/jjk/` (ผู้ใช้เปลี่ยนไฟล์ได้)

## Review Focus
1. `v.attack_time` ไม่ทำงาน → ห้าม `runtime_identifier`; เทสต์ว่ามี melee_attack และไม่มี runtime_identifier
2. animation อ้าง bone ที่ไม่มี → ท่าเสีย/log error → เทสต์ bone ทุกตัวมีใน geometry
3. particle/sound key ที่ไม่ได้ประกาศ → เงียบ/ไม่มีเอฟเฟกต์ → เทสต์ทุก key ใน animation/controller ถูกประกาศและไฟล์มีจริง
4. ท่าตายค้าง/วนซ้ำ → death `loop: "hold_on_last_frame"` + state แยก
5. ไฟล์เสียงไม่ใช่ Vorbis → เกมไม่เล่น → เทสต์ header `OggS` + `vorbis`

## Tasks
- [ ] **T1 Behavior:** attack/melee/hurt_by_target/nearest_attackable_target/boss-group ทั้งสองตัว (เทสต์ก่อน)
- [ ] **T2 Locators:** modelkit รับ `locators`; gojo: eye_l, eye_r, hand_r, feet, center; toji: hand_r, feet, center, slash (เทสต์ก่อน)
- [ ] **T3 Animations + controllers + client entity wiring** (`gen_anims.py`, `animation_controllers/jjk.animation_controllers.json`) (เทสต์ก่อน)
- [ ] **T4 Particles** (`gen_fx.py` → `particles/*.json`, `textures/particle/jjk_particles.png`): eye_glow, aura, run_dust, gojo_hit, toji_slash, gojo_death, toji_death (เทสต์ก่อน)
- [ ] **T5 Sounds** (`gen_sounds.py` → `.ogg`, `sound_definitions.json`, `sounds.json`): step, gojo attack/hurt/death, toji attack/hurt/death (เทสต์ก่อน)
- [ ] **T6 Build + ส่ง `.mcaddon` + วิธีเปลี่ยนเสียงใน README**
