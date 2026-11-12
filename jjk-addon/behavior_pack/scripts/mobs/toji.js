// Toji Fushiguro — 13 skills (spec: 2026-11-12-jjk-toji-mob-design.md §3-5).
import { chooseToji, COOLDOWN, GLOBAL_GAP } from '../core/brain.js';
import { createRope, stepRope, launchVelocity, driveTip } from '../core/rope.js';
import { add, sub, scale, norm, dist, dot, len, perpY, distToSegment } from '../core/vec.js';
import { PX, SFX, ANIM, WEAPON } from '../game/ids.js';
import { px, sfx, anim, line, ring } from '../game/fx.js';
import { spawnTask } from '../game/tasks.js';
import {
  state, now, enemies, pickTarget, hurt, knock, face, breakSphere, safeTeleport,
  chest, handPos, dirTo, hp, distTo,
} from '../game/combat.js';

const A = ANIM.toji;
const MAX_CHAIN = 20;

/** @param {import('@minecraft/server').Entity} self */
export function tojiThink(self) {
  const s = state(self);
  if (s.busy) return;
  const t = pickTarget(self);
  if (!t) return;
  const skill = chooseToji({ now: now(), cd: s.cd, rand: Math.random(), gcdUntil: s.gcdUntil, skm: s.skm });
  if (!skill) return;
  s.busy = true;
  s.cd[skill] = now() + Math.round(COOLDOWN[skill] * (s.skm ? 0.7 : 1));
  face(self, t.location);
  spawnTask(self, SKILLS[skill](self, t), {
    maxTicks: 400,
    onEnd: () => {
      s.busy = false;
      s.gcdUntil = now() + GLOBAL_GAP;
      if (self.isValid && Number(self.getProperty('jjk:chain_len') ?? 0) > 0) endChain(self); // aborted mid-throw
    },
  });
}

const weaponOf = (self) => Number(self.getProperty('jjk:weapon') ?? WEAPON.katana);
const setWeapon = (self, w) => { try { self.setProperty('jjk:weapon', w); } catch { /* ignore */ } };

/** Inventory Curse: the worm spits out the next weapon */
/** @param {import('@minecraft/server').Entity} self */
function* equip(self, w) {
  if (weaponOf(self) === w) return;
  anim(self, A.inventory, 0.1);
  sfx(self.dimension, SFX.inventory, self.location);
  const shoulder = add(self.location, { x: 0, y: 1.5, z: 0 });
  for (let i = 0; i < 3; i++) { px(self.dimension, PX.wormSpit, shoulder); yield 2; }
  setWeapon(self, w);
}

const SKILLS = {
  /** @param {import('@minecraft/server').Entity} self */
  *katana(self, t) {
    yield* closeIn(self, t, 4);
    yield* equip(self, WEAPON.katana);
    anim(self, A.katana, 0.1);
    sfx(self.dimension, SFX.katana, self.location);
    yield 5;
    if (t.isValid && distTo(self, t) <= 4.5) {
      hurt(self, t, 14, 'pierce'); // Split Soul: ignores armour
      px(self.dimension, PX.slash, chest(t));
    }
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *cloud(self, t) {
    yield* closeIn(self, t, 4);
    yield* equip(self, WEAPON.cloud);
    anim(self, A.cloud, 0.1);
    for (const at of [5, 7]) {
      yield at;
      if (!t.isValid) return;
      face(self, t.location);
      sfx(self.dimension, SFX.cloud, self.location);
      px(self.dimension, PX.cloudTrail, handPos(self));
      if (distTo(self, t) <= 4.5) {
        hurt(self, t, 12);
        px(self.dimension, PX.slamDust, chest(t));
        knock(t, dirTo(self.location, t.location), 1.8, 0.35);
      }
    }
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *slam(self, t) {
    yield* closeIn(self, t, 4);
    yield* equip(self, WEAPON.cloud);
    anim(self, A.slam, 0.1);
    yield 10;
    const f = self.getViewDirection();
    const c = add(self.location, scale(norm({ x: f.x, y: 0, z: f.z }), 2));
    sfx(self.dimension, SFX.slam, c, 2);
    ring(self.dimension, PX.slamDust, add(c, { x: 0, y: 0.2, z: 0 }), 1.5, 10);
    ring(self.dimension, PX.slamDust, add(c, { x: 0, y: 0.2, z: 0 }), 3, 16);
    for (const e of enemies(self, 8)) {
      if (dist(e.location, c) > 3.5) continue;
      hurt(self, e, 12);
      knock(e, sub(e.location, c), 1.2, 0.7);
    }
    breakSphere(self.dimension, add(c, { x: 0, y: -0.5, z: 0 }), 2, 20);
    yield 8;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *fists(self, t) {
    yield* closeIn(self, t, 3.5);
    yield* equip(self, WEAPON.none);
    anim(self, A.fists, 0.1);
    for (let i = 0; i < 3; i++) {
      yield 5;
      if (!t.isValid || distTo(self, t) > 4) return;
      hurt(self, t, 9);
      sfx(self.dimension, SFX.fist, chest(t));
      if (i === 2) knock(t, dirTo(self.location, t.location), 1.5, 0.4);
    }
    yield 5;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *spear(self, t) {
    yield* closeIn(self, t, 4);
    yield* equip(self, WEAPON.spear);
    anim(self, A.spear, 0.1);
    yield 5;
    if (!t.isValid || distTo(self, t) > 4.8) return;
    negate(self, t);
    hurt(self, t, 16, 'pierce');
    yield 8;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *chainAim(self, t) { yield* closeIn(self, t, 18); yield* chainAim(self, t); },
  /** @param {import('@minecraft/server').Entity} self */
  *chainSweep(self, t) { yield* closeIn(self, t, 18); yield* chainSweep(self); },

  /** @param {import('@minecraft/server').Entity} self */
  *gun(self, t) {
    yield* equip(self, WEAPON.pistol);
    anim(self, A.gun, 0.1);
    yield 4;
    for (let i = 0; i < 3; i++) {
      if (!t.isValid) return;
      face(self, t.location);
      const from = handPos(self), to = chest(t), d = dist(from, to), dir = dirTo(from, to);
      px(self.dimension, PX.muzzle, from);
      sfx(self.dimension, SFX.gun, from, 1.6);
      let blocked;
      try {
        blocked = self.dimension.getBlockFromRay(from, dir,
          { maxDistance: d, includeLiquidBlocks: false, includePassableBlocks: false });
      } catch { blocked = undefined; }
      if (blocked) {
        const hitAt = add(blocked.block.location, blocked.faceLocation);
        line(self.dimension, PX.tracer, from, hitAt, 1, 24);
        px(self.dimension, PX.muzzle, hitAt);
      } else {
        line(self.dimension, PX.tracer, from, to, 1, 24);
        hurt(self, t, 6, 'projectile');
      }
      yield 5;
    }
  },

  /** @param {import('@minecraft/server').Entity} self */
  *blitz(self, t) {
    anim(self, A.blitz, 0.1);
    sfx(self.dimension, SFX.blitz, self.location, 1.4);
    for (let hop = 0; hop < 5; hop++) {
      if (!t.isValid) return;
      const d = distTo(self, t);
      if (d < 2.5) break;
      const toward = dirTo(self.location, t.location);
      const side = scale(perpY(toward), hop % 2 ? 1.6 : -1.6);
      const dest = add(self.location, add(scale(toward, Math.min(4.5, d - 1.8)), side));
      afterimage(self);
      if (!safeTeleport(self, dest, t.location)) safeTeleport(self, add(self.location, scale(toward, Math.min(3, d - 1.8))), t.location);
      yield 2;
    }
    yield 2;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *backstab(self, t) {
    yield* equip(self, WEAPON.katana);
    afterimage(self);
    let view;
    try { view = t.getViewDirection(); } catch { return; }
    const behind = sub(t.location, scale(norm({ x: view.x, y: 0, z: view.z }), 1.4));
    if (!safeTeleport(self, behind, t.location)) return;
    anim(self, A.backstab, 0.1);
    yield 4;
    if (!t.isValid) return;
    hurt(self, t, 28, 'pierce'); // ×2 from behind
    px(self.dimension, PX.slash, chest(t));
    sfx(self.dimension, SFX.katana, chest(t), 1.3, 0.8);
    yield 6;
  },

  /** @param {import('@minecraft/server').Entity} self */
  *skm(self) {
    const s = state(self);
    s.skm = true;
    anim(self, A.skm, 0.3);
    sfx(self.dimension, SFX.skm, self.location, 2.5);
    try {
      self.addEffect('speed', 20000, { amplifier: 1, showParticles: false });
      self.addEffect('strength', 20000, { amplifier: 1, showParticles: false });
    } catch { /* ignore */ }
    for (let i = 0; i < 8; i++) { ring(self.dimension, PX.skm, add(self.location, { x: 0, y: 0.2 + i * 0.25, z: 0 }), 0.9, 10); yield 2; }
  },
};

/** Speed-blitz in when a close-range skill was rolled from far away */
function* closeIn(self, t, reach) {
  if (!t.isValid || distTo(self, t) <= reach) return;
  yield* SKILLS.blitz(self, t);
  if (t.isValid) face(self, t.location);
}

/** Inverted Spear of Heaven: strips buffs; switches Gojo's Infinity off for 6 s */
/** @param {import('@minecraft/server').Entity} self */
function negate(self, t) {
  try { for (const e of t.getEffects()) t.removeEffect(e.typeId); } catch { /* ignore */ }
  if (t.typeId === 'jjk:gojo') {
    const g = state(t);
    g.infinityOffUntil = now() + 120;
    g.domainUntil = 0;
  }
  px(self.dimension, PX.negate, chest(t));
  sfx(self.dimension, SFX.negate, chest(t), 1.5);
}

/** @param {import('@minecraft/server').Entity} self */
function afterimage(self) {
  for (let y = 0.2; y < 2; y += 0.3) px(self.dimension, PX.afterimage, add(self.location, { x: 0, y, z: 0 }));
}

/** @param {import('@minecraft/server').Entity} self */
function endChain(self) {
  setWeapon(self, WEAPON.chainSpear);
  try { self.setProperty('jjk:chain_len', 0); } catch { /* ignore */ }
}

/** draw chain links + spear head */
/** @param {import('@minecraft/server').Dimension} dim */
function drawChain(dim, rope) {
  const pts = rope.points, step = Math.max(1, Math.floor(pts.length / 14));
  for (let i = 1; i < pts.length - 1; i += step) px(dim, PX.chainLink, pts[i].p);
  px(dim, PX.spearTip, pts.at(-1).p);
}

const SUB = 2, DT = 0.05 / SUB; // two physics sub-steps per tick

/** @param {import('@minecraft/server').Dimension} dim */
function tipBlocked(dim, p) {
  try { const b = dim.getBlock(p); return !!b && !b.isAir && !b.isLiquid; } catch { return true; }
}

/** reel the chain back in: shortens maxLen, spear follows physically; never pulls targets */
/** @param {import('@minecraft/server').Entity} self */
function* reel(self, rope) {
  const dim = self.dimension;
  for (let k = 0; k < 60 && rope.maxLen > 0.8; k++) {
    if (!self.isValid) return;
    rope.maxLen = Math.max(0.6, rope.maxLen - 1.6);
    const h = handPos(self);
    for (let s = 0; s < SUB; s++) { driveTip(rope, h, 40, DT, 0.2); stepRope(rope, h, DT); }
    drawChain(dim, rope);
    if (k % 5 === 0) sfx(dim, SFX.chainClink, rope.points.at(-1).p, 0.7, 1.2);
    yield 1;
  }
}

/** aimed throw — any direction; longer distance = longer wind-up and flight */
/** @param {import('@minecraft/server').Entity} self */
function* chainAim(self, t) {
  yield* equip(self, WEAPON.chainSpear);
  const dim = self.dimension;
  const d = Math.min(MAX_CHAIN, distTo(self, t));
  try { self.setProperty('jjk:chain_len', Math.round(d)); } catch { /* ignore */ }
  try { self.playAnimation(A.chainAim, { blendOutTime: 0.2, stopExpression: "q.property('jjk:chain_len') == 0" }); } catch { /* ignore */ }
  yield Math.round(6 + d * 0.4); // wind-up grows with distance
  if (!t.isValid) return;
  const hand = handPos(self);
  const n = Math.max(6, Math.min(20, Math.ceil(d)));
  const rope = createRope(hand, hand, n, Math.min(MAX_CHAIN, d + 1.5), true);
  rope.points.at(-1).v = launchVelocity(hand, chest(t));
  setWeapon(self, WEAPON.chainOnly);
  sfx(dim, SFX.chainThrow, hand, 1.3);
  const hit = new Set();
  for (let tick = 0; tick < 60; tick++) {
    if (!self.isValid) return;
    const h = handPos(self);
    for (let s = 0; s < SUB; s++) stepRope(rope, h, DT);
    const tip = rope.points.at(-1);
    drawChain(dim, rope);
    if (tick % 4 === 0) sfx(dim, SFX.chainClink, tip.p, 0.6);
    for (const e of enemies(self, MAX_CHAIN + 3)) {
      if (hit.has(e.id) || dist(chest(e), tip.p) > 1.4) continue;
      hit.add(e.id);
      hurt(self, e, 12, 'pierce');
      knock(e, tip.v, 0.6, 0.15); // pushed along the spear's path, never toward Toji
      px(dim, PX.slash, tip.p);
      if (e.typeId === 'jjk:gojo') negate(self, e);
    }
    const slow = len(tip.v) < 2 && dist(tip.p, h) >= rope.maxLen - 0.2;
    if (hit.size || slow || tipBlocked(dim, tip.p)) break;
    yield 1;
  }
  yield* reel(self, rope);
  endChain(self);
}

/** 360° sweep around Toji — radius = farthest enemy (max 20 blocks) */
/** @param {import('@minecraft/server').Entity} self */
function* chainSweep(self) {
  yield* equip(self, WEAPON.chainSpear);
  const dim = self.dimension;
  const foes = enemies(self, MAX_CHAIN);
  const R = Math.max(4, Math.min(MAX_CHAIN, Math.max(...foes.map((e) => distTo(self, e)), 4) + 0.5));
  try { self.setProperty('jjk:chain_len', Math.round(R)); } catch { /* ignore */ }
  try { self.playAnimation(A.chainSweep, { blendOutTime: 0.2, stopExpression: "q.property('jjk:chain_len') == 0" }); } catch { /* ignore */ }
  yield 5;
  const hand = handPos(self);
  const n = Math.max(6, Math.min(20, Math.ceil(R)));
  const rope = createRope(hand, hand, n, R, true);
  setWeapon(self, WEAPON.chainOnly);
  sfx(dim, SFX.chainThrow, hand, 1.5, 0.8);
  const f = self.getViewDirection();
  let theta = Math.atan2(f.z, f.x), omega = 0, swept = 0;
  const omegaMax = Math.min(10, 28 / R); // spear speed capped ~28 blocks/s: bigger circle = slower turn
  const lastHit = new Map();
  for (let tick = 0; tick < 240 && swept < Math.PI * 2.5; tick++) {
    if (!self.isValid) return;
    const h = handPos(self);
    omega = Math.min(omegaMax, omega + omegaMax * 0.08);
    theta += omega * 0.05;
    swept += omega * 0.05;
    const goal = { x: h.x + Math.cos(theta) * R, y: h.y - 0.4, z: h.z + Math.sin(theta) * R };
    for (let s = 0; s < SUB; s++) { driveTip(rope, goal, 90, DT); stepRope(rope, h, DT); }
    drawChain(dim, rope);
    if (tick % 3 === 0) sfx(dim, SFX.chainClink, rope.points.at(-1).p, 0.7, 0.9 + Math.random() * 0.3);
    const pts = rope.points;
    for (const e of enemies(self, R + 2)) {
      if ((lastHit.get(e.id) ?? -1e9) > swept - Math.PI * 1.5) continue; // once per revolution
      const c = chest(e);
      let near = dist(c, pts.at(-1).p) < 1.6;
      for (let i = 1; i < pts.length && !near; i++) near = distToSegment(c, pts[i - 1].p, pts[i].p) < 0.8;
      if (!near) continue;
      lastHit.set(e.id, swept);
      hurt(self, e, 12, 'pierce');
      knock(e, sub(e.location, h), 1.0, 0.3); // flung outward, never pulled in
      px(dim, PX.slash, c);
    }
    yield 1;
  }
  yield* reel(self, rope);
  endChain(self);
}

/** passives every think tick */
/** @param {import('@minecraft/server').Entity} self */
export function tojiPassives(self) {
  const s = state(self);
  if (s.skm) {
    ring(self.dimension, PX.skm, add(self.location, { x: 0, y: 0.1, z: 0 }), 0.7, 6);
  }
}

/** Superhuman senses: sidestep an incoming projectile (once per projectile) */
/** @param {import('@minecraft/server').Entity} self */
export function tojiDodge(self, proj) {
  const s = state(self);
  if (s.dodged.has(proj.id)) return;
  s.dodged.add(proj.id);
  if (s.dodged.size > 64) s.dodged.clear();
  if (Math.random() > 0.4) return;
  const v = proj.getVelocity();
  const side = scale(perpY(norm(v)), Math.random() < 0.5 ? 1.6 : -1.6);
  afterimage(self);
  if (safeTeleport(self, add(self.location, side))) sfx(self.dimension, SFX.blitz, self.location, 0.6, 1.4);
}
