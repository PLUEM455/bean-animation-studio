// Visual / audio helpers. Every call is guarded: spawning into an unloaded chunk throws.
import { add, sub, scale, len } from '../core/vec.js';

/** @param {import('@minecraft/server').Dimension} dim */
export function px(dim, id, loc) {
  try { dim.spawnParticle(id, loc); } catch { /* chunk unloaded */ }
}

/** @param {import('@minecraft/server').Dimension} dim */
export function sfx(dim, id, loc, volume = 1, pitch = 1) {
  try { dim.playSound(id, loc, { volume, pitch }); } catch { /* ignore */ }
}

/** @param {import('@minecraft/server').Entity} entity */
export function anim(entity, name, blendOutTime = 0.2) {
  try { entity.playAnimation(name, { blendOutTime }); } catch { /* ignore */ }
}

/** particles along a-b every `step` blocks, at most `cap` */
/** @param {import('@minecraft/server').Dimension} dim */
export function line(dim, id, a, b, step = 0.5, cap = 60) {
  const d = sub(b, a), l = len(d), n = Math.min(cap, Math.max(1, Math.floor(l / step)));
  for (let i = 0; i <= n; i++) px(dim, id, add(a, scale(d, i / n)));
}

/** evenly spread points on a sphere (fibonacci), `n` particles */
/** @param {import('@minecraft/server').Dimension} dim */
export function shell(dim, id, c, r, n) {
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rr = Math.sqrt(1 - y * y), th = ga * i;
    px(dim, id, { x: c.x + Math.cos(th) * rr * r, y: c.y + y * r, z: c.z + Math.sin(th) * rr * r });
  }
}

/** @param {import('@minecraft/server').Dimension} dim */
export function ring(dim, id, c, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    px(dim, id, { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r });
  }
}

/**
 * Camera shake for players near `loc` (vanilla /camerashake, stable).
 * @param {import('@minecraft/server').Dimension} dim
 */
export function shake(dim, loc, radius, intensity, seconds) {
  const p = (n) => n.toFixed(1);
  try {
    dim.runCommand(`camerashake add @a[x=${p(loc.x)},y=${p(loc.y)},z=${p(loc.z)},r=${radius}] ` +
      `${Math.min(4, intensity).toFixed(2)} ${seconds.toFixed(2)} positional`);
  } catch { /* ignore */ }
}

/**
 * Jagged lightning bolt: `segs` kinked segments from `from` toward `dir`.
 * @param {import('@minecraft/server').Dimension} dim
 */
export function bolt(dim, id, from, dir, length, segs = 7, jitter = 0.7) {
  let a = from;
  for (let i = 1; i <= segs; i++) {
    const t = (length * i) / segs;
    const b = {
      x: from.x + dir.x * t + (Math.random() - 0.5) * jitter,
      y: from.y + dir.y * t + (Math.random() - 0.5) * jitter,
      z: from.z + dir.z * t + (Math.random() - 0.5) * jitter,
    };
    line(dim, id, a, b, 0.18, 10);
    a = b;
  }
}

/** n bolts bursting out of loc in random directions */
export function bolts(dim, ids, loc, n, length) {
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    bolt(dim, ids[i % ids.length], loc, { x: r * Math.cos(th), y: u, z: r * Math.sin(th) }, length * (0.6 + Math.random() * 0.6));
  }
}

/**
 * Layered hit: flash + shockwave ring + sparks (+ optional smoke / extra particles) + shake.
 * @param {import('@minecraft/server').Dimension} dim
 * @param {{flash?: string, ring?: string, sparks?: string, smoke?: string, extra?: string[], shake?: number, radius?: number}} o
 */
export function impact(dim, loc, o) {
  if (o.flash) px(dim, o.flash, loc);
  if (o.ring) px(dim, o.ring, { x: loc.x, y: loc.y - 0.6, z: loc.z });
  if (o.sparks) px(dim, o.sparks, loc);
  if (o.smoke) px(dim, o.smoke, loc);
  for (const id of o.extra ?? []) px(dim, id, loc);
  if (o.shake) shake(dim, loc, o.radius ?? 16, o.shake, 0.25 + o.shake * 0.15);
}
