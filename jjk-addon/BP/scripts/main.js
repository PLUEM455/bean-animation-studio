import {
  world,
  system,
  GameMode,
  EntityDamageCause,
  EquipmentSlot,
  CommandPermissionLevel,
  CustomCommandStatus,
} from "@minecraft/server";
import { TUNING, armorTotal, chooseWeapon } from "./ai.js";

const TOJI = "jjk:toji";
const W = { none: 0, sword: 1, spear: 2, pistol: 3, yuun: 4, chain: 5 };
const states = new Map();

function warn(e) {
  console.warn(`[JJK] ${e}`);
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function dir2d(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}
function stateOf(t) {
  let s = states.get(t.id);
  if (!s) {
    s = { busyUntil: 0, blockUntil: 0, last: null, cd: {}, weapon: 0 };
    states.set(t.id, s);
  }
  return s;
}
function setWeapon(t, s, id) {
  s.weapon = id;
  try {
    t.setProperty("jjk:weapon", id);
  } catch (e) {
    warn(e);
  }
}
function act(t, v) {
  try {
    if (t.isValid) t.setProperty("jjk:action", v); // 0 ปกติ, 1 เตรียมท่า, 2 โจมตี (ใช้เล่นแอนิเมชันฝั่งไคลเอนต์)
  } catch (e) {
    warn(e);
  }
}
function fx(dim, loc, particle, sound) {
  try {
    if (particle) dim.spawnParticle(particle, loc);
  } catch (e) {
    /* ชื่อพาร์ติเคิลไม่ถูกต้องก็ข้าม */
  }
  try {
    if (sound) dim.playSound(sound, loc);
  } catch (e) {
    /* ชื่อเสียงไม่ถูกต้องก็ข้าม */
  }
}
function line(dim, a, b, particle) {
  const n = Math.max(2, Math.floor(dist(a, b) / 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    fx(dim, { x: a.x + (b.x - a.x) * k, y: a.y + 1.2 + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }, particle);
  }
}
function hit(t, target, amount, cause, knock) {
  try {
    target.applyDamage(amount, { cause, damagingEntity: t });
    if (knock) {
      const d = dir2d(t.location, target.location);
      target.applyKnockback({ x: d.x * knock, z: d.z * knock }, 0.4);
    }
  } catch (e) {
    warn(e);
  }
}
function armorOf(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    if (!eq) return 0;
    const ids = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].map(
      (slot) => eq.getEquipment(slot)?.typeId,
    );
    return armorTotal(ids.filter(Boolean));
  } catch (e) {
    return 0;
  }
}
function healthOf(p) {
  try {
    return p.getComponent("minecraft:health").currentValue;
  } catch (e) {
    return 20;
  }
}
function isOpen(t) {
  try {
    const d = t.dimension;
    const l = t.location;
    for (let i = 2; i <= 5; i++) {
      const b = d.getBlock({ x: l.x, y: l.y + i, z: l.z });
      if (!b || !b.isAir) return false;
    }
    let air = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dx, dz] of dirs) {
      const b = d.getBlock({ x: l.x + dx * 5, y: l.y + 1, z: l.z + dz * 5 });
      if (b && b.isAir) air++;
    }
    return air >= 7;
  } catch (e) {
    return false;
  }
}
function alive(...es) {
  return es.every((e) => e && e.isValid);
}

// ---- การโจมตี ----
function doSword(t, s, target, now) {
  const C = TUNING.sword;
  setWeapon(t, s, W.sword);
  s.busyUntil = now + C.busy;
  s.cd.sword = now + C.cooldown;
  s.last = "sword";
  act(t, 1);
  system.runTimeout(() => {
    act(t, 2);
    system.runTimeout(() => act(t, 0), 10);
    if (!alive(t, target) || dist(t.location, target.location) > C.reach) return;
    hit(t, target, C.damage, EntityDamageCause.magic, 0.8); // magic = ทะลุเกราะ
    fx(t.dimension, target.location, "minecraft:critical_hit_emitter", "item.trident.hit");
  }, C.windup);
}

function doSpear(t, s, target, now) {
  const C = TUNING.spear;
  setWeapon(t, s, W.spear);
  s.busyUntil = now + C.busy;
  s.cd.spear = now + C.cooldown;
  s.last = "spear";
  act(t, 1);
  system.runTimeout(() => {
    act(t, 2);
    system.runTimeout(() => act(t, 0), C.flight + 10);
    if (!alive(t, target)) return;
    const d = dir2d(t.location, target.location);
    try {
      t.applyImpulse({ x: d.x * 1.6, y: 0.3, z: d.z * 1.6 });
    } catch (e) {
      warn(e);
    }
    fx(t.dimension, t.location, "minecraft:critical_hit_emitter", "item.trident.throw");
    system.runTimeout(() => {
      if (!alive(t, target) || dist(t.location, target.location) > C.hitReach) return;
      hit(t, target, C.damage, EntityDamageCause.entityAttack, 1.4);
      fx(t.dimension, target.location, "minecraft:critical_hit_emitter", "item.trident.hit");
    }, C.flight);
  }, C.windup);
}

function doPistol(t, s, target, now) {
  const C = TUNING.pistol;
  setWeapon(t, s, W.pistol);
  s.busyUntil = now + C.busy;
  s.cd.pistol = now + C.cooldown;
  s.last = "pistol";
  act(t, 1);
  system.runTimeout(() => {
    act(t, 2);
    system.runTimeout(() => act(t, 0), 8);
    if (!alive(t, target) || dist(t.location, target.location) > C.maxDist + 0.5) return;
    hit(t, target, C.damage, EntityDamageCause.entityAttack, 0);
    try {
      target.addEffect("slowness", C.slowTicks, { amplifier: C.slowAmp, showParticles: true });
    } catch (e) {
      warn(e);
    }
    line(t.dimension, t.location, target.location, "minecraft:critical_hit_emitter");
    fx(t.dimension, t.location, null, "random.explode");
  }, C.windup);
}

function doYuun(t, s, target, now) {
  const C = TUNING.yuun;
  setWeapon(t, s, W.yuun);
  s.busyUntil = now + C.busy;
  s.blockUntil = now + C.duration;
  s.cd.yuun = now + C.cooldown;
  s.last = "yuun";
  act(t, 2);
  fx(t.dimension, t.location, null, "random.anvil_land");
}

function doChain(t, s, target, now) {
  const C = TUNING.chain;
  setWeapon(t, s, W.chain);
  s.busyUntil = now + C.busy;
  s.cd.chain = now + C.cooldown;
  s.last = "chain";
  act(t, 1);
  // ช่วงต่อหอกกับโซ่: โทจิขยับไม่ได้ เปิดโอกาสให้ผู้เล่นสวนกลับ
  try {
    t.addEffect("slowness", C.windup, { amplifier: 6, showParticles: false });
  } catch (e) {
    warn(e);
  }
  fx(t.dimension, t.location, null, "random.anvil_land");
  system.runTimeout(() => alive(t, target) && line(t.dimension, t.location, target.location, "minecraft:critical_hit_emitter"), Math.floor(C.windup / 2));
  system.runTimeout(() => {
    act(t, 2);
    system.runTimeout(() => act(t, 0), 10);
    if (!alive(t, target) || dist(t.location, target.location) > C.maxDist) return;
    hit(t, target, C.damage, EntityDamageCause.magic, 1.0);
    line(t.dimension, t.location, target.location, "minecraft:critical_hit_emitter");
    fx(t.dimension, target.location, "minecraft:critical_hit_emitter", "random.anvil_land");
  }, C.windup);
}

const ACTIONS = { sword: doSword, spear: doSpear, pistol: doPistol, yuun: doYuun, chain: doChain };

function think(t, now) {
  const s = stateOf(t);
  if (now < s.busyUntil) return;
  if (s.blockUntil && now >= s.blockUntil) {
    s.blockUntil = 0;
    if (s.weapon === W.yuun) setWeapon(t, s, W.none);
    act(t, 0);
  }
  const d = t.dimension;
  const targets = d.getPlayers({ location: t.location, maxDistance: 40, closest: 1, excludeGameModes: [GameMode.Spectator] });
  const target = targets[0];
  if (!target) {
    if (s.weapon !== W.none && !s.blockUntil) {
      setWeapon(t, s, W.none);
      act(t, 0);
    }
    return;
  }
  const near = d.getPlayers({ location: t.location, maxDistance: TUNING.yuun.nearRadius, excludeGameModes: [GameMode.Spectator] }).length;
  const choice = chooseWeapon({
    dist: dist(t.location, target.location),
    targetHealth: healthOf(target),
    targetArmor: armorOf(target),
    nearbyEnemies: near,
    openArea: isOpen(t),
    lastWeapon: s.last,
    rand: Math.random,
    cd: s.cd,
    now,
  });
  if (choice) ACTIONS[choice](t, s, target, now);
}

system.runInterval(() => {
  const now = system.currentTick;
  for (const dimId of ["overworld", "nether", "the_end"]) {
    let dim;
    try {
      dim = world.getDimension(dimId);
    } catch (e) {
      continue;
    }
    for (const t of dim.getEntities({ type: TOJI })) {
      try {
        think(t, now);
      } catch (e) {
        warn(e);
      }
    }
  }
  for (const id of states.keys()) {
    if (!world.getEntity(id)) states.delete(id);
  }
}, 5);

// ยูอุน: บล็อกดาเมจได้บางครั้ง (ไม่ใช่ตลอด) ทั้งใกล้และไกล
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (e.typeId !== TOJI) return;
  const s = states.get(e.id);
  if (s && s.blockUntil > system.currentTick && Math.random() < TUNING.yuun.blockChance) {
    ev.cancel = true;
  }
});

// คำสั่ง /jjk:hp -> เลือดเยอะ (+200 HP) และเติมเต็ม
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  customCommandRegistry.registerCommand(
    {
      name: "jjk:hp",
      description: "เพิ่มเลือดสูงสุด +200 และเติมเต็ม",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    },
    (origin) => {
      const p = origin.sourceEntity;
      if (!p || p.typeId !== "minecraft:player") {
        return { status: CustomCommandStatus.Failure, message: "ใช้ได้เฉพาะผู้เล่น" };
      }
      system.run(() => {
        p.addEffect("health_boost", 1000000, { amplifier: 49, showParticles: false });
        system.runTimeout(() => p.isValid && p.getComponent("minecraft:health").resetToMaxValue(), 5);
      });
      return { status: CustomCommandStatus.Success, message: "เลือดเพิ่มแล้ว (+200 HP)" };
    },
  );
});
