// Small 3D vector helpers. Plain {x,y,z} objects so they work with the game API.
/** @typedef {{x:number,y:number,z:number}} V3 */
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => len(sub(a, b));
export const norm = (a) => { const l = len(a) || 1; return scale(a, 1 / l); };
export const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
/** horizontal unit vector perpendicular to d (rotated 90° around Y) */
export const perpY = (d) => norm({ x: -d.z, y: 0, z: d.x });
/** distance from point p to segment a-b */
export function distToSegment(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return dist(p, add(a, scale(ab, t)));
}
