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
