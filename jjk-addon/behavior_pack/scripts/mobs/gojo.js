// Satoru Gojo — 13 skills (spec: 2026-11-12-jjk-gojo-addon-design.md §4).
import { chooseGojo, COOLDOWN, GLOBAL_GAP } from '../core/brain.js';
import { add, sub, scale, norm, dist, distToSegment } from '../core/vec.js';
import { PX, SFX, ANIM } from '../game/ids.js';
import { px, sfx, anim, line, shell, ring, impact, bolts, shake } from '../game/fx.js';
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
  const skill = chooseGojo({ now: now(), cd: s.cd, rand: Math.random(), gcdUntil: s.gcdUntil });
  if (!skill) return;
  const run = SKILLS[skill];
  s.busy = true;
  s.cd[skill] = now() + COOLDOWN[skill];
  face(self, target.location);
  spawnTask(self, run(self, target), {
    maxTicks: 400, onEnd: () => { s.busy = false; s.gcdUntil = now() + GLOBAL_GAP; },
  });
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
    blackFlashFx(self.dimension, at);
    sfx(self.dimension, SFX.blackFlash, at, 1.4);
    knock(target, dirTo(self.location, target.location), 1.4, 0.35);
  } else {
    hurt(self, target, dmg);
    impact(self.dimension, at, { flash: PX.flash, sparks: PX.gojoHit, extra: [PX.infinity], shake: 0.25, radius: 10 });
    sfx(self.dimension, SFX.gojoPunch, at);
  }
}

const SKILLS = {
  /** @param {import('@minecraft/server').Entity} self */
  *combo(self, t) {
    yield* closeIn(self, t, 4);
    anim(self, A.combo, 0.15);
    for (let i = 0; i < 3; i++) {
      yield 5;
      if (!t.isValid) return;
      face(self, t.location);
      yield* punch(self, t);
      if (i === 2) {
        knock(t, dirTo(self.location, t.location), 1.6, 0.45);
        impact(self.dimension, chest(t), { ring: PX.shockBlue, sparks: PX.sparks, shake: 0.6 });
      }
    }
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *blue(self, t) { yield* blue(self, t, { r: 5, dmgPerSec: 4, ticks: 60, breaks: false }); },
  /** @param {import('@minecraft/server').Entity} self */
  *blueMax(self, t) { yield* blue(self, t, { r: 8, dmgPerSec: 6, ticks: 80, breaks: true }); },

  /** @param {import('@minecraft/server').Entity} self */
  *red(self, t) {
    const dim = self.dimension;
    anim(self, A.red, 0.2);
    sfx(dim, SFX.redCharge, self.location);
    for (let i = 0; i < 10; i++) { // charge: the orb swells at the fingertip
      const h = handPos(self);
      px(dim, PX.redOrb, h);
      if (i % 3 === 0) px(dim, PX.sparks, h);
      if (i === 9) px(dim, PX.flash, h);
      yield 1;
    }
    if (!t.isValid) return;
    let p = handPos(self);
    const dir = dirTo(p, chest(t));
    shake(dim, p, 12, 0.5, 0.3);
    const steps = Math.min(48, Math.ceil((dist(p, chest(t)) + 6) / 1.2));
    for (let step = 0; step < steps; step++) {
      const prev = p;
      p = add(p, scale(dir, 1.2));
      line(dim, PX.redOrb, prev, p, 0.4, 4); // continuous comet trail
      px(dim, PX.fireball, p);
      const hitEntity = enemies(self, 50).some((e) => dist(chest(e), p) < 1.8);
      let solid = false;
      try { const b = dim.getBlock(p); solid = !!b && !b.isAir && !b.isLiquid; } catch { solid = true; }
      if (hitEntity || solid) break;
      yield 1;
    }
    // detonation
    impact(dim, p, { flash: PX.flashBig, ring: PX.shockRed, sparks: PX.sparks, smoke: PX.smokeBig,
      extra: [PX.redBurst, PX.fireball, PX.fireball], shake: 2.2, radius: 28 });
    px(dim, PX.shockwave, add(p, { x: 0, y: -1, z: 0 }));
    sfx(dim, SFX.redBoom, p, 2.5);
    for (const e of enemies(self, 60)) {
      if (dist(e.location, p) > 4) continue;
      hurt(self, e, 20);
      knock(e, sub(e.location, p), 3.2, 0.7);
    }
    const n = breakSphere(dim, p, 2.2, 36);
    if (n) px(dim, PX.debris, p);
    yield 4;
    px(dim, PX.smokeBig, p);
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *pullPunch(self, t) {
    yield* closeIn(self, t, 9);
    const dim = self.dimension;
    anim(self, A.pull, 0.15);
    sfx(dim, SFX.blue, t.location, 0.9, 1.4);
    px(dim, PX.blueCore, chest(t));
    const d = distTo(self, t);
    knock(t, dirTo(t.location, self.location), Math.min(3.2, d * 0.35), 0.25);
    for (let i = 0; i < 6; i++) {
      if (!t.isValid) return;
      px(dim, PX.blueOrb, chest(t));
      line(dim, PX.blueSwirl, chest(t), handPos(self), 0.6, 12); // visible pull line
      yield 1;
    }
    face(self, t.location);
    yield* punch(self, t);
    knock(t, dirTo(self.location, t.location), 1.2, 0.3);
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *blink(self, t) {
    const dim = self.dimension;
    const from = chest(self);
    anim(self, A.blink, 0.05);
    yield 3;
    // land just behind the target, else 6 blocks toward it
    const back = add(t.location, scale(dirTo(self.location, t.location), 2));
    const toward = add(self.location, scale(dirTo(self.location, t.location), 6));
    const ok = safeTeleport(self, back, t.location) || safeTeleport(self, toward, t.location);
    if (!ok) return;
    const to = chest(self);
    impact(dim, from, { flash: PX.flash, extra: [PX.blink, PX.infinity] });
    impact(dim, to, { flash: PX.flash, extra: [PX.blink] });
    line(dim, PX.speedLine, from, to, 0.5, 30);
    sfx(dim, SFX.blink, self.location);
    yield 4;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *purple(self, t) { yield* purple(self, t, { r: 1.8, dmg: 60, len: 40, power: 1 }); },
  /** @param {import('@minecraft/server').Entity} self */
  *purple200(self, t) { yield* purple(self, t, { r: 3.6, dmg: 120, len: 50, power: 2 }); },

  /** @param {import('@minecraft/server').Entity} self */
  *domain(self) {
    const s = state(self);
    const c = self.location, R = 12, dim = self.dimension;
    anim(self, A.domain, 0.3);
    sfx(dim, SFX.domain, c, 3);
    yield 10;
    // expansion: the void blooms out of Gojo
    impact(dim, add(c, { x: 0, y: 1, z: 0 }), { flash: PX.flashBig, ring: PX.shockBlue, shake: 2.5, radius: 30 });
    px(dim, PX.shockPurple, c);
    for (let r = 2; r <= R; r += 2) { shell(dim, PX.domainShell, add(c, { x: 0, y: 1, z: 0 }), r, Math.round(r * 14)); yield 1; }
    s.domainUntil = now() + 100;
    let hitTimer = 0;
    while (now() < s.domainUntil) {
      if (!self.isValid) return;
      const mid = add(c, { x: 0, y: 1, z: 0 });
      shell(dim, PX.domainShell, mid, R, 240);
      const rnd = () => {
        const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.9, y = (Math.random() - 0.3) * R * 0.8;
        return { x: c.x + Math.cos(a) * r, y: c.y + 1 + y, z: c.z + Math.sin(a) * r };
      };
      for (let i = 0; i < 45; i++) px(dim, PX.domainStar, rnd());
      for (let i = 0; i < 14; i++) px(dim, PX.voidFog, rnd());
      for (let i = 0; i < 4; i++) line(dim, PX.speedLine, rnd(), rnd(), 0.6, 16); // infinite information streams
      const inside = enemies(self, R);
      for (const e of inside) {
        try {
          e.addEffect('slowness', 30, { amplifier: 255, showParticles: false });
          e.addEffect('weakness', 30, { amplifier: 255, showParticles: false });
          e.addEffect('mining_fatigue', 30, { amplifier: 4, showParticles: false });
          if (e.typeId === 'minecraft:player') e.addEffect('darkness', 40, { amplifier: 0, showParticles: false });
          else e.clearVelocity();
        } catch { /* ignore */ }
        px(dim, PX.domainStar, chest(e));
      }
      // free hits on frozen enemies
      if (++hitTimer % 2 === 0 && inside.length) {
        const e = inside[Math.floor(Math.random() * inside.length)];
        const from = chest(self);
        if (safeTeleport(self, add(e.location, scale(dirTo(e.location, c), 1.4)), e.location)) {
          line(dim, PX.speedLine, from, chest(self), 0.5, 20);
          yield* punch(self, e);
        }
      }
      yield 10;
    }
    // collapse
    impact(dim, add(c, { x: 0, y: 1, z: 0 }), { flash: PX.flash, ring: PX.shockPurple, shake: 0.8, radius: 20 });
    s.domainUntil = 0;
  },
};

/** Black Flash: black-red lightning tearing out of the impact point */
function blackFlashFx(dim, at) {
  impact(dim, at, { flash: PX.flashBig, ring: PX.shockRed, sparks: PX.sparks, extra: [PX.blackFlash], shake: 1.4 });
  bolts(dim, [PX.boltBlack, PX.boltRed, PX.boltBlack], at, 8, 3.5);
}

/** Blink in when a close-range skill was rolled from far away */
function* closeIn(self, t, reach) {
  if (!t.isValid || distTo(self, t) <= reach) return;
  yield* SKILLS.blink(self, t);
  if (t.isValid) face(self, t.location);
}

/** Lapse: Blue — pulls everything into one point */
/** @param {import('@minecraft/server').Entity} self */
function* blue(self, t, o) {
  anim(self, A.blue, 0.2);
  const dim = self.dimension;
  const c = add(chest(t), { x: 0, y: 0.5, z: 0 });
  sfx(dim, SFX.blue, c, o.breaks ? 2 : 1.3, o.breaks ? 0.8 : 1);
  impact(dim, c, { flash: PX.flash, ring: PX.shockBlue, shake: o.breaks ? 1.2 : 0.6, radius: 20 });
  if (o.breaks) breakSphere(dim, c, 2.5, 25);
  for (let tick = 0; tick < o.ticks; tick += 2) {
    const pulse = 1 + 0.25 * Math.sin(tick * 0.6);
    px(dim, PX.blueCore, c);
    if (tick % 4 === 0) px(dim, PX.blueOrb, c);
    // three tilted accretion rings spiralling inward
    for (let k = 0; k < 3; k++) {
      const rr = o.r * pulse * (1 - ((tick + k * 7) % 20) / 20);
      const spin = tick * 0.35 + k * 2.1, n = 14;
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        px(dim, PX.blueSwirl, { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * (k - 1) * 0.45, z: c.z + Math.sin(a) * rr });
      }
    }
    if (tick % 4 === 0) {
      for (const e of enemies(self, 60)) {
        const d = dist(e.location, c);
        if (d > o.r) continue;
        knock(e, sub(c, e.location), Math.min(1.4, d * 0.32), 0.14);
        line(dim, PX.blueSwirl, chest(e), c, 0.5, 10);
        if (tick % 10 < 4) hurt(self, e, o.dmgPerSec / 2);
      }
    }
    if (o.breaks && tick % 12 === 0) {
      for (let i = 0; i < 8; i++) {
        const q = add(c, { x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 5, z: (Math.random() - 0.5) * 7 });
        if (breakAt(dim, q)) { px(dim, PX.debris, q); line(dim, PX.debris, q, c, 1.2, 5); }
      }
    }
    yield 2;
  }
  // collapse into a point
  impact(dim, c, { flash: PX.flash, ring: PX.shockBlue, extra: [PX.blueOrb, PX.blink], shake: 0.8 });
}

/** Hollow Purple — two orbs merge into imaginary mass, then a beam erases its path */
/** @param {import('@minecraft/server').Entity} self */
function* purple(self, t, o) {
  const dim = self.dimension;
  anim(self, A.purpleCharge, 0.2);
  sfx(dim, SFX.purpleCharge, self.location, 2);
  for (let i = 0; i < 30; i++) {
    if (!self.isValid) return;
    const h = handPos(self), d = self.getViewDirection();
    const side = norm({ x: d.z, y: 0, z: -d.x });
    const k = 1 - i / 30, orbit = i * 0.5;
    const blueP = add(h, add(scale(side, -1.1 * k), { x: 0, y: Math.sin(orbit) * 0.4 * k, z: 0 }));
    const redP = add(h, add(scale(side, 1.1 * k), { x: 0, y: -Math.sin(orbit) * 0.4 * k, z: 0 }));
    px(dim, PX.blueOrb, blueP);
    px(dim, PX.redOrb, redP);
    if (i % 2 === 0) { px(dim, PX.blueCore, blueP); px(dim, PX.fireball, redP); }
    if (i > 15 && i % 3 === 0) bolts(dim, [PX.boltPurple], h, 2, 1.6 + i / 15);
    if (i % 5 === 0) shake(dim, h, 18, 0.2 + (i / 30) * o.power, 0.3);
    if (i % 6 === 0 && t.isValid) face(self, t.location);
    yield 1;
  }
  anim(self, A.purpleFire, 0.2);
  const start = add(self.location, { x: 0, y: 1.4, z: 0 });
  const dir = t.isValid ? dirTo(start, chest(t)) : norm(self.getViewDirection());
  const reach = Math.max(o.len, t.isValid ? dist(start, chest(t)) + 8 : 0);
  sfx(dim, SFX.purpleFire, start, 4);
  impact(dim, start, { flash: PX.flashBig, ring: PX.shockPurple, extra: [PX.purpleCore], shake: 1.8 * o.power, radius: 40 });
  // ring basis around the beam axis
  const u = norm(Math.abs(dir.y) < 0.9 ? { x: dir.z, y: 0, z: -dir.x } : { x: 1, y: 0, z: 0 });
  const w = { x: dir.y * u.z - dir.z * u.y, y: dir.z * u.x - dir.x * u.z, z: dir.x * u.y - dir.y * u.x };
  const hit = new Set();
  let broken = 0;
  const drawBeam = (a, b, haloCount) => {
    line(dim, PX.beamCore, a, b, 0.9 / o.power, 20);
    line(dim, PX.purpleBeam, a, b, 0.7, 16);
    for (let s = 0; s <= 8; s += 2) {
      const ctr = add(a, scale(dir, s));
      for (let i = 0; i < haloCount; i++) {
        const ang = (i / haloCount) * Math.PI * 2 + s;
        px(dim, PX.purpleBeam, add(ctr, add(scale(u, Math.cos(ang) * o.r), scale(w, Math.sin(ang) * o.r))));
      }
    }
  };
  for (let seg = 0; seg < reach; seg += 8) {
    const a = add(start, scale(dir, seg)), b = add(start, scale(dir, Math.min(reach, seg + 8)));
    drawBeam(a, b, 6 * o.power);
    px(dim, PX.purpleCore, b);
    for (const e of enemies(self, reach + 4)) {
      if (hit.has(e.id) || distToSegment(chest(e), a, b) > o.r + 0.6) continue;
      hit.add(e.id);
      hurt(self, e, o.dmg);
      knock(e, dir, 2.5, 0.5);
      impact(dim, chest(e), { flash: PX.flash, sparks: PX.sparks });
    }
    for (let s = 0; s <= 8 && broken < 260; s += Math.max(1, o.r)) {
      const n = breakSphere(dim, add(a, scale(dir, s)), o.r, 12);
      if (n) px(dim, PX.debris, add(a, scale(dir, s)));
      broken += n;
    }
    yield 1;
  }
  const end = add(start, scale(dir, reach));
  impact(dim, end, { flash: PX.flashBig, ring: PX.shockPurple, smoke: PX.smokeBig, extra: [PX.purpleCore], shake: 1.2 * o.power, radius: 30 });
  // afterglow: the erased corridor lingers
  for (let k = 0; k < 3; k++) {
    yield 4;
    line(dim, PX.purpleBeam, start, end, 2.2, 30);
  }
  yield 6;
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
      px(self.dimension, PX.flash, chest(self));
      for (let i = 0; i < 30; i++) { px(self.dimension, PX.rct, chest(self)); if (i % 5 === 0) px(self.dimension, PX.infinity, chest(self)); yield 4; }
    })(), { maxTicks: 140 });
  }
}

export const infinityOn = (self) => now() >= state(self).infinityOffUntil;
