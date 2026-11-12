import { world, system, EntityDamageCause } from "@minecraft/server";

const DEATH = "rw:death_wand";
const HEAL = "rw:heal_wand";
const FIGHT = "rw:fight_wand";
const WANDS = new Set([DEATH, HEAL, FIGHT]);

/** playerId -> entity ที่เลือกเป็นตัวแรกของคฑาสู้ */
const pendingFight = new Map();
/** คู่ที่กำลังสู้กัน */
let fights = [];
/** กันคลิกเดียวทำงานซ้ำ (hit + interact) */
const lastUse = new Map();

function heldWand(player) {
  const item = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand")
    ?? player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
  return item && WANDS.has(item.typeId) ? item.typeId : undefined;
}

/** สิ่งมีชีวิต (mob) เท่านั้น: มีเลือด และไม่ใช่ผู้เล่น */
function isMob(entity) {
  return entity?.isValid && entity.typeId !== "minecraft:player" && !!entity.getComponent("minecraft:health");
}

function mobName(entity) {
  if (entity.nameTag) return { text: entity.nameTag };
  const [ns, id] = entity.typeId.split(":");
  return { translate: ns === "minecraft" ? `entity.${id}.name` : `entity.${entity.typeId}.name` };
}

function killMob(entity) {
  entity.kill();
  // สำรอง: ถ้ายังไม่ตาย (เช่นมีโทเท็ม/อมตะ) ให้ลบออกจากโลก
  system.runTimeout(() => {
    if (entity.isValid && (entity.getComponent("minecraft:health")?.currentValue ?? 0) > 0) entity.remove();
  }, 2);
}

function healMob(entity) {
  const heal = () => entity.isValid && entity.getComponent("minecraft:health")?.resetToMaxValue();
  heal();
  system.run(heal); // หลังดาเมจจากการตีถูกคิดแล้ว
}

function fightSelect(player, entity) {
  const first = pendingFight.get(player.id);
  if (!first || !first.isValid || first.id === entity.id) {
    pendingFight.set(player.id, entity);
    player.sendMessage({ rawtext: [{ text: "§c" }, mobName(entity), { text: " §fต้องสู้กับ..." }] });
    return;
  }
  pendingFight.delete(player.id);
  fights = fights.filter((f) => ![f.a.id, f.b.id].some((id) => id === first.id || id === entity.id));
  fights.push({ a: first, b: entity });
  player.sendMessage({
    rawtext: [{ text: "§c" }, mobName(first), { text: " §fสู้กับ §c" }, mobName(entity), { text: "§f!" }],
  });
  provoke(first, entity);
  provoke(entity, first);
}

/**
 * ยั่วยุ: ทำให้ victim "รู้สึก" ว่าโดน attacker ตี เพื่อให้ AI ของมันหันไปล็อกเป้าและโจมตีเอง
 * เหมือนตอนผู้เล่นไปตีมัน แล้วคืนเลือดทันที (ดาเมจจริงมาจากการโจมตีของม็อบเท่านั้น)
 */
function provoke(attacker, victim) {
  const hp = victim.getComponent("minecraft:health");
  if (!hp || hp.currentValue <= 1) return;
  const before = hp.currentValue;
  try {
    victim.applyDamage(1, { cause: EntityDamageCause.entityAttack, damagingEntity: attacker });
  } catch {}
  if (victim.isValid) hp.setCurrentValue(before);
}

function useWand(player, wand, entity) {
  if (!isMob(entity)) return;
  const now = system.currentTick;
  if (now - (lastUse.get(player.id) ?? -10) < 4) return;
  lastUse.set(player.id, now);
  if (wand === DEATH) killMob(entity);
  else if (wand === HEAL) healMob(entity);
  else fightSelect(player, entity);
}

// คลิกซ้าย / แตะตี
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (damagingEntity.typeId !== "minecraft:player") return;
  const wand = heldWand(damagingEntity);
  if (wand) useWand(damagingEntity, wand, hitEntity);
});

// คลิกขวา / ปุ่ม interact (ยกเลิกการโต้ตอบปกติ เช่นเปิดหน้าเทรดชาวบ้าน)
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const wand = ev.itemStack && WANDS.has(ev.itemStack.typeId) ? ev.itemStack.typeId : undefined;
  if (!wand) return;
  ev.cancel = true;
  const { player, target } = ev;
  system.run(() => useWand(player, wand, target));
});

// ลูปการต่อสู้: ไม่บังคับเดิน/ไม่บังคับตี ให้ AI ของม็อบสู้เอง
// แค่ยั่วซ้ำทุก 3 วินาที กันไม่ให้มันเปลี่ยนเป้าไปหาผู้เล่นหรือตัวอื่น จนกว่าตัวใดตัวหนึ่งตาย
system.runInterval(() => {
  fights = fights.filter(({ a, b }) => {
    if (!a.isValid || !b.isValid || a.dimension.id !== b.dimension.id) return false;
    const { x, y, z } = a.location, l = b.location;
    if (Math.hypot(l.x - x, l.y - y, l.z - z) > 48) return false;
    provoke(b, a);
    provoke(a, b);
    return true;
  });
}, 60);

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  pendingFight.delete(playerId);
  lastUse.delete(playerId);
});

// ให้คฑาทั้ง 3 อันครั้งแรกที่ผู้เล่นเข้าโลก
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || player.hasTag("rw_given")) return;
  player.addTag("rw_given");
  for (const id of [DEATH, HEAL, FIGHT]) player.runCommand(`give @s ${id}`);
});
