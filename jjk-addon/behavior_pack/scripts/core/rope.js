// Chain of a Thousand Miles physics.
// The spear (tip) is a heavy free body under gravity. The chain pays out from Toji's hand:
// while the tip is closer than maxLen the chain is slack and never slows the spear; at
// maxLen the chain goes taut and only removes the spear's outward velocity (no pulling
// of anything toward Toji). Interior links are a position-based verlet rope pinned at the
// hand and the tip, so they sag and swing with real inertia.
import { add, sub, scale, len, dot } from './vec.js';

export const GRAVITY = -20; // blocks/s^2
const SLACK = 1.06;         // chain is 6% longer than the hand->tip distance while paying out

/**
 * @param {{x:number,y:number,z:number}} anchor hand position
 * @param {{x:number,y:number,z:number}} tip spear position
 * @param {number} n number of links
 * @param {number} [maxLen] maximum chain length (default |tip-anchor|)
 * @param {boolean} [coiled] start with the spear in the hand
 */
export function createRope(anchor, tip, n, maxLen, coiled = false) {
  const start = coiled ? anchor : tip;
  const L = maxLen ?? len(sub(tip, anchor));
  const points = [];
  for (let i = 0; i <= n; i++) {
    points.push({ p: add(anchor, scale(sub(start, anchor), i / n)), v: { x: 0, y: 0, z: 0 } });
  }
  const rope = { points, maxLen: L, seg: L / n };
  updateSeg(rope, anchor);
  return rope;
}

function updateSeg(rope, anchor) {
  const n = rope.points.length - 1;
  const span = len(sub(rope.points[n].p, anchor));
  rope.seg = Math.max(Math.min(span * SLACK, rope.maxLen), 0.05 * n) / n;
}

/** one physics step: gravity, drag, taut limit for the spear, sagging links */
export function stepRope(rope, anchor, dt, { gravity = GRAVITY, drag = 0.01, iterations = 20 } = {}) {
  const pts = rope.points, n = pts.length - 1, tip = pts[n];
  const old = pts.map((q) => q.p);
  for (let i = 1; i <= n; i++) {
    const q = pts[i];
    q.v = scale(add(q.v, { x: 0, y: gravity * dt, z: 0 }), i === n ? 1 : 1 - drag); // heavy spear: no air drag
    q.p = add(q.p, scale(q.v, dt));
  }
  // taut chain: spear may not go farther than maxLen; cancel only outward speed
  const r = sub(tip.p, anchor), d = len(r);
  if (d > rope.maxLen) {
    const u = scale(r, 1 / d);
    tip.p = add(anchor, scale(u, rope.maxLen));
    const out = dot(tip.v, u);
    if (out > 0) tip.v = sub(tip.v, scale(u, out));
  }
  pts[0].p = { ...anchor };
  updateSeg(rope, anchor);
  // links: both ends pinned (hand, spear); spear is never dragged by its own chain
  for (let it = 0; it < iterations; it++) {
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1], b = pts[i];
      const wa = i - 1 === 0 ? 0 : 1, wb = i === n ? 0 : 1;
      if (!(wa + wb)) continue;
      const dv = sub(b.p, a.p), l = len(dv);
      if (l <= rope.seg || l === 0) continue;
      const corr = scale(dv, (l - rope.seg) / l / (wa + wb));
      a.p = add(a.p, scale(corr, wa));
      b.p = sub(b.p, scale(corr, wb));
    }
  }
  for (let i = 1; i < n; i++) pts[i].v = scale(sub(pts[i].p, old[i]), 1 / dt);
}

/** velocity that lands a free projectile from a onto b (speed in blocks/s) */
export function launchVelocity(a, b, speed = 18, gravity = GRAVITY) {
  const d = sub(b, a), T = Math.max(len(d) / speed, 0.15);
  return { x: d.x / T, y: d.y / T - 0.5 * gravity * T, z: d.z / T };
}

/** spring-drive the spear toward goal (360° sweep): accelerates, never teleports */
export function driveTip(rope, goal, stiffness, dt, damping = 0.12) {
  const tip = rope.points.at(-1);
  tip.v = scale(add(tip.v, scale(sub(goal, tip.p), stiffness * dt)), 1 - damping);
}
