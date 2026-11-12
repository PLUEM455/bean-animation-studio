# Gojo Step 1: Model + Texture + Spawn Egg — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ผู้ใช้ติดตั้ง `JJK_Addon.mcaddon` แล้วใช้ไข่เสก "Satoru Gojo" เสกโกโจโมเดล 2.5D ยืนอยู่ในโลกได้ (ยังไม่มีท่าทาง/AI/สกิล)

**Architecture:** Behavior Pack + Resource Pack ใน `jjk-addon/` ผูกกันด้วย dependency ใน manifest. เท็กซ์เจอร์และไอคอนไข่สร้างด้วยสคริปต์ Python (Pillow) เพื่อแก้ซ้ำได้. ตรวจความถูกต้องด้วย Node `node:test` (ไม่มี dependency ภายนอก).

**Tech Stack:** Bedrock add-on JSON, Python 3 + Pillow 12, Node 22 (`node:test`), `zip`

**Spec:** `docs/superpowers/specs/2026-11-12-jjk-gojo-addon-design.md`

## Global Constraints
- เป้าหมาย: Minecraft Bedrock v26.52; manifest `format_version: 2`, `min_engine_version: [1, 21, 0]`
- namespace: `jjk`, entity id: `jjk:gojo`
- เลือด 500; เกิดจากไข่เท่านั้น (ห้ามมีไฟล์ `spawn_rules`)
- โมเดล 2.5D = ทรงสกินผู้เล่น + ชิ้นนูน (ผมชี้ออก, เสื้อ/เข็มขัดหนา); สี: ผมขาว, ตาฟ้า, เสื้อดำ, กางเกงเทา, เข็มขัดผ้ากรมท่า, รองเท้าดำ
- ไข่: ไอคอนเฉพาะโทนขาว-ฟ้า-ดำ, ชื่อ "Satoru Gojo"
- ห้ามทำลวก: ทุกชิ้นของโมเดลต้องมี UV ในขอบเขตเท็กซ์เจอร์ ไม่มีพื้นที่เท็กซ์เจอร์ว่างโปร่งใสบนหน้าที่มองเห็น

## Review Focus
1. ชิ้นผม/เสื้อนูนซ้อนกับชิ้นหลักแล้วเกิด z-fighting (กะพริบ) → ชิ้นซ้อนต้องมี `inflate` > 0 — เทสต์ใน Task 3
2. ชิ้นผมมีช่องโปร่งใส แต่ material ไม่รองรับ alpha → เห็นเป็นสีดำ → client entity ต้องใช้ `entity_alphatest` — เทสต์ใน Task 3
3. UV ของ cube เกินขนาดเท็กซ์เจอร์ → หน้าเป็นสีม่วง/ว่าง — เทสต์ใน Task 3
4. ไข่ไม่โผล่ในเมนู Creative หรือชื่อเป็น key ดิบ → ต้องมี `is_spawnable` และ key ภาษาใน lang — เทสต์ใน Task 4
5. ติดตั้งแล้วแพ็กไม่ผูกกัน (เปิด BP แล้ว RP ไม่ตามมา) → BP ต้อง depend uuid ของ RP header — เทสต์ใน Task 1

---

### Task 1: Pack scaffold + validator

**Files:**
- Create: `jjk-addon/behavior_pack/manifest.json`, `jjk-addon/resource_pack/manifest.json`
- Create: `jjk-addon/resource_pack/pack_icon.png`, `jjk-addon/behavior_pack/pack_icon.png` (สร้างจาก Task 4 generator; Task 1 ใส่ไฟล์ชั่วคราวได้)
- Create: `jjk-addon/tools/lib.mjs`, `jjk-addon/tests/manifest.test.mjs`

**Interfaces:**
- Produces: `readJson(relPath: string) -> object` ใน `tools/lib.mjs` (อ่านไฟล์ relative กับ `jjk-addon/`, ตัดคอมเมนต์ `//` ได้)

- [ ] **Step 1: เขียนเทสต์** `manifest.test.mjs`:
  - `bp/rp manifests parse` → `format_version === 2`, มี `header.uuid`, `min_engine_version` = `[1,21,0]`
  - `all uuids unique` → uuid ทั้งหมด (header+modules ทั้งสองแพ็ก) ไม่ซ้ำ
  - `bp depends on rp` → `bp.dependencies` มี `{uuid: rp.header.uuid}`
  - module type: BP `data`, RP `resources`
- [ ] **Step 2:** `node --test jjk-addon/tests/` → FAIL (ไม่มีไฟล์)
- [ ] **Step 3:** เขียน manifests (uuid ใหม่ด้วย `crypto.randomUUID()`), ชื่อ "JJK Addon BP"/"JJK Addon RP", version `[1,0,0]`; เขียน `lib.mjs`
- [ ] **Step 4:** `node --test jjk-addon/tests/` → PASS
- [ ] **Step 5:** commit `feat(jjk): pack scaffold and validator`

### Task 2: Behavior entity `jjk:gojo`

**Files:**
- Create: `jjk-addon/behavior_pack/entities/gojo.json`
- Test: `jjk-addon/tests/entity.test.mjs`

**Interfaces:**
- Produces: entity id `jjk:gojo` (ใช้ต่อใน Task 3, 4 และขั้นถัดไป)

- [ ] **Step 1: เทสต์:**
  - `description.identifier === "jjk:gojo"`, `is_spawnable === true`, `is_summonable === true`, `is_experimental === false`
  - `minecraft:health.value === 500` และ `.max === 500`
  - `minecraft:collision_box` = `{width: 0.6, height: 1.8}`
  - ไม่มีไดเรกทอรี `behavior_pack/spawn_rules/` ที่มีไฟล์ของ gojo
- [ ] **Step 2:** รันเทสต์ → FAIL
- [ ] **Step 3:** เขียน `gojo.json` (`format_version: "1.21.0"`) components: health 500, collision_box, physics, pushable, `movement` 0.3, `movement.basic`, `navigation.walk`, `jump.static`, `behavior.look_at_player`, `behavior.random_look_around`, `nameable`, `type_family: ["gojo","jjk","mob"]` — ยังไม่มีการโจมตี (ขั้น 3)
- [ ] **Step 4:** รันเทสต์ → PASS
- [ ] **Step 5:** commit `feat(jjk): gojo behavior entity`

### Task 3: โมเดล 2.5D + เท็กซ์เจอร์ + client entity

**Files:**
- Create: `jjk-addon/resource_pack/models/entity/gojo.geo.json`
- Create: `jjk-addon/tools/gen_gojo_texture.py` → output `jjk-addon/resource_pack/textures/entity/gojo.png`
- Create: `jjk-addon/resource_pack/entity/gojo.entity.json`, `jjk-addon/resource_pack/render_controllers/gojo.render_controllers.json`
- Test: `jjk-addon/tests/model.test.mjs`

**Interfaces:**
- Consumes: `jjk:gojo` (Task 2), `readJson` (Task 1)
- Produces: geometry `geometry.jjk.gojo`; texture 128×128; ชื่อ bone ที่ขั้นอนิเมชันใช้: `root, waist, body, head, hair, eyes, rightArm, leftArm, rightLeg, leftLeg, belt` (ห้ามเปลี่ยนชื่อในขั้นหลัง)

- [ ] **Step 1: เทสต์:**
  - geometry `format_version "1.12.0"`, identifier `geometry.jjk.gojo`, `texture_width/height === 128`
  - มีครบทุก bone ใน Interfaces; `hair` มี cube ≥ 6 ชิ้น (ปอยผมชี้), `belt` มี cube ≥ 2 (ตัวเข็มขัด + ปมผ้า)
  - ทุก cube: UV box (`uv:[u,v]`, size `[w,h,d]`) ครอบพื้นที่ `u..u+2(w+d)`, `v..v+(h+d)` อยู่ในขอบ 128
  - cube ใน bone `hair`, `belt` และชั้นเสื้อซ้อน มี `inflate > 0`
  - `gojo.png` ขนาด 128×128 (อ่าน header PNG); ทุกพิกเซลใน UV ของหน้าที่มองเห็นของ `body/head/arms/legs` มี alpha > 0
  - client entity: identifier `jjk:gojo`, geometry `default → geometry.jjk.gojo`, texture `default → textures/entity/gojo`, material `default → entity_alphatest`, render controller `controller.render.jjk.gojo`
- [ ] **Step 2:** รันเทสต์ → FAIL
- [ ] **Step 3:** เขียน geometry: ร่างกายตามสัดส่วนผู้เล่น (head 8³, body 8×12×4, arms 4×12×4 แบบไหล่กว้าง, legs 4×12×4) + ชั้นซ้อน (inflate 0.25–0.5): ผม 6–10 ปอยชี้ขึ้น/ข้าง, ปกเสื้อ, เข็มขัด + ปมผ้าห้อย, ปลายขากางเกงพอง, รองเท้า; `eyes` เป็นชิ้นบาง 2 ชิ้นหน้า head (inflate 0.01) เพื่อให้ขั้น 4 ทำเรืองแสงได้
- [ ] **Step 4:** เขียน `gen_gojo_texture.py`: วาดแต่ละหน้าตาม UV map จาก geometry (อ่าน geo.json เพื่อหาตำแหน่ง) ด้วยพาเลตที่กำหนด + เฉดเงา 2–3 ระดับต่อสี (ไม่ทาสีเรียบ) อิงสกินอ้างอิง; รัน `python3 jjk-addon/tools/gen_gojo_texture.py`
- [ ] **Step 5:** เขียน client entity (`format_version "1.10.0"`) + render controller (`format_version "1.8.0"`)
- [ ] **Step 6:** รันเทสต์ → PASS; render ภาพพรีวิวจาก texture (สคริปต์ Python flat-unwrap) ให้ผู้ใช้ดู
- [ ] **Step 7:** commit `feat(jjk): gojo 2.5D model and texture`

### Task 4: ไข่เสก + ชื่อ + pack icon

**Files:**
- Create: `jjk-addon/tools/gen_icons.py` → `resource_pack/textures/items/gojo_spawn_egg.png` (32×32), `pack_icon.png` ทั้งสองแพ็ก (256×256)
- Create: `jjk-addon/resource_pack/textures/item_texture.json`
- Create: `jjk-addon/resource_pack/texts/en_US.lang`, `th_TH.lang`, `languages.json`
- Modify: `jjk-addon/resource_pack/entity/gojo.entity.json` (เพิ่ม `spawn_egg`)
- Test: `jjk-addon/tests/egg.test.mjs`

- [ ] **Step 1: เทสต์:**
  - client entity `spawn_egg.texture === "jjk_gojo_spawn_egg"`
  - `item_texture.json.texture_data.jjk_gojo_spawn_egg.textures === "textures/items/gojo_spawn_egg"` และไฟล์ png มีขนาด 32×32
  - lang ทั้งสองไฟล์มี `entity.jjk:gojo.name=Satoru Gojo` และ `item.spawn_egg.entity.jjk:gojo.name=Satoru Gojo Spawn Egg` (th: `ไข่เสก Satoru Gojo`)
- [ ] **Step 2:** รันเทสต์ → FAIL
- [ ] **Step 3:** `gen_icons.py`: ไข่ทรงรีขอบดำ พื้นขาว ลายผมขาว-ฟ้า + แถบดำ (ผ้าปิดตา) + ประกายฟ้า, ไล่เฉด; pack icon = หน้าโกโจขยายจาก texture
- [ ] **Step 4:** เขียน item_texture/lang/แก้ client entity; รันเทสต์ → PASS
- [ ] **Step 5:** commit `feat(jjk): gojo spawn egg and names`

### Task 5: Build `.mcaddon` + เช็กลิสต์ทดสอบในเกม

**Files:**
- Create: `jjk-addon/tools/build.sh` → `jjk-addon/dist/JJK_Addon.mcaddon`
- Modify: `.gitignore` (เพิ่ม `jjk-addon/dist/`)
- Test: `jjk-addon/tests/build.test.mjs`

- [ ] **Step 1: เทสต์:** หลังรัน build, `unzip -l` ของ `.mcaddon` มี `JJK_BP/manifest.json` และ `JJK_RP/manifest.json`
- [ ] **Step 2:** รันเทสต์ → FAIL
- [ ] **Step 3:** `build.sh`: รัน generators → `node --test` → zip `behavior_pack` เป็น `JJK_BP/`, `resource_pack` เป็น `JJK_RP/`
- [ ] **Step 4:** รันเทสต์ทั้งหมด → PASS
- [ ] **Step 5:** commit `feat(jjk): mcaddon build`; ส่งไฟล์ `.mcaddon` ให้ผู้ใช้ (SendUserFile)
- [ ] **Step 6 (ผู้ใช้ทดสอบ):** ติดตั้ง → สร้างโลกเปิดทั้งสองแพ็ก → Creative หาไข่ "Satoru Gojo" → เสก → ตรวจ: ผมชี้ไม่กะพริบ, ไม่มีหน้าสีม่วง/ดำ, สีตรงสกินอ้างอิง, ไม่เกิดเองในโลก

---

## ขั้นถัดไป (แผนแยก เขียนหลังผู้ใช้ผ่านขั้น 1)
- **ขั้น 2 อนิเมชัน:** ~15 ท่า + animation controller (ใช้ชื่อ bone จาก Task 3)
- **ขั้น 3 AI + สกิล:** ตรวจเวอร์ชัน `@minecraft/server` สำหรับ v26.52 จากเอกสารทางการก่อน; ท่าทีเป็นกลาง, 13 สกิล, โมดูลกฎบล็อกธรรมชาติ
- **ขั้น 4 เอฟเฟกต์ + เสียง:** particles, ตาเรืองแสง, เสียงสังเคราะห์ + ช่องเปลี่ยนไฟล์
