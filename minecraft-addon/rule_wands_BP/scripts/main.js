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
  fights.push({ a: first, b: entity, tick: 0 });
  player.sendMessage({
    rawtext: [{ text: "§c" }, mobName(first), { text: " §fสู้กับ §c" }, mobName(entity), { text: "§f!" }],
  });
  provoke(first, entity);
  provoke(entity, first);
}

/** ตีเบาๆ ในนามอีกฝ่าย ให้ม็อบที่มี AI โจมตีหันไปเล็งศัตรูเอง */
function provoke(attacker, victim, damage = 1) {
  try {
    victim.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: attacker });
  } catch {}
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

// ลูปการต่อสู้: ดึงเข้าหากันและตีกันจนกว่าตัวใดตัวหนึ่งตาย
system.runInterval(() => {
  fights = fights.filter((f) => {
    const { a, b } = f;
    if (!a.isValid || !b.isValid || a.dimension.id !== b.dimension.id) return false;
    const dx = b.location.x - a.location.x, dy = b.location.y - a.location.y, dz = b.location.z - a.location.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 48) return false;
    f.tick++;
    if (dist > 2.2) {
      const k = Math.min(0.35, dist * 0.05) / (Math.hypot(dx, dz) || 1);
      try { a.applyImpulse({ x: dx * k, y: 0, z: dz * k }); } catch {}
      try { b.applyImpulse({ x: -dx * k, y: 0, z: -dz * k }); } catch {}
    } else if (f.tick % 4 === 0) {
      // ทุก ~1 วินาที (interval 5 tick x 4)
      provoke(a, b, 3);
      if (b.isValid) provoke(b, a, 3);
    }
    return true;
  });
}, 5);

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
