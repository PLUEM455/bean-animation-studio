// Targeting, damage, knockback and rule-checked block breaking.
import { EntityDamageCause, system } from '@minecraft/server';
import { isNatural } from '../core/blockRules.js';
import { add, sub, scale, len, norm, dist } from '../core/vec.js';

/** per-entity runtime state */
const STATE = new Map();
/** @param {import('@minecraft/server').Entity} e */
export function state(e) {
  let s = STATE.get(e.id);
  if (!s) {
    s = { cd: {}, busy: false, skm: false, infinityOffUntil: 0, domainUntil: 0, attackers: new Map(), dodged: new Set() };
    STATE.set(e.id, s);
  }
  return s;
}
/** drop state of mobs that no longer exist */
export function prune(validIds) { for (const id of STATE.keys()) if (!validIds.has(id)) STATE.delete(id); }

export const now = () => system.currentTick;

/** remember who hit `victim` (kept 30 s) */
/** @param {import('@minecraft/server').Entity} victim */
export function recordAttacker(victim, attacker) {
  if (!attacker || attacker.id === victim.id) return;
  state(victim).attackers.set(attacker.id, { e: attacker, until: now() + 600 });
}

const alive = (e) => {
  try { return e.isValid && (e.getComponent('minecraft:health')?.currentValue ?? 1) > 0; } catch { return false; }
};

/** enemies of `self`: monsters nearby + anyone who attacked it recently */
/** @param {import('@minecraft/server').Entity} self */
export function enemies(self, radius) {
  const out = new Map();
  const s = state(self);
  for (const [id, a] of s.attackers) {
    if (a.until < now() || !alive(a.e)) { s.attackers.delete(id); continue; }
    if (a.e.dimension.id === self.dimension.id && dist(a.e.location, self.location) <= radius) out.set(id, a.e);
  }
  try {
    for (const m of self.dimension.getEntities({ location: self.location, maxDistance: radius, families: ['monster'] })) {
      if (m.id !== self.id && alive(m)) out.set(m.id, m);
    }
  } catch { /* ignore */ }
  return [...out.values()];
}

/**
 * best target: most recent attacker in 32, else nearest monster in 16.
 * hidden(t, d) lets a mob ignore targets it cannot sense (Zero Cursed Energy).
 * @param {(t: any, d: number) => boolean} [hidden]
 */
/** @param {import('@minecraft/server').Entity} self */
export function pickTarget(self, hidden = (_t, _d) => false) {
  const s = state(self);
  let best, bestUntil = -1;
  for (const a of s.attackers.values()) {
    if (alive(a.e) && a.until > bestUntil && a.e.dimension.id === self.dimension.id &&
        dist(a.e.location, self.location) <= 32) { best = a.e; bestUntil = a.until; }
  }
  if (best) return best;
  let nd = Infinity;
  for (const m of enemies(self, 16)) {
    const d = dist(m.location, self.location);
    if (d < nd && !hidden(m, d)) { nd = d; best = m; }
  }
  return best;
}

const scriptHit = new Map(); // targetId -> tick (so after-events can tell script damage apart)
export const isScriptHit = (id) => scriptHit.get(id) === now();

/** damage with attribution; kind: 'melee' | 'pierce' (ignores armour) | 'projectile' */
/** @param {import('@minecraft/server').Entity} self */
export function hurt(self, target, amount, kind = 'melee') {
  if (!alive(target)) return false;
  const mult = state(self).skm ? 1.5 : 1;
  scriptHit.set(target.id, now());
  try {
    return target.applyDamage(amount * mult, {
      cause: kind === 'pierce' ? EntityDamageCause.magic
        : kind === 'projectile' ? EntityDamageCause.projectile : EntityDamageCause.entityAttack,
      damagingEntity: self,
    });
  } catch { return false; }
}

/** horizontal push along dir (blocks of force) + upward strength */
/** @param {import('@minecraft/server').Entity} target */
export function knock(target, dir, h, v) {
  const d = norm({ x: dir.x, y: 0, z: dir.z });
  try { target.applyKnockback({ x: d.x * h, z: d.z * h }, v); } catch { /* ignore */ }
}

/** @param {import('@minecraft/server').Entity} self */
export function face(self, loc) {
  try { self.teleport(self.location, { facingLocation: loc }); } catch { /* ignore */ }
}

/** break one block if the rule allows it (drops items, vanilla break effect) */
/** @param {import('@minecraft/server').Dimension} dim */
export function breakAt(dim, loc) {
  const p = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
  let b;
  try { b = dim.getBlock(p); } catch { return false; }
  if (!b || b.isAir || b.isLiquid || isNatural(b.typeId)) return false;
  try { dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`); return true; } catch { return false; }
}

/** break allowed blocks in a sphere, at most `cap` */
/** @param {import('@minecraft/server').Dimension} dim */
export function breakSphere(dim, c, r, cap = 40) {
  let n = 0;
  const R = Math.ceil(r);
  for (let x = -R; x <= R && n < cap; x++)
    for (let y = -R; y <= R && n < cap; y++)
      for (let z = -R; z <= R && n < cap; z++)
        if (x * x + y * y + z * z <= r * r && breakAt(dim, { x: c.x + x, y: c.y + y, z: c.z + z })) n++;
  return n;
}

/** a standing spot (feet + head free) */
/** @param {import('@minecraft/server').Dimension} dim */
export function standable(dim, loc) {
  try {
    const f = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
    const h = f?.above();
    return !!f && !!h && (f.isAir || f.isLiquid) && (h.isAir || h.isLiquid);
  } catch { return false; }
}

/** safe teleport: try loc, then 1 block up/down */
/** @param {import('@minecraft/server').Entity} self */
export function safeTeleport(self, loc, facing) {
  for (const dy of [0, 1, -1, 2]) {
    const l = { x: loc.x, y: Math.floor(loc.y) + dy, z: loc.z };
    if (standable(self.dimension, l)) {
      try { self.teleport(l, facing ? { facingLocation: facing } : undefined); return true; } catch { return false; }
    }
  }
  return false;
}

export const chest = (e) => add(e.location, { x: 0, y: 1.1, z: 0 });
export const handPos = (e) => {
  const d = e.getViewDirection();
  return add(e.location, add({ x: 0, y: 1.3, z: 0 }, add(scale(norm({ x: d.x, y: 0, z: d.z }), 0.5),
    scale(norm({ x: d.z, y: 0, z: -d.x }), 0.35))));
};
export const dirTo = (a, b) => norm(sub(b, a));
export const hp = (e) => {
  const h = e.getComponent('minecraft:health');
  return h ? h.currentValue / h.effectiveMax : 1;
};
export const distTo = (a, b) => len(sub(a.location, b.location));
