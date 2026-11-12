// Satoru Gojo — 13 skills (spec: 2026-11-12-jjk-gojo-addon-design.md §4).
import { chooseGojo, COOLDOWN } from '../core/brain.js';
import { add, sub, scale, norm, dist, distToSegment } from '../core/vec.js';
import { PX, SFX, ANIM } from '../game/ids.js';
import { px, sfx, anim, line, shell, ring } from '../game/fx.js';
import { spawnTask } from '../game/tasks.js';
import {
  state, now, enemies, pickTarget, hurt, knock, face, breakSphere, breakAt, safeTeleport,
  chest, handPos, dirTo, hp, distTo,
} from '../game/combat.js';

const A = ANIM.gojo;
const BLACK_FLASH_CHANCE = 0.15;

/** Zero Cursed Energy: Six Eyes cannot sense Toji until he is within 6 blocks */
const hidden = (t, d) => t.typeId === 'jjk:toji' && d > 6;

/** @param {import('@minecraft/server').Entity} self */
export function gojoThink(self) {
  const s = state(self);
  if (s.busy) return;
  const target = pickTarget(self, hidden);
  if (!target) return;
  const skill = chooseGojo({
    dist: distTo(self, target), enemies: enemies(self, 10).length, hp: hp(self), now: now(), cd: s.cd,
    rand: Math.random(),
  });
  if (!skill) return;
  const run = SKILLS[skill];
  s.busy = true;
  s.cd[skill] = now() + COOLDOWN[skill];
  face(self, target.location);
  spawnTask(self, run(self, target), { maxTicks: 400, onEnd: () => { s.busy = false; } });
}

/** punch with a chance of Black Flash (×2.5) */
/** @param {import('@minecraft/server').Entity} self */
function* punch(self, target, dmg = 8, forceFlash = false) {
  if (!target.isValid || distTo(self, target) > 4.5) return;
  const flash = forceFlash || Math.random() < BLACK_FLASH_CHANCE;
  const at = chest(target);
  if (flash) {
    anim(self, A.blackFlash, 0.1);
    yield 3;
    hurt(self, target, dmg * 2.5);
    px(self.dimension, PX.blackFlash, at);
    sfx(self.dimension, SFX.blackFlash, at, 1.4);
    knock(target, dirTo(self.location, target.location), 1.4, 0.35);
  } else {
    hurt(self, target, dmg);
    px(self.dimension, PX.gojoHit, at);
    sfx(self.dimension, SFX.gojoPunch, at);
  }
}

const SKILLS = {
  /** @param {import('@minecraft/server').Entity} self */
  *combo(self, t) {
    anim(self, A.combo, 0.15);
    for (let i = 0; i < 3; i++) {
      yield 5;
      if (!t.isValid) return;
      face(self, t.location);
      yield* punch(self, t);
      if (i === 2) knock(t, dirTo(self.location, t.location), 1.6, 0.45);
    }
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *blue(self, t) { yield* blue(self, t, { r: 5, dmgPerSec: 4, ticks: 60, breaks: false }); },
  /** @param {import('@minecraft/server').Entity} self */
  *blueMax(self, t) { yield* blue(self, t, { r: 8, dmgPerSec: 6, ticks: 80, breaks: true }); },

  /** @param {import('@minecraft/server').Entity} self */
  *red(self, t) {
    anim(self, A.red, 0.2);
    sfx(self.dimension, SFX.redCharge, self.location);
    for (let i = 0; i < 8; i++) { px(self.dimension, PX.redOrb, handPos(self)); yield 1; }
    if (!t.isValid) return;
    let p = handPos(self);
    const dir = dirTo(p, chest(t));
    for (let step = 0; step < 24; step++) {
      p = add(p, scale(dir, 1.2));
      px(self.dimension, PX.redOrb, p);
      const hitEntity = enemies(self, 30).some((e) => dist(chest(e), p) < 1.6);
      let solid = false;
      try { const b = self.dimension.getBlock(p); solid = !!b && !b.isAir && !b.isLiquid; } catch { solid = true; }
      if (hitEntity || solid) break;
      yield 1;
    }
    px(self.dimension, PX.redBurst, p);
    sfx(self.dimension, SFX.redBoom, p, 2);
    for (const e of enemies(self, 40)) {
      if (dist(e.location, p) > 3.5) continue;
      hurt(self, e, 20);
      knock(e, sub(e.location, p), 2.8, 0.6);
    }
    breakSphere(self.dimension, p, 2, 30);
    yield 8;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *pullPunch(self, t) {
    anim(self, A.pull, 0.15);
    sfx(self.dimension, SFX.blue, t.location, 0.8, 1.4);
    const d = distTo(self, t);
    knock(t, dirTo(t.location, self.location), Math.min(3.2, d * 0.35), 0.25);
    for (let i = 0; i < 6; i++) { px(self.dimension, PX.blueSwirl, chest(t)); yield 1; }
    face(self, t.location);
    yield* punch(self, t);
    knock(t, dirTo(self.location, t.location), 1.2, 0.3);
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *blink(self, t) {
    const from = chest(self);
    anim(self, A.blink, 0.05);
    yield 3;
    // land just behind the target, else 6 blocks toward it
    const back = add(t.location, scale(dirTo(self.location, t.location), 2));
    const toward = add(self.location, scale(dirTo(self.location, t.location), 6));
    const ok = safeTeleport(self, back, t.location) || safeTeleport(self, toward, t.location);
    if (!ok) return;
    px(self.dimension, PX.blink, from);
    px(self.dimension, PX.blink, chest(self));
    sfx(self.dimension, SFX.blink, self.location);
    yield 4;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *purple(self, t) { yield* purple(self, t, { r: 1.6, dmg: 60, len: 40 }); },
  /** @param {import('@minecraft/server').Entity} self */
  *purple200(self, t) { yield* purple(self, t, { r: 3.2, dmg: 120, len: 50 }); },

  /** @param {import('@minecraft/server').Entity} self */
  *domain(self) {
    const s = state(self);
    const c = self.location, R = 12, dim = self.dimension;
    anim(self, A.domain, 0.3);
    sfx(dim, SFX.domain, c, 3);
    yield 10;
    s.domainUntil = now() + 100;
    let hitTimer = 0;
    while (now() < s.domainUntil) {
      if (!self.isValid) return;
      shell(dim, PX.domainShell, c, R, 140);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.9, y = (Math.random() - 0.3) * R * 0.8;
        px(dim, PX.domainStar, { x: c.x + Math.cos(a) * r, y: c.y + 1 + y, z: c.z + Math.sin(a) * r });
      }
      const inside = enemies(self, R);
      for (const e of inside) {
        try {
          e.addEffect('slowness', 30, { amplifier: 255, showParticles: false });
          e.addEffect('weakness', 30, { amplifier: 255, showParticles: false });
          e.addEffect('mining_fatigue', 30, { amplifier: 4, showParticles: false });
          if (e.typeId !== 'minecraft:player') e.clearVelocity();
        } catch { /* ignore */ }
      }
      // free hits on frozen enemies
      if (++hitTimer % 2 === 0 && inside.length) {
        const e = inside[Math.floor(Math.random() * inside.length)];
        if (safeTeleport(self, add(e.location, scale(dirTo(e.location, c), 1.4)), e.location)) yield* punch(self, e);
      }
      yield 10;
    }
    s.domainUntil = 0;
  },
};

/** Lapse: Blue — pulls everything into one point */
/** @param {import('@minecraft/server').Entity} self */
function* blue(self, t, o) {
  anim(self, A.blue, 0.2);
  const dim = self.dimension;
  const c = add(chest(t), { x: 0, y: 0.5, z: 0 });
  sfx(dim, SFX.blue, c, o.breaks ? 2 : 1.3, o.breaks ? 0.8 : 1);
  if (o.breaks) breakSphere(dim, c, 2.5, 25);
  for (let tick = 0; tick < o.ticks; tick += 4) {
    px(dim, PX.blueOrb, c);
    ring(dim, PX.blueSwirl, c, o.r * (1 - (tick % 20) / 20), 10);
    for (const e of enemies(self, 40)) {
      const d = dist(e.location, c);
      if (d > o.r) continue;
      knock(e, sub(c, e.location), Math.min(1.2, d * 0.3), 0.12);
      if (tick % 10 < 4) hurt(self, e, o.dmgPerSec / 2);
    }
    if (o.breaks && tick % 12 === 0) {
      for (let i = 0; i < 6; i++) {
        const q = add(c, { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 4, z: (Math.random() - 0.5) * 6 });
        if (breakAt(dim, q)) px(dim, PX.debris, q);
      }
    }
    yield 4;
  }
}

/** Hollow Purple — charge both hands, then a straight beam that erases what it touches */
/** @param {import('@minecraft/server').Entity} self */
function* purple(self, t, o) {
  const dim = self.dimension;
  anim(self, A.purpleCharge, 0.2);
  sfx(dim, SFX.purpleCharge, self.location, 2);
  for (let i = 0; i < 30; i++) {
    if (!self.isValid) return;
    const h = handPos(self), d = self.getViewDirection();
    const side = norm({ x: d.z, y: 0, z: -d.x });
    const k = 1 - i / 30;
    px(dim, PX.blueOrb, add(h, scale(side, -0.9 * k)));
    px(dim, PX.redOrb, add(h, scale(side, 0.9 * k)));
    if (i % 6 === 0 && t.isValid) face(self, t.location);
    yield 1;
  }
  anim(self, A.purpleFire, 0.2);
  const start = add(self.location, { x: 0, y: 1.4, z: 0 });
  const dir = t.isValid ? dirTo(start, chest(t)) : norm(self.getViewDirection());
  sfx(dim, SFX.purpleFire, start, 4);
  const hit = new Set();
  let broken = 0;
  for (let seg = 0; seg < o.len; seg += 8) {
    const a = add(start, scale(dir, seg)), b = add(start, scale(dir, Math.min(o.len, seg + 8)));
    line(dim, PX.purpleBeam, a, b, 0.6, 16);
    px(dim, PX.purpleCore, b);
    for (const e of enemies(self, o.len + 4)) {
      if (hit.has(e.id) || distToSegment(chest(e), a, b) > o.r + 0.6) continue;
      hit.add(e.id);
      hurt(self, e, o.dmg);
      knock(e, dir, 2.5, 0.5);
    }
    for (let s = 0; s <= 8 && broken < 260; s += Math.max(1, o.r)) broken += breakSphere(dim, add(a, scale(dir, s)), o.r, 12);
    yield 1;
  }
  yield 10;
}

/** passives run every think tick */
/** @param {import('@minecraft/server').Entity} self */
export function gojoPassives(self) {
  const s = state(self);
  // Reverse Cursed Technique
  if (hp(self) < 0.3 && !(s.cd.rct > now())) {
    s.cd.rct = now() + 1200;
    try { self.addEffect('regeneration', 120, { amplifier: 3, showParticles: false }); } catch { /* ignore */ }
    anim(self, A.rct, 0.3);
    sfx(self.dimension, SFX.rct, self.location, 1.5);
    spawnTask(self, (function* () {
      for (let i = 0; i < 30; i++) { px(self.dimension, PX.rct, chest(self)); yield 4; }
    })(), { maxTicks: 140 });
  }
}

export const infinityOn = (self) => now() >= state(self).infinityOffUntil;
