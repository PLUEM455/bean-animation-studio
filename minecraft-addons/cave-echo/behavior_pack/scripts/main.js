import { world, system } from "@minecraft/server";

// ---- ตั้งค่า ----
const PROBE_INTERVAL = 10; // วัดพื้นที่รอบผู้เล่นทุกกี่ tick
const PROBE_RANGE = 48; // ระยะยิง ray สูงสุด (บล็อก)
const SMOOTHING = 0.35; // 0-1 ยิ่งน้อยยิ่งเปลี่ยนช้า/นิ่ง
const HEAR_RANGE = 32; // ผู้เล่นในระยะนี้จะได้ยินเสียงก้อง
const MIN_GAP_TICKS = 3; // กันเสียงก้องเดียวกันซ้อนถี่เกินไป
const MAX_CHAINS = 6; // จำนวนเสียงก้องที่เล่นพร้อมกันได้ต่อผู้เล่น

// 14 ทิศ: 6 แกน + 8 แนวทแยง
const DIRS = [];
for (const [x, y, z] of [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [-1, 1, 1], [-1, 1, -1],
  [1, -1, 1], [1, -1, -1], [-1, -1, 1], [-1, -1, -1],
]) {
  const l = Math.hypot(x, y, z);
  DIRS.push({ x: x / l, y: y / l, z: z / l });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ยิง ray รอบตัว แล้วคืน { enclosure: 0-1 (ปิดล้อมแค่ไหน), size: ระยะเฉลี่ยถึงผนัง }
function probeSpace(dimension, origin) {
  let hits = 0;
  let total = 0;
  for (const dir of DIRS) {
    let dist = PROBE_RANGE;
    try {
      const hit = dimension.getBlockFromRay(origin, dir, {
        maxDistance: PROBE_RANGE,
        includeLiquidBlocks: false,
        includePassableBlocks: false,
      });
      if (hit) {
        const b = hit.block.location;
        dist = Math.hypot(b.x + 0.5 - origin.x, b.y + 0.5 - origin.y, b.z + 0.5 - origin.z);
        hits++;
      }
    } catch {
      // นอกขอบเขตโลก นับเป็นที่โล่ง
    }
    total += dist;
  }
  return { enclosure: hits / DIRS.length, size: total / DIRS.length };
}

// เก็บค่าพื้นที่ของผู้เล่นแต่ละคนแบบค่อย ๆ เปลี่ยน (ไม่กระโดด) = เสียงนิ่ง
const profiles = new Map(); // player.id -> { enclosure, size, active, lastPlay: Map }

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (!player.isValid) continue;
    const m = probeSpace(player.dimension, player.getHeadLocation());
    const p = profiles.get(player.id);
    if (!p) {
      profiles.set(player.id, { ...m, active: 0, lastPlay: new Map() });
    } else {
      p.enclosure += (m.enclosure - p.enclosure) * SMOOTHING;
      p.size += (m.size - p.size) * SMOOTHING;
    }
  }
}, PROBE_INTERVAL);

world.afterEvents.playerLeave.subscribe((ev) => profiles.delete(ev.playerId));

// แปลงค่าพื้นที่เป็นเสียงก้อง
// ห้องเล็ก: ก้องสั้น เบา แหลม / ถ้ำใหญ่: ก้องยาว ดัง ทุ้ม / ที่โล่ง: แทบไม่ก้อง
function echoTaps(p) {
  const sizeF = clamp((p.size - 2) / 22, 0, 1); // 0 = แคบ, 1 = กว้างมาก
  const wet = Math.pow(p.enclosure, 1.5) * (0.25 + 0.75 * sizeF);
  if (wet < 0.05) return [];
  const count = 1 + Math.round(4 * p.enclosure * sizeF); // 1-5 ครั้ง
  const gap = Math.round(1 + 7 * sizeF); // 1-8 tick ระหว่างแต่ละครั้ง
  const decay = 0.45 + 0.35 * sizeF;
  const pitch = 1.1 - 0.3 * sizeF;
  const taps = [];
  let vol = 0.6 * wet;
  for (let i = 0; i < count; i++) {
    taps.push({ delay: gap * (i + 1), volume: vol, pitch: clamp(pitch - 0.02 * i, 0.5, 1.5) });
    vol *= decay;
  }
  return taps;
}

// เล่นเสียงก้องให้ผู้เล่นแต่ละคนตามพื้นที่ที่คนนั้นยืนอยู่
function playEcho(dimension, soundId, location) {
  const loc = { x: location.x, y: location.y, z: location.z };
  const now = system.currentTick;
  for (const player of dimension.getPlayers({ location: loc, maxDistance: HEAR_RANGE })) {
    const p = profiles.get(player.id);
    if (!p || p.active >= MAX_CHAINS) continue;
    if (now - (p.lastPlay.get(soundId) ?? -99) < MIN_GAP_TICKS) continue;
    const taps = echoTaps(p);
    if (taps.length === 0) continue;
    p.lastPlay.set(soundId, now);
    p.active++;
    taps.forEach((t, i) => {
      system.runTimeout(() => {
        try {
          if (player.isValid) player.playSound(soundId, { location: loc, volume: t.volume, pitch: t.pitch });
        } catch {
          // ผู้เล่นออก/เปลี่ยนมิติ
        }
        if (i === taps.length - 1) p.active--;
      }, t.delay);
    });
  }
}

function digSoundFor(typeId) {
  const id = typeId.replace("minecraft:", "");
  if (/(log|wood|planks|bamboo)/.test(id)) return "dig.wood";
  if (/(stem|hyphae)/.test(id)) return "dig.stem";
  if (id.includes("deepslate")) return "dig.deepslate";
  if (/(dirt|gravel|clay|farmland|mud)/.test(id)) return "dig.gravel";
  if (/(grass|leaves|moss)/.test(id)) return "dig.grass";
  if (id.includes("sand")) return "dig.sand";
  if (id.includes("netherrack")) return "dig.netherrack";
  return "dig.stone";
}

// ชื่อ mob ที่ ID เสียงไม่ตรงกับ typeId
const MOB_SOUND_ALIAS = {
  polar_bear: "polarbear",
  snow_golem: "snowgolem",
  wandering_trader: "wanderingtrader",
  evocation_illager: "evocation_illager",
};
const MOB_HURT_SOUNDS = new Set(
  ("allay armadillo axolotl bat bee bogged breeze camel chicken copper_golem cow dolphin drowned " +
    "evocation_illager fox frog glow_squid goat happy_ghast hoglin husk llama panda parrot phantom " +
    "piglin piglin_brute pillager polarbear rabbit ravager royal_cat shulker skeleton slime sniffer " +
    "snowgolem squid stray strider tadpole turtle vex vindicator wanderingtrader warden witch wither " +
    "wolf zoglin zombie zombie_villager").split(" ")
);

function hurtSoundFor(entity) {
  if (entity.typeId === "minecraft:player") return "game.player.hurt";
  let name = entity.typeId.replace("minecraft:", "");
  name = MOB_SOUND_ALIAS[name] ?? name;
  return MOB_HURT_SOUNDS.has(name) ? `mob.${name}.hurt` : undefined;
}

// 1) ขุดหิน / ตัดไม้ / ทุบบล็อก
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const { dimension, location } = ev.block;
  playEcho(dimension, digSoundFor(ev.brokenBlockPermutation.type.id), location);
});

// 2) โดนตี (ผู้เล่นและ mob)
world.afterEvents.entityHurt.subscribe((ev) => {
  const entity = ev.hurtEntity;
  if (!entity.isValid) return;
  const { dimension, location } = entity;
  playEcho(dimension, "game.player.attack.strong", location);
  const hurt = hurtSoundFor(entity);
  if (hurt) playEcho(dimension, hurt, location);
});

// 3) จุดไฟ (ไฟแช็ก / ลูกไฟ)
world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  if (!ev.isFirstEvent || !ev.itemStack) return;
  const item = ev.itemStack.typeId;
  if (item !== "minecraft:flint_and_steel" && item !== "minecraft:fire_charge") return;
  const { dimension, location } = ev.block;
  playEcho(dimension, "fire.ignite", location);
});
