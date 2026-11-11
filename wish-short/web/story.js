// "ถ้าคนทั้งโลกขอพรได้ข้อเดียว" — shot plan. Picture timeline = 30 fps, 65 s. Voice blocks are placed by place_voice.py (see times below).
// voice (s): A 0.20-3.15 | B 3.60-6.32 | C 6.70-8.46 | D 8.80-11.12 | EFG 11.30-14.08 | H 22.00-25.76 | I 29.00-30.82 | J 37.80-38.97
//            K 41.30-43.49 | LM 46.80-49.72 | NO 50.30-52.18 | P 61.30-62.88
import { M as MO, clamp, lerp, lerp3, ramp, camFromKeys, blinkAt, q, spline } from './motion.js';
export const FPS = 30, TOTAL = 1950;
const S = (t) => Math.round(t * 30);
const PX = 130;
const HERO = [2, 0, 1];
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pw = (t, pts) => { // piecewise linear [[t,v],...]
  if (t <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (t <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (t - pts[i][0]) / (pts[i + 1][0] - pts[i][0])); return pts[pts.length - 1][1];
};

// ---------- lights ----------
const BASE = { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 90, fogFar: 900, skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 40 };
export const LIGHTS = {
  day: BASE,
  dim: { ...BASE, sky: '#8a90a8', ground: '#585a64', hemi: 0.95, sun: '#d8d4e6', sunI: 1.5, fog: '#9a9eb4', fogNear: 60, fogFar: 700, skyTop: '#46547f', skyHor: '#a09cb4', sat: 0.95, vig: 0.3 },
  smoke: { ...BASE, az: 200, el: 20, sky: '#c8a48c', ground: '#6a5448', hemi: 0.95, sun: '#ffb069', sunI: 2.3, fog: '#c8997a', fogNear: 50, fogFar: 600, skyTop: '#6a5a6a', skyHor: '#e8a672', sat: 1.05, vig: 0.32, sunDisc: '#ffcf94', sunSize: 0.004 },
  gold: { ...BASE, el: 30, sky: '#ffe9a8', ground: '#caa860', hemi: 1.5, sun: '#fff0c0', sunI: 3.2, fog: '#ffe3a0', skyTop: '#ffd86a', skyHor: '#fff2c0', sat: 1.2, gain: '#fff0d0', vig: 0.25 },
  morning: { ...BASE, az: 100, el: 28, sky: '#cfe2f5', ground: '#8a7a64', hemi: 1.1, sun: '#ffe3c0', sunI: 2.5, fog: '#f0dcc4', fogNear: 70, fogFar: 800, skyTop: '#5aa0e2', skyHor: '#ffe6c4', sat: 1.12, vig: 0.22 },
  night: { ...BASE, el: 12, sky: '#303a66', ground: '#252840', hemi: 0.6, sun: '#7a8ac8', sunI: 0.9, fog: '#2a3258', skyTop: '#0e1230', skyHor: '#3a4474', sat: 0.9, vig: 0.35 },
};
const mixL = (A, B, t) => { const o = { ...A }; for (const k of ['sky', 'ground', 'sun', 'fog', 'skyTop', 'skyHor']) o[k] = mixHex(A[k], B[k], t);
  for (const k of ['hemi', 'sunI', 'sat', 'vig', 'fogNear', 'fogFar', 'el']) o[k] = lerp(A[k], B[k], t); return o; };

// ---------- shots ----------
const K = (t, pos, look, fov, roll = 0, ease) => ({ f: S(t), pos, look, fov, roll, ...(ease ? { ease } : {}) });
const SEGS = [];
const seg = (id, t0, t1, light, keys, o = {}) => SEGS.push({ id, a: S(t0), b: S(t1) - 1, light, keys, ...o });
const FB = [PX - 26, 7, 22];
seg('hook', 0, 3.4, 'day', [K(0, [2.15, 1.5, 2.55], [2, 1.46, 1], 42), K(3.4, [2.1, 1.5, 1.95], [2, 1.46, 1], 33)]);
seg('montage', 3.4, 4.47, 'day', [K(3.4, [-24, 20, 20], [0, 1, 0], 55), K(4.47, [-14, 12, 15], [0, 1, 0], 52)]);
seg('montage', 4.47, 5.53, 'day', [K(4.47, [-5, 0.7, 5.5], [1, 2.4, 0], 62), K(5.53, [-3, 0.9, 4.5], [1, 2.6, 0], 58, 4)]);
seg('montage', 5.53, 6.6, 'day', [K(5.53, [6, 1.7, 3.5], [10, 2.4, -1], 50), K(6.6, [5, 1.7, 2.8], [10, 2.8, -1], 46, -3)]);
seg('push', 6.6, 8.8, 'day', [K(6.6, [-60, 3, 1.2], [0, 2.4, 0.5], 55), K(8.8, [-12, 2.0, 1.0], [2, 2.0, 0.6], 50, 0, 'easeOut')]);
seg('hands', 8.8, 11.3, 'day', [K(8.8, [-6, 0.8, 6], [2, 2.2, 0.5], 60), K(11.3, [-4, 1.1, 5], [2, 2.6, 0.5], 55)]);
seg('crackS', 11.3, 14.3, 'day', [K(11.3, [0, 1.2, 9], [2, 2.0, 0], 62), K(12.3, [0, 1.2, 9], [2, 30, -25], 64), K(14.3, [0, 1.2, 9], [2, 60, -30], 72)], { shake: 0.05 });
seg('rules', 14.3, 15.9, 'dim', [K(14.3, [4, 4.6, 14], [4, 4.2, -3], 50), K(15.9, [4, 4.5, 11.5], [4, 4.2, -3], 50)]);
seg('rules', 15.9, 17.5, 'dim', [K(15.9, [8, 3.2, 12], [4, 4.2, -3], 48, 3), K(17.5, [6, 3.8, 10], [4, 4.2, -3], 48, 1)]);
seg('rules', 17.5, 19.0, 'dim', [K(17.5, [0, 5.4, 12], [4, 4.0, -3], 48, -2), K(19.0, [3, 4.6, 10], [4, 4.0, -3], 48, 0)]);
seg('slump', 19.0, 21.8, 'dim', [K(19.0, [-20, 4, 14], [2, 1.6, 0], 50), K(21.8, [-14, 3.2, 11], [2, 1.6, 0], 48)]);
seg('live', 21.8, 25.9, 'dim', [K(21.8, [-34, 1.65, 2.2], [-24, 1.85, 1.8], 64), K(25.9, [-6, 1.65, 1.4], [6, 1.9, -0.5], 62)], { shake: 0.035 });
seg('tankS', 25.9, 28.8, 'dim', [K(25.9, [-6, 1.6, 1.4], [8, 1.7, -1.5], 62), K(28.8, [-6, 1.6, 1.4], [8, 2.0, -1.5], 54)], { shake: 0.06 });
seg('carS', 28.8, 31.0, 'dim', [K(28.8, [-5, 1.4, 3], [0, 6, 0], 58), K(31.0, [-5, 1.4, 3], [0, 6, 0], 72)], { shake: 0.05 });
seg('gunS', 31.0, 33.6, 'dim', [K(31.0, [-3, 1.4, 6.5], [10, 1.6, 3], 56), K(33.6, [-1, 1.5, 6.5], [10, 2.4, 3], 50)], { shake: 0.09 });
seg('robotS', 33.6, 37.4, 'dim', [K(33.6, [18, 3.6, 23], [18, 5.2, -2], 62), K(36.3, [16, 4.4, 21], [16, 4.4, -2], 56), K(37.4, [16, 4.4, 20], [16, 4.0, -2], 54)], { shake: 0.0 });
seg('giantS', 37.4, 40.6, 'dim', [K(37.4, [-6, 1.6, 3], [40, 9, -2], 70), K(39.0, [-6, 1.6, 3], [30, 13, -2], 72), K(40.6, [-6, 1.6, 3], [24, 16, -2], 72)], { shake: 0.06 });
seg('ruins', 40.6, 44.0, 'smoke', [K(40.6, [-22, 8, 22], [0, 4, 0], 52), K(44.0, [-6, 52, 27], [0, 3, 0], 56)]);
seg('golden', 44.0, 46.6, 'smoke', [K(44.0, [2.3, 1.5, 3.1], [2, 1.5, 1], 40), K(46.6, [2.2, 1.5, 2.3], [2, 1.55, 1], 32)]);
seg('fb1', 46.6, 50.2, 'smoke', [K(46.6, FB, [PX, 1.2, 0], 50), K(50.2, [PX - 18, 8, 24], [PX, 1.2, 0], 50)]);
seg('fbpov', 50.2, 53.4, 'smoke', [K(50.2, [PX - 14, 1.65, 24], [PX - 22, 1.6, 12], 62), K(51.0, [PX - 14, 1.65, 24], [PX - 14, 1.2, 10], 62), K(51.3, [PX - 14, 1.5, 20], [PX - 13, 1.0, 9], 28), K(52.2, [PX - 8, 1.4, 17], [PX - 9, 1.0, 5], 24), K(53.4, [PX - 5, 1.3, 14], [PX - 9, 1.0, 5], 22)], { shake: 0.02 });
seg('fb2', 53.4, 57.2, 'smoke', [K(53.4, [PX - 14, 1.3, 10], [PX - 8, 1.0, 3], 54), K(55.0, [PX + 4, 4, 16], [PX + 18, 6, 2], 56), K(57.2, [PX + 14, 6, 24], [PX + 32, 6, 2], 54)]);
seg('days', 57.2, 59.0, 'morning', [K(57.2, [-30, 9, 24], [0, 7, 0], 56), K(59.0, [-22, 10, 20], [0, 7, 0], 52)]);
seg('poster', 59.0, 61.2, 'morning', [K(59.0, [30, 6, 12], [30, 8.8, -12], 48), K(61.2, [30, 8.2, 2], [30, 9.0, -12], 48)]);
seg('close', 61.2, 65.0, 'morning', [K(61.2, [2, 1.6, 7], [2, 2.0, 0], 55), K(65.0, [6, 7, 32], [2, 3.0, 0], 55)]);
export const SHOTS = SEGS;
export const shotAt = (f) => SEGS.find((s) => f >= s.a && f <= s.b) || SEGS[SEGS.length - 1];

// ---------- timelines ----------
const RUIN = [[0, 0], [25.9, 0], [27, 0.06], [29, 0.14], [31, 0.26], [33.5, 0.4], [36.6, 0.58], [38.5, 0.8], [40.6, 0.95], [41.6, 1]];
const TANK = { x: 14, z: -2, ry: Math.PI, s: 1.25, pop: 26.6, fire: 27.9 };
const GUN = { x: 10, z: 3, pitch: 0.45, t0: 31.6, t1: 33.0 };
const ROB = { x0: 30, z: -1, s: 1.2, walk0: 33.4, trip: 34.7, fall: 35.0, land: 36.6, v: 6 };
const robotX = (t) => ROB.x0 - (Math.min(t, ROB.trip) - ROB.walk0) * ROB.v;
const CAR_PATH = [[-45, 14, 12], [-22, 8, 6], [-8, 3.0, 2.6], [8, 5, -2], [30, 16, -10], [60, 26, -20]];
const carPos = (t) => spline(CAR_PATH, clamp((t - 28.8) / 2.3));
const HP0 = [PX - 24, 0, 14], HP1 = [PX - 8, 0, 4];
const heroRun = (t) => { const u = clamp((t - 50.0) / 2.4); return [lerp(HP0[0], HP1[0], u), 0, lerp(HP0[2], HP1[2], u)]; };
const KICK = 53.9, CARHIT = 54.8, GOAL = 56.0;
const BALL0 = [PX - 7, 0.35, 3.2];
const ballFly = (t) => {
  if (t < KICK) return [PX - 7.6, 0.35, 3.3];
  if (t < CARHIT) { const u = (t - KICK) / (CARHIT - KICK); return [lerp(BALL0[0], PX + 14, u), lerp(0.4, 9, u * (2 - u)), lerp(3.2, 2, u)]; }
  if (t < GOAL) { const u = (t - CARHIT) / (GOAL - CARHIT); return [lerp(PX + 14, PX + 34, u), lerp(9, 1.8, u * u) + Math.sin(u * 3.14) * 3, lerp(2, 0.6, u)]; }
  return [PX + 34.6, 0.3, 0.6];
};
const keeperPos = (t) => { const u = clamp((t - (GOAL - 0.15)) / 1.4); return [PX + 32.2 + u * 1.2, 0.2 + 12.5 * Math.sin(u * 2.4) * (u < 0.85 ? 1 : 0.1), 0.5 + 6.2 * u]; };

// crowd roster (deterministic)
const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const WHO = ['civA', 'civB', 'civC', 'civD', 'civE', 'civF', 'workA', 'workB', 'toga'];
const CROWD = (() => { const r = rng(5), a = []; let tries = 0;
  while (a.length < 26 && tries++ < 800) { const x = -16 + r() * 34, z = -7 + r() * 14; if (Math.hypot(x - 2, z - 1) < 2.0) continue; if (a.some((p) => Math.hypot(p.x - x, p.z - z) < 1.7)) continue;
    a.push({ x, z, who: WHO[a.length % WHO.length], seed: 40 + a.length, th: r() }); } return a; })();

export const camAt = (f) => {
  const Sg = shotAt(f), t = f / 30;
  let c = camFromKeys(Sg.keys, f, { creep: 0.0012 });
  c = { ...c, pos: [...c.pos], look: [...c.look] };
  if (Sg.id === 'carS') { const cp = carPos(t - 0.06); c.look = [cp[0], cp[1], cp[2]]; }
  if (Sg.id === 'fbpov' && t >= 51.0) { const h = heroRun(t); c.look = [h[0], lerp(1.0, 0.8, ramp(t, 51.0, 52.5)), h[2]]; }
  if (Sg.id === 'fb2' && t >= 54.1 && t < 56.8) { const b = ballFly(t); const w = ramp(t, 54.1, 54.7); c.look = [lerp(c.look[0], b[0], w), lerp(c.look[1], b[1], w), lerp(c.look[2], b[2], w)]; }
  if (Sg.shake) { const a = Sg.shake, n = (s) => Math.sin(f * 0.9 + s) * 0.6 + Math.sin(f * 2.3 + s * 2.1) * 0.4;
    c.pos = [c.pos[0] + n(1) * a * 0.6, c.pos[1] + n(2) * a, c.pos[2] + n(3) * a * 0.6]; c.look = [c.look[0] + n(4) * a * 3, c.look[1] + n(5) * a * 3, c.look[2] + n(6) * a * 3]; c.roll = (c.roll || 0) + n(7) * a * 18; }
  const KICKS = [[27.9, 0.07], [26.7, 0.05], [29.9, 0.04], [36.6, 0.08], [37.9, 0.05], [38.3, 0.06], [39.0, 0.06], [39.8, 0.06], [54.85, 0.04], [56.0, 0.05]];
  for (const [kt, a] of KICKS) { const d = f - S(kt); if (d >= 0 && d < 8) { const s = (d % 2 ? -1 : 1) * a * (1 - d / 8); c.look = [c.look[0], c.look[1] + s * 4, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 22; } }
  let fl = 0;
  if (t >= 14.0 && t < 14.3) fl = 0.9 * (1 - (t - 14.0) / 0.3);
  if (Sg.id === 'crackS' && t >= 12.9 && t < 13.05) fl = 0.45;
  if (t >= 27.9 && t < 28.05) fl = 0.5 * (1 - (t - 27.9) / 0.15);
  if (t >= 36.6 && t < 36.8) fl = 0.4 * (1 - (t - 36.6) / 0.2);
  if (t >= 45.35 && t < 46.2) fl = t < 45.6 ? (t - 45.35) / 0.25 : 1 - (t - 45.6) / 0.6;
  if (t >= 54.8 && t < 54.9) fl = 0.3;
  if (t >= 57.2 && t < 57.3) fl = 0.6;
  if (t >= 64.4) fl = Math.max(fl, ramp(t, 64.4, 64.95));
  c.flash = clamp(fl);
  if (Sg.id === 'ruins' || Sg.id === 'days') c.shadowAt = [0, 0, 0];
  if (Sg.id.startsWith('fb')) c.shadowAt = [PX - 6, 0, 4];
  return c;
};

export const lightFor = (Sg, f) => {
  const t = f / 30; let L = { ...LIGHTS[Sg.light] };
  if (Sg.id === 'hands' || Sg.id === 'crackS') L = mixL(LIGHTS.day, LIGHTS.dim, ramp(t, 10.2, 13.8));
  if (Sg.id === 'golden') { const w = t < 45.35 ? 0 : t < 45.6 ? (t - 45.35) / 0.25 : clamp(1 - (t - 45.9) / 0.7); L = mixL(LIGHTS.smoke, LIGHTS.gold, w); }
  if (Sg.id === 'days') { const u = (f - Sg.a) / (Sg.b - Sg.a + 1); const w = 0.5 - 0.5 * Math.cos(u * 3 * Math.PI * 2); L = mixL(LIGHTS.night, LIGHTS.morning, w); }
  if (Sg.id === 'close') L = mixL(LIGHTS.morning, LIGHTS.dim, ramp(t, 62.5, 64.5));
  if (Sg.id === 'poster') L = mixL(LIGHTS.night, LIGHTS.morning, 0.7 + 0.3 * ramp(t, 59.0, 59.5));
  L.shadowExt = (Sg.id === 'ruins' || Sg.id === 'days') ? 80 : 34;
  return L;
};

export const dofAt = (f) => {
  const Sg = shotAt(f), C = camAt(f), t = f / 30;
  switch (Sg.id) {
    case 'hook': return { focus: dist3(C.pos, [2, 1.46, 1]), cinf: 16 };
    case 'rules': return { focus: dist3(C.pos, [4, 4.2, -3]), cinf: 7 };
    case 'golden': return { focus: dist3(C.pos, [2, 1.5, 1]), cinf: 9 };
    case 'poster': return { focus: dist3(C.pos, [30, 8.8, -11]), cinf: 5 };
    case 'fbpov': return t > 51.0 ? { focus: dist3(C.pos, C.look), cinf: 7 } : { focus: 14, cinf: 4 };
    case 'live': return { focus: 14, cinf: 3 };
  }
  return { focus: 30, cinf: 0 };
};

// ---------- world (props / ruin / crack) ----------
export const worldAt = (f) => {
  const Sg = shotAt(f), t = f / 30, Wd = {};
  Wd.ruin = pw(t, RUIN);
  Wd.crack = t < 10.6 ? 0 : t < 14.3 ? ramp(t, 10.6, 14.0) : t < 44.8 ? 1 : t < 46 ? 1 - ramp(t, 44.8, 46) : t < 62.5 ? 0 : ramp(t, 62.5, 64.4);
  if (t >= TANK.pop && t < 46.6) { const u = t - TANK.pop, up = Math.min(1, u / 0.5), y = lerp(-2.4, 0, MO.easeOut(up)), st = 1 + 0.18 * Math.sin(u * 14) * Math.exp(-u * 4);
    const k = t >= ROB.land ? MO.easeOut((t - ROB.land) / 0.25) : 0;
    Wd.tank = { x: TANK.x, y, z: TANK.z, ry: TANK.ry, s: TANK.s, sy: (up < 1 ? st : 1) * (1 - 0.62 * k), rz: 0.1 * k, tr: Math.sin(u * 3) * 0.3 * (1 - ramp(t, TANK.fire - 0.6, TANK.fire)), recoil: t > TANK.fire ? 0.9 * Math.exp(-(t - TANK.fire) * 8) : 0 }; }
  if (t >= 28.8 && t < 31.0) { const p = carPos(t), p2 = carPos(t + 0.05); Wd.car = { pos: p, ry: Math.atan2(-(p2[2] - p[2]), p2[0] - p[0]), rz: 0.35 * Math.sin(t * 4), rx: 0.3 * Math.sin(t * 3), s: 1.5, t: f }; }
  else if (t >= 46.0 && t < CARHIT) Wd.car = { pos: [PX + 14, 9 + Math.sin(t * 2) * 0.4, 2], ry: Math.PI, rz: 0.06 * Math.sin(t * 1.5), s: 1.5, t: f };
  else if (t >= CARHIT && t < 57.2) { const u = t - CARHIT, y = Math.max(0.6, 9 - 0.5 * 14 * u * u); Wd.car = { pos: [PX + 14 + u * 2, y, 2 + u], ry: Math.PI + u * 3, rz: y > 0.7 ? u * 4.5 : 1.4, rx: 0.2, s: 1.5, t: f }; }
  if (t >= 30.9 && t < 44.0) { const firing = t >= GUN.t0 && t < GUN.t1; Wd.gun = { x: GUN.x, z: GUN.z, ry: 0, pitch: GUN.pitch, flash: firing && f % 2 === 0 ? 1 : 0 };
    const tr = []; for (let i = 0; i < 28; i++) { const born = GUN.t0 + i * 0.05, age = t - born; if (age < 0 || age > 0.55 || born > GUN.t1) continue; const p = GUN.pitch, mx = GUN.x + 4.6 * Math.cos(p) - 2.25 * Math.sin(p), my = 4.6 * Math.sin(p) + 2.25 * Math.cos(p), dz = Math.sin(i * 7.3) * 0.12;
      tr.push({ pos: [mx + Math.cos(p) * age * 70, my + Math.sin(p) * age * 70, GUN.z + dz * age * 70], dir: [Math.cos(p), Math.sin(p), dz] }); } Wd.tracers = tr; }
  if (t >= ROB.walk0 && t < 46.6) {
    const x = robotX(t); let rz = 0, walk = t * 7.5, knee = 0, arm = 0;
    if (t >= ROB.trip && t < ROB.fall) { knee = 0.9; arm = -1.2 * Math.sin((t - ROB.trip) * 20); walk = ROB.trip * 7.5; }
    if (t >= ROB.fall) { const u = clamp((t - ROB.fall) / (ROB.land - ROB.fall)); rz = -(Math.PI / 2) * Math.pow(u, 2.3); walk = ROB.trip * 7.5; arm = -0.6 * u;
      if (t > ROB.land) rz = -(Math.PI / 2) + 0.09 * Math.exp(-(t - ROB.land) * 9) * Math.abs(Math.sin((t - ROB.land) * 18)); }
    Wd.robot = { x, z: ROB.z, ry: Math.PI, s: ROB.s, rz, walk, knee, arm };
  } else if (t >= 46.6 && t < 57.2) Wd.robot = { x: PX + 30, z: 8, ry: Math.PI, s: 1.1, rz: 0, walk: 0, arm: t > 54.7 && t < 56.5 ? 1.2 : 0.15, knee: 0 };
  else if (t >= 57.2) Wd.robot = { x: robotX(ROB.trip), z: ROB.z, ry: Math.PI, s: ROB.s, rz: -(Math.PI / 2), walk: 0, arm: -0.6 };
  if (Sg.id === 'rules') { const i = t < 15.9 ? 0 : t < 17.5 ? 1 : 2, t0 = [14.3, 15.9, 17.5][i], u = MO.back((t - t0) / 0.35, 2.2);
    Wd.board = { pos: [4, 0, -3], ry: 0, s: Math.max(0.02, u), idx: i, lines: [['ข้อ 1', 'ขอได้แค่เรื่อง', 'ของตัวเองเท่านั้น'], ['ข้อ 2', 'ห้ามขอสิ่งที่', 'ไม่มีที่สิ้นสุด'], ['ข้อ 3', 'ห้ามขอสิ่งที่', 'ลบเลือนความจริง']][i] }; }
  if (Sg.id === 'poster') Wd.poster = { pos: [30, 0, -12], ry: 0 };
  return Wd;
};

// ---------- actors (2D cards) ----------
const A = (T, who, o, pos, ex = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...ex });
const stepQ = (t, sp, ph = 0) => Math.floor(((t * sp + ph) % 1) * 8) / 8;
const crowdActors = (f, T, mode, opt = {}) => {
  const t = f / 30, out = [];
  CROWD.forEach((c, i) => {
    let o, x = c.x, z = c.z, roll = 0, bobY = 0;
    const sway = Math.sin(t * 2.2 + i) * 2.5, hop = Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.07;
    if (mode === 'wish') { o = { L: 'up', R: 'up', expr: 'smile_closed', seed: c.seed, blink: 0 }; roll = sway; bobY = hop * 0.4; }
    else if (mode === 'slump') { const dropT = opt.t0 + c.th * 1.0, dropped = t >= dropT; const k = dropped ? MO.easeOut((t - dropT) / 0.3) : 0;
      o = dropped ? { L: 'hang', R: 'hang', expr: 'dazed', seed: c.seed, blink: 0, headTilt: -8 } : { L: 'up', R: 'up', expr: 'smile_closed', seed: c.seed, blink: 0 }; roll = dropped ? (i % 2 ? 7 : -7) * k : sway; bobY = -0.05 * k; }
    else if (mode === 'dazed') { o = { L: i % 3 ? 'hang' : 'cheek', R: i % 3 ? 'hang' : 'cheek', expr: i % 4 ? 'dazed' : 'pained', seed: c.seed, blink: 0, headTilt: (i % 2 ? 6 : -6) }; roll = Math.sin(t * 1.5 + i) * 2; }
    else if (mode === 'panic') { const E = opt.E, ev = opt.ev, dir = Math.sign(c.x - E[0]) || 1, run = Math.min(14, Math.max(0, t - ev) * (5 + c.th * 3)); x = c.x + dir * run; z = c.z + (c.z > E[2] ? 1 : -1) * run * 0.25;
      o = { L: 'up', R: 'up', expr: 'shock', seed: c.seed, blink: 0, step: stepQ(t, 3.2, c.th) }; roll = dir * 6; bobY = Math.abs(Math.sin(t * 9 + i)) * 0.1; if (t < ev) o = { L: 'hang', R: 'hang', expr: 'dazed', seed: c.seed, blink: 0 }; }
    else if (mode === 'cheer') { o = { L: 'up', R: 'up', expr: i % 2 ? 'laugh' : 'grin', seed: c.seed, blink: 0 }; roll = Math.sin(t * 5 + i) * 4; bobY = Math.abs(Math.sin(t * 6 + i * 1.3)) * 0.18; }
    out.push(A(T, c.who, o, [x, 0, z], { roll, bobY }));
  });
  return out;
};
const heroPose = (f, t) => {
  if (t < 8.8) return { L: 'cross', R: 'cross', expr: 'smile_closed', seed: 3, blink: 0 };
  if (t < 11.0) return { L: 'up', R: 'cross', expr: 'smile', seed: 3, blink: 0 };
  if (t < 14.1) return { L: 'up', R: 'up', expr: 'smile_closed', seed: 3, blink: 0 };
  if (t < 19.0) return { L: 'hang', R: 'hang', expr: 'dazed', seed: 3, blink: 0 };
  return { L: 'hang', R: 'hang', expr: 'dazed', seed: 3, blink: 0, headTilt: -10 };
};
export const actorsAt = (f, T) => {
  const Sg = shotAt(f), t = f / 30; let out = [];
  const crowdMode = { montage: 'wish', push: 'wish', hands: 'wish', crackS: 'wish', slump: 'slump', live: 'dazed', close: 'cheer', poster: 'cheer' }[Sg.id];
  const hasHero = ['montage', 'push', 'hands', 'crackS', 'slump', 'live', 'ruins'].includes(Sg.id);
  if (Sg.id === 'tankS') out = crowdActors(f, T, 'panic', { E: [TANK.x, 0, TANK.z], ev: TANK.pop });
  else if (Sg.id === 'carS') out = crowdActors(f, T, 'panic', { E: [-5, 0, 0], ev: 29.4 });
  else if (Sg.id === 'gunS') out = crowdActors(f, T, 'panic', { E: [GUN.x, 0, GUN.z], ev: 31.5 });
  else if (Sg.id === 'robotS') out = crowdActors(f, T, 'panic', { E: [robotX(t), 0, ROB.z], ev: 33.8 });
  else if (Sg.id === 'giantS') out = crowdActors(f, T, 'panic', { E: [60, 0, -2], ev: 37.6 });
  else if (Sg.id === 'ruins') out = crowdActors(f, T, 'dazed');
  else if (Sg.id === 'slump') out = crowdActors(f, T, 'slump', { t0: 19.0 });
  else if (crowdMode) out = crowdActors(f, T, crowdMode);
  if (hasHero) out.push(A(T, 'hero', heroPose(f, t), HERO, { hi: true, roll: Math.sin(t * 2) * 1.5 }));
  if (Sg.id === 'hook') {
    CROWD.slice(0, 10).forEach((c, i) => out.push(A(T, c.who, { L: 'up', R: 'up', expr: 'smile_closed', seed: c.seed, blink: 0 }, [c.x - 2, 0, c.z - 8], { roll: Math.sin(t * 2 + i) * 3 })));
    out.push(A(T, 'hero', { L: 'cross', R: 'cross', expr: 'smile_closed', seed: 3, blink: 0 }, HERO, { hi: true, bobY: Math.sin(t * 2) * 0.01 })); }
  if (Sg.id === 'gunS') out.push(A(T, 'workB', { L: 'point', R: 'point', expr: 'laugh', seed: 60, blink: 0 }, [GUN.x - 1.8, 0, GUN.z + 0.3], { bobY: (f % 2) * 0.03 }));
  if (Sg.id === 'tankS' && t > 27.2) out.push(A(T, 'workA', { L: 'up', R: 'up', expr: 'shock', seed: 62, blink: 0 }, [TANK.x + 4.4, 0, TANK.z + 2], {}));
  if (Sg.id === 'giantS' || (Sg.id === 'ruins' && t < 42.2)) { const gx = Sg.id === 'giantS' ? lerp(80, 28, ramp(t, 36.8, 40.6)) : 28 - (t - 40.6) * 8, st = Math.abs(Math.sin(t * Math.PI / 0.75));
    out.push(A(T, 'civC', { L: 'hang', R: 'hang', expr: 'stern', seed: 71, blink: 0, step: stepQ(t, 1.33) }, [gx, 0, -2], { hi: true, s: 14, bobY: st * 1.1 })); }
  if (Sg.id === 'golden') { const kit = t >= 45.45; out.push(A(T, kit ? 'kitA' : 'hero', kit ? { L: 'up', R: 'up', expr: 'grin', seed: 3, blink: 0 } : { L: 'cross', R: 'cross', expr: t > 44.8 ? 'smile' : 'smile_closed', seed: 3, blink: 0 }, HERO, { hi: true, bobY: Math.sin(t * 8) * (kit ? 0.03 : 0.006) })); }
  if (Sg.id === 'fb1' || Sg.id === 'fbpov' || Sg.id === 'fb2') {
    const PL = [['kitB', -14, 6, 5, 3, 0.2], ['kitC', -6, -8, 4, 3, 1.4], ['kitB', 6, 4, 6, 4, 2.2], ['kitC', 10, -9, 5, 3, 0.7], ['kitB', -20, -2, 3, 5, 3.1], ['kitC', 16, 8, 3, 3, 1.9]];
    PL.forEach(([w, bx, bz, ax, az, ph], i) => { const x = PX + bx + ax * Math.sin(t * 0.8 + ph), z = bz + az * Math.cos(t * 0.6 + ph), dx = Math.cos(t * 0.8 + ph) * ax;
      out.push(A(T, w, { L: 'hang', R: 'hang', expr: i % 3 ? 'neutral' : 'laugh', seed: 80 + i, blink: 0, step: stepQ(t, 2.6, ph) }, [x, 0, z], { flip: dx < 0, bobY: Math.abs(Math.sin(t * 8 + ph)) * 0.05 })); });
    if (Sg.id !== 'fb2') out.push(A(T, 'keeper', { L: 'up', R: 'up', expr: 'neutral', seed: 90, blink: 0 }, [PX + 32.5, 0, 0.8 + Math.sin(t) * 1.2], { flip: true }));
    let bp;
    if (Sg.id === 'fb1') { const u = (t * 0.55) % 1, a = PL[0], b = PL[2]; const ax = PX + a[1] + a[3] * Math.sin(t * 0.8 + a[5]), bx = PX + b[1] + b[3] * Math.sin(t * 0.8 + b[5]); bp = [lerp(ax, bx, u), 0.3 + Math.abs(Math.sin(u * 3.14)) * 0.7, lerp(a[2], b[2], u) * 0.7]; }
    else if (Sg.id === 'fbpov') bp = [PX - 7.6, 0.35, 3.3]; else bp = ballFly(t);
    out.push({ key: 'ball', draw: (p) => { p.ell(300, 760, 62, 62, '#ffffff', 9); for (const [dx, dy] of [[0, 0], [38, -30], [-40, -24], [30, 34], [-34, 36]]) p.ell(300 + dx, 760 + dy, 15, 15, '#222', 0); }, x: bp[0], y: bp[1] - 0.35, z: bp[2], s: 0.42, roll: t * 9, blob: bp[1] < 1.5, shadow: false });
    if (Sg.id === 'fbpov') { const h = heroRun(t); out.push(A(T, 'kitA', { L: 'hang', R: 'hang', expr: t > 51.2 ? 'grin' : 'neutral', seed: 3, blink: 0, bow: 52, step: t < 52.6 ? stepQ(t, 3.4) : 0 }, h, { hi: t > 50.9, bobY: Math.abs(Math.sin(t * 10)) * 0.06 })); }
    if (Sg.id === 'fb2') { const pose = t < KICK ? { step: 0.0 } : t < KICK + 0.35 ? { step: 0.25 } : { step: 0 }; out.push(A(T, 'kitA', { L: 'up', R: 'hip', expr: t < KICK + 0.35 ? 'grin' : 'laugh', seed: 3, blink: 0, bow: 52, ...pose }, [PX - 8, 0, 3.4], { hi: true, bobY: Math.sin(t * 5) * 0.02 }));
      const kp = keeperPos(t); if (t < GOAL - 0.15) out.push(A(T, 'keeper', { L: 'up', R: 'up', expr: 'neutral', seed: 90, blink: 0 }, [PX + 32.2, 0, 0.6], { flip: true })); else out.push(A(T, 'keeper', { L: 'up', R: 'up', expr: 'shock', seed: 90, blink: 0 }, [kp[0], kp[1], kp[2]], { flip: true, roll: -80 * Math.min(1, (t - GOAL + 0.15) / 0.3), shadow: false })); }
  }
  if (Sg.id === 'close') out.push(A(T, 'kitA', { L: 'up', R: 'up', expr: 'laugh', seed: 3, blink: 0, bow: 52 }, HERO, { hi: true, bobY: Math.abs(Math.sin(t * 6)) * 0.12 }));
  if (Sg.id === 'poster') [[24, 1, 'civD'], [27.5, 3, 'civE'], [32, 2, 'workA'], [35.5, 0, 'civF']].forEach(([x, z, w]) => out.push(A(T, w, { L: 'up', R: 'up', expr: 'laugh', seed: 100 + x, blink: 0 }, [x, 0, z], { roll: Math.sin(t * 5 + x) * 5, bobY: Math.abs(Math.sin(t * 6 + x)) * 0.15 })));
  if (Sg.id === 'days') for (const [x, z] of [[-8, 4], [-3, 6], [4, 2]]) out.push(A(T, 'civE', { L: 'hang', R: 'hang', expr: 'neutral', seed: 110 + x, blink: 0, step: stepQ(t, 2.4, x) }, [x - t * 0.5, 0, z], {}));
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, ex = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...ex });
const rays = (p, t, col, r0 = 60, r1 = 260) => { const k = 0.4 + 0.6 * t; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + t * 0.6, w = 0.1; p.poly([[300 + Math.cos(a) * r0 * k, 500 + Math.sin(a) * r0 * k], [300 + Math.cos(a + w) * r1 * k, 500 + Math.sin(a + w) * r1 * k], [300 + Math.cos(a - w) * r1 * k, 500 + Math.sin(a - w) * r1 * k]], col, 6); } };
const blast = (p, t) => { p.g.save(); p.g.globalAlpha = Math.max(0, 1 - t * t); for (const [r, c] of [[300, '#c86a2a'], [220, '#ff9a2b'], [130, '#ffe46a'], [60, '#ffffff']]) p.ell(300, 500, r * (0.3 + 0.7 * t), r * (0.3 + 0.7 * t) * 0.9, c, 10); p.g.restore(); };
const smokeCard = (p, k) => { p.g.save(); p.g.globalAlpha = Math.max(0, 0.85 - k * 0.7); for (let i = 0; i < 6; i++) p.ell(300 + Math.sin(i * 2) * 60 * (0.4 + k), 800 - i * 85 * (0.5 + k), 85 + i * 14 + 40 * k, 75 + i * 12 + 30 * k, i % 2 ? '#4a4344' : '#5a5254', 8); p.g.restore(); };
const flame = (p, t) => { const w = 1 + Math.sin(t * 40) * 0.12; p.poly([[300, 960], [210, 800], [260, 700 - 40 * w], [300, 560 - 70 * w], [350, 700 - 30 * w], [400, 800]], '#ff8a2b', 8); p.poly([[300, 960], [250, 840], [300, 720 - 30 * w], [350, 840]], '#ffd23f', 0); };
const confetti = (p, t) => { const cols = ['#ff4d6d', '#ffd23f', '#4dd2ff', '#7cff6b', '#c77dff']; for (let i = 0; i < 34; i++) { const x = (i * 137) % 600, y = ((i * 211 + t * 700) % 1000); p.poly([[x, y], [x + 22, y + 6], [x + 14, y + 26], [x - 6, y + 18]], cols[i % 5], 3); } };
export const fxAt = (f, T) => {
  const Sg = shotAt(f), t = f / 30, out = [];
  const spark = (x, y, z, i) => out.push(FX('sp' + q((t * 1.1 + i * 0.37) % 1, 1), (p) => T.fxStars(p, (t * 1.1 + i * 0.37) % 1), [x, y, z], 0.9, { order: 6 }));
  if (['hook', 'montage', 'push', 'hands', 'crackS'].includes(Sg.id)) { spark(HERO[0], 1.4, HERO[2] + 0.2, 0); if (Sg.id !== 'hook') for (let i = 0; i < 6; i++) spark(CROWD[i * 3].x, 2.2, CROWD[i * 3].z, i + 1); }
  if (t >= TANK.pop && t < TANK.pop + 1.6) { const k = q((t - TANK.pop) / 1.6, 2); for (const [dx, dz] of [[-3, 0], [3, 1], [0, -3], [0, 3]]) out.push(FX('dust' + k + dx + dz, (p) => T.fxDust(p, k, '#cfc3b0'), [TANK.x + dx * 1.3, 0.5, TANK.z + dz * 1.3], 5, { tint: '#ddd2c0' })); }
  if (t >= TANK.fire && t < TANK.fire + 0.5) { const k = q((t - TANK.fire) / 0.5, 2); out.push(FX('blast' + k, (p) => blast(p, k), [TANK.x - 7.2, 3.0, TANK.z], 5, { order: 7 })); out.push(FX('dustB' + k, (p) => T.fxDust(p, k, '#cfc3b0'), [TANK.x - 6.5, 1, TANK.z], 6)); }
  if (Sg.id === 'carS') for (let i = 1; i <= 4; i++) { const p = carPos(t - i * 0.12), k = q(i / 5, 2); out.push(FX('ct' + k, (pp) => T.fxPuff(pp, k * 0.6), [p[0], p[1] - 0.3, p[2]], 3.5)); }
  if (t >= 33.0 && t < 44.0) { const k = q(((t - 33.0) * 0.2) % 1, 2); out.push(FX('gs' + k, (p) => smokeCard(p, k), [GUN.x + 3.8, 2.8, GUN.z], 2.2)); }
  if (t >= ROB.land && t < ROB.land + 1.8) { const k = q((t - ROB.land) / 1.8, 2); for (const dx of [-5, 0, 5]) out.push(FX('rd' + k + dx, (p) => T.fxDust(p, k, '#bfb5a4'), [TANK.x + dx, 0.8, TANK.z + 1], 7)); out.push(FX('rb' + k, (p) => blast(p, Math.min(1, k * 2.5)), [TANK.x, 3, TANK.z + 2], 6, { order: 7 })); }
  if (Sg.id === 'giantS') for (let i = 0; i < 4; i++) { const ts = 37.9 + i * 0.75; if (t >= ts && t < ts + 0.7) { const k = q((t - ts) / 0.7, 2), gx = lerp(80, 28, ramp(ts, 36.8, 40.6)); out.push(FX('gd' + k + i, (p) => T.fxDust(p, k, '#bfb5a4'), [gx - 3, 1, -2 + (i % 2 ? 2.5 : -2.5)], 10)); } }
  if ((t >= 33 && t < 46.6) || (t >= 57.2 && t < 65)) for (const [x, z, s] of [[-12, -10, 0], [-4, 12, 1], [16, -9, 2], [24, 9, 3], [-26, 6, 4]]) { const k = q(((t * 0.18 + s * 0.23) % 1), 2); out.push(FX('sc' + k + s, (p) => smokeCard(p, k), [x, 2, z], 6 + s)); if (t > 38) out.push(FX('fl' + q(t * 8 % 1, 1) + s, (p) => flame(p, t), [x, 0, z + 0.5], 1.4)); }
  if (Sg.id.startsWith('fb')) for (const [x, z, s] of [[-30, -18, 0], [34, 20, 1], [0, -26, 2]]) { const k = q(((t * 0.2 + s * 0.3) % 1), 2); out.push(FX('fs' + k + s, (p) => smokeCard(p, k), [PX + x, 2, z], 7)); }
  if (t >= CARHIT && t < 57.2) { const yy = Math.max(0.2, 9 - 7 * (t - CARHIT) * (t - CARHIT)); const k = q(((t - CARHIT) * 0.8) % 1, 2); out.push(FX('cs' + k, (pp) => smokeCard(pp, k), [PX + 14 + (t - CARHIT) * 2, yy, 2], 2.5));
    if (t < CARHIT + 0.5) out.push(FX('hit' + q(t - CARHIT, 2), (pp) => blast(pp, (t - CARHIT) / 0.5), [PX + 14, 9, 2], 2.5, { order: 7 })); }
  if (Sg.id === 'golden' && t >= 45.3 && t < 46.4) { const k = q((t - 45.3) / 1.1, 2); out.push(FX('gr' + k, (p) => rays(p, k, '#fff2a8'), [2, 1.2, 1.4], 6, { order: 8 })); }
  if (Sg.id === 'golden' && t > 44.4 && t < 45.4) spark(2, 1.5, 1.2, 3);
  if (Sg.id === 'poster' || Sg.id === 'close') for (const [x, z] of (Sg.id === 'poster' ? [[26, 3], [34, 3]] : [[-2, 4], [6, 4]])) { const k = q((t * 0.8) % 1, 2); out.push(FX('cf' + k + x, (p) => confetti(p, k), [x, 3.5, z], 3.4, { order: 6 })); }
  return out;
};
