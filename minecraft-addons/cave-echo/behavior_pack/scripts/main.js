import { world, system } from "@minecraft/server";

// ---- ตั้งค่า ----
const SCAN_HEIGHT = 32; // สแกนขึ้นไปกี่บล็อก
const MIN_SOLID_ABOVE = 4; // ต้องมีบล็อกทึบเหนือหัวอย่างน้อยกี่บล็อกถึงนับว่า "ในถ้ำ"
// เสียงสะท้อน: [หน่วงกี่ tick, ความดัง, pitch]  (20 tick = 1 วินาที)
const ECHO_TAPS = [
  [4, 0.45, 0.95],
  [9, 0.25, 0.9],
  [15, 0.12, 0.85],
];

// ตรวจว่าตำแหน่งนี้อยู่ในถ้ำไหม (นับบล็อกทึบในแนวตั้งเหนือตำแหน่ง)
function isInCave(dimension, location) {
  const x = Math.floor(location.x);
  const z = Math.floor(location.z);
  const startY = Math.floor(location.y) + 2;
  let solid = 0;
  for (let y = startY; y < startY + SCAN_HEIGHT; y++) {
    let block;
    try {
      block = dimension.getBlock({ x, y, z });
    } catch {
      return false; // นอกขอบเขตโลก / chunk ไม่โหลด
    }
    if (!block) return false;
    if (!block.isAir && !block.isLiquid) {
      solid++;
      if (solid >= MIN_SOLID_ABOVE) return true;
    }
  }
  return false;
}

// เล่นเสียงซ้ำแบบหน่วงเวลาและเบาลงเรื่อย ๆ = เสียงก้อง
function playEcho(dimension, soundId, location) {
  const loc = { x: location.x, y: location.y, z: location.z };
  for (const [delay, volume, pitch] of ECHO_TAPS) {
    system.runTimeout(() => {
      try {
        dimension.playSound(soundId, loc, { volume, pitch });
      } catch {
        // dimension/sound ใช้ไม่ได้แล้ว ข้ามไป
      }
    }, delay);
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
  if (!isInCave(dimension, location)) return;
  playEcho(dimension, digSoundFor(ev.brokenBlockPermutation.type.id), location);
});

// 2) โดนตี (ผู้เล่นและ mob)
world.afterEvents.entityHurt.subscribe((ev) => {
  const entity = ev.hurtEntity;
  if (!entity.isValid) return;
  const { dimension, location } = entity;
  if (!isInCave(dimension, location)) return;
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
  if (!isInCave(dimension, location)) return;
  playEcho(dimension, "fire.ignite", location);
});
