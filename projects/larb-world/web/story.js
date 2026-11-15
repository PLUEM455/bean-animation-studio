// Shot plan for "ถ้าโลกนี้ลาบคือของมีค่า?!" — 150 s at 30 fps. Voice clips are placed at fixed starts (see audio.py VO table).
export const FPS = 30, TOTAL = 4500;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const sm = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const eo = (t) => 1 - Math.pow(1 - clamp(t), 3);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const blinkAt = (t, seed) => { const f = Math.floor(t * 30), per = 70 + (seed * 17) % 50, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const RX = 1000, SW = 0.18, FL = 0.9;
const HEADY = 1.46; // head centre above the soles for standing adults

// ---------- lights (one key direction per set) ----------
const LIGHTS = {
  city: { az: 210, el: 38, sky: '#4a5a96', ground: '#2a2234', hemi: 1.15, sun: '#a8baff', sunI: 1.2, fog: '#232a4c', fogNear: 30, fogFar: 230,
    skyTop: '#0a0f2c', skyHor: '#3e3466', stars: 0.6, sat: 1.15, vig: 0.3, shadowExt: 16 },
  morning: { az: 25, el: 16, sky: '#cfe0ff', ground: '#8a8262', hemi: 1.05, sun: '#ffdcb0', sunI: 2.6, fog: '#f2d8c0', fogNear: 60, fogFar: 900,
    skyTop: '#5b9be0', skyHor: '#ffd9b4', sunDisc: '#fff4d8', sunSize: 0.004, sat: 1.1, vig: 0.18, shadowExt: 18 },
  inside: { az: 70, el: 40, sky: '#6a5070', ground: '#3a2a26', hemi: 0.7, sun: '#9fb0ff', sunI: 0.35, fog: '#1a1626', fogNear: 30, fogFar: 300,
    skyTop: '#070a1e', skyHor: '#1f2244', stars: 0.8, sat: 0.98, vig: 0.38, shadowExt: 8, gain: '#e8e4f4' },
  ruralNight: { az: 120, el: 35, sky: '#3a4a86', ground: '#1e2430', hemi: 0.95, sun: '#a8b8ff', sunI: 1.0, fog: '#141a33', fogNear: 25, fogFar: 260,
    skyTop: '#05081a', skyHor: '#1e2550', stars: 1, sat: 1.1, vig: 0.36, shadowExt: 14 },
  rain: { az: 120, el: 40, sky: '#33415f', ground: '#161a24', hemi: 0.85, sun: '#9aa8d0', sunI: 0.7, fog: '#1a2030', fogNear: 10, fogFar: 120,
    skyTop: '#0c0f1c', skyHor: '#262c40', stars: 0, sat: 0.95, vig: 0.4, shadowExt: 12 },
};
const LAMP = (i = 9) => (i = i * 0.42,  { pos: [RX - 0.2, FL + 2.2, 0.6], col: '#ffc890', i, d: 12, decay: 1.2 });
const COALS = (i = 4) => ({ pos: [RX + 2.6, FL + 0.9, -1.8], col: '#ff6a2a', i, d: 6, decay: 1.4 });
const WINDOW_GLOW = { pos: [RX, 2.4, 3.6], col: '#ffb05a', i: 5, d: 9, decay: 1.3 };
const MARKET = (z = -6) => [{ pos: [8.4, 3.0, z + 3], col: '#ffb46a', i: 7, d: 14, decay: 1.2 }, { pos: [8.4, 3.0, z - 6], col: '#ff9a6a', i: 6, d: 14, decay: 1.2 }, { pos: [-2, 4, z - 4], col: '#ff4fa3', i: 4, d: 14, decay: 1.3 }];

// ---------- cards ----------
const A = (who, o, pos, extra = {}) => ({ key: (typeof who === 'string' ? who : 'x' + who.seed) + JSON.stringify(o), draw: (p) => T_.person(p, who, o), x: pos[0], y: pos[1], z: pos[2], ground: pos[1], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
let T_ = null;
const EX = (v) => T_.extra(v);
const smoke = (t, seed) => (p) => { const g = p.g; g.save(); for (let i = 0; i < 6; i++) { const k = (t * 0.35 + i / 6 + seed * 0.13) % 1; g.globalAlpha = 0.55 * Math.sin(k * Math.PI);
  p.ell(300 + Math.sin(k * 7 + i) * 60 * k, 900 - k * 760, 60 + 140 * k, 50 + 110 * k, '#e9e4dc', 0); } g.restore(); };
const bigSmoke = (k) => (p) => { const g = p.g; g.save(); g.globalAlpha = 0.9; for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 60 + 230 * k; p.ell(300 + Math.cos(a) * r * 0.8, 600 - Math.sin(a * 1.3) * r * 0.9 - k * 120, 90 + 120 * k, 80 + 100 * k, i % 2 ? '#d9d4cc' : '#bdb6ad', 8); } g.restore(); };
const steam = (t) => (p) => { const g = p.g; g.save(); g.globalAlpha = 0.7; for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1, pts = []; for (let j = 0; j < 10; j++) pts.push([300 + (i - 1) * 50 + Math.sin(j * 0.8 + t * 4 + i) * 22, 900 - j * 60 - k * 80]); g.globalAlpha = 0.6 * (1 - k); p.stroke(pts, 14, '#ffffff'); } g.restore(); };
const sniff = (t) => (p) => { for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; p.arc(300 - k * 120, 500, 40 + k * 30, 70 + k * 30, -50, 50, 9); } };
const propCard = (k, o = {}) => (p) => T_.drawProp(p, k, 300, 800, 6, o);
const leaf = (p) => { p.poly([[300, 120], [480, 380], [460, 760], [300, 960], [140, 760], [120, 380]], '#3f8a3a', 14); p.stroke([[300, 140], [300, 950]], 10, '#2a5a26'); for (let i = 0; i < 6; i++) { p.stroke([[300, 260 + i * 110], [430, 200 + i * 110]], 5, '#2a5a26'); p.stroke([[300, 260 + i * 110], [170, 200 + i * 110]], 5, '#2a5a26'); } };
const pageCard = (p) => { p.poly([[160, 380], [440, 360], [460, 800], [150, 820]], '#efe2c4', 10); for (let i = 0; i < 6; i++) p.stroke([[190, 440 + i * 55], [410, 430 + i * 55]], 5, '#8a7a5a'); p.poly([[440, 360], [470, 420], [450, 480], [478, 560], [455, 640], [470, 720], [460, 800]], null, 0); };
const burst = (t, col = '#ffffff') => (p) => T_.fxBurst(p, t, col, 12, 40, 260);
const hands = (k) => (p) => { // two hands holding the page edge (insert)
  for (const s of [-1, 1]) { p.stroke([[300 + s * 300, 1000], [300 + s * 150, 700]], 70, '#241726'); p.stroke([[300 + s * 300, 1000], [300 + s * 150, 700]], 50, '#2f63b0');
    p.ell(300 + s * 140, 680 - (s > 0 ? k * 40 : 0), 44, 38, '#e2ae80', 9); p.dot(300 + s * 128, 690, 5, '#8a5a32'); } };
const cat = (sn, bl) => (p) => T_.cat(p, sn, bl);
const stack = (n, sway) => (p) => T_.bowlStack(p, n, sway);

// ---------- captions (bottom; *word* = yellow) ----------
const CAPS = [
  [0.30, 1.60, 'ในโลกนี้'], [1.76, 3.70, '*ลาบ*ใช้จ่ายได้|ทุกอย่าง'],
  [5.00, 7.00, 'ป้าแม่ค้า|ขอทอนเป็น*ชาม*'], [7.00, 8.60, 'ไม่มีใคร|รู้ว่าทำไม'], [8.93, 11.50, 'ชามใหญ่ ชามเล็ก|ราคาเท่ากัน'], [11.59, 13.20, 'แล้วแต่|*อารมณ์ป้า*'],
  [14.80, 16.50, 'โต้งเก็บชาม|ไว้ทั้งกล่อง'], [16.50, 18.55, 'บอกว่านี่คือ|*เงินออม*ของเขา'], [18.67, 20.55, 'ทุกเช้า|เปิดนับ'], [20.68, 22.20, 'แล้ว*ดม*|ทีละใบ'],
  [26.40, 27.55, 'วันหนึ่ง'], [27.68, 29.90, 'เขาเจอชายแก่|ริมทางชานเมือง'], [30.15, 31.70, 'ขาย|*สมุดสูตรลาบ*'],
  [37.00, 38.90, 'ข้อเสนอคือ'], [39.02, 40.40, 'สมุดเล่มนี้'], [40.48, 42.60, 'แลกกับ|*ลาบชามเดียว*'], [43.17, 44.60, 'เขาคิดเลข|อยู่นาน'],
  [48.50, 49.85, 'สุดท้าย'], [49.97, 51.40, 'เขาก็*ตัดสินใจ*'], [51.58, 53.00, 'และศึกษา|ทุกคืน'], [53.06, 54.40, 'ในบ้านหลังทุ่ง'],
  [61.00, 63.30, 'ชามแรก|*เค็มเกินไป*'], [63.40, 65.85, 'โต้งแอบมาชิม'], [66.02, 68.50, 'และเขาไม่บอก|*ใครเลยสักคำ*'],
  [75.00, 77.60, 'ทำมากขึ้น|ชามเยอะขึ้น'], [77.75, 79.90, 'ค่าของแต่ละชาม|ก็*ลดลง*'], [79.99, 82.20, 'นี่แหละ|*เงินเฟ้อ*'],
  [89.50, 91.20, 'ทั้งหมู่บ้าน|เรียกเขาว่า'], [91.30, 93.30, 'คนที่*ลาบที่สุด*|ในโลก'], [93.42, 95.90, 'ถามทีไร|เขาก็ตอบแค่ว่า'], [96.11, 97.40, '*ไม่รู้*'],
  [103.5, 105.2, 'แต่ก็มีคน|เอาเงินไปซื้อ'], [105.2, 107.0, 'ชาม*เก็งกำไร*'], [107.19, 108.80, 'เพราะ|*กลัวตกรถ*'],
  [117.69, 118.90, 'และคืนหนึ่ง'], [119.12, 121.30, 'มีคนยืนดู|อยู่นอกหน้าต่าง'], [121.48, 123.00, '*จดทุกขั้นตอน*'],
  [134.00, 135.50, 'เขาไม่รู้เลยว่า'], [135.65, 136.85, '*ความลับ*เล่มนั้น'], [136.93, 138.80, 'กำลังจะไป|อยู่ที่ใคร'],
];
const YEL = '#ffd42a';
const richLine = (g, line, x, y, size) => { // centred line with *yellow* spans, thick ink stroke
  const parts = line.split('*'); g.font = `${size}px LomaB`;
  const widths = parts.map((s) => g.measureText(s).width), total = widths.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  g.lineJoin = 'round'; g.textBaseline = 'middle'; g.textAlign = 'left';
  parts.forEach((s, i) => { g.lineWidth = size * 0.2; g.strokeStyle = '#140c18'; g.strokeText(s, cx, y); g.fillStyle = i % 2 ? YEL : '#ffffff'; g.fillText(s, cx, y); cx += widths[i]; });
};
const drawCaption = (g, t, yBase) => {
  const c = CAPS.find(([a, b]) => t >= a && t < b); if (!c) return;
  const k = eo((t - c[0]) / 0.12), lines = c[2].split('|'), size = 96;
  g.save(); g.globalAlpha = k; g.translate(540, yBase); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  lines.forEach((l, i) => richLine(g, l, 0, (i - (lines.length - 1) / 2) * size * 1.22, size));
  g.restore();
};
const bubble = (g, ctx, pos, text, t0, t, opts = {}) => {
  if (t < t0 || (opts.t1 && t > opts.t1)) return; const [sx, sy, vis] = ctx.toScreen(pos); if (!vis) return;
  const k = T_back(clamp((t - t0) / 0.18)), size = opts.size || 70; g.save(); g.font = `${size}px LomaB`;
  const w = g.measureText(text).width + size * 0.9, h = size * 1.5, x = clamp(sx + (opts.dx ?? 0), w / 2 + 30, 1080 - w / 2 - 30), y = clamp(sy + (opts.dy ?? -220), 160 + h / 2, 1300);
  g.translate(x, y); g.scale(k, k);
  g.fillStyle = '#ffffff'; g.strokeStyle = '#140c18'; g.lineWidth = 9;
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h * 0.45); g.moveTo(-18, h / 2 - 2); g.lineTo(clamp(sx - x, -w / 3, w / 3), h / 2 + 46); g.lineTo(22, h / 2 - 2); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(-16, h / 2 - 12, 36, 12);
  g.fillStyle = opts.col || '#140c18'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 4); g.restore();
};
const T_back = (t, s = 1.7) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const bigText = (g, lines, y, size, k = 1) => { g.save(); g.globalAlpha = clamp(k * 3); g.translate(540, y); const s = T_back(k); g.scale(s, s); lines.forEach((l, i) => richLine(g, l, 0, i * size * 1.2, size)); g.restore(); };
const rain = (g, t, a = 1) => { g.save(); g.strokeStyle = 'rgba(200,215,255,0.35)'; g.lineWidth = 3; for (let i = 0; i < 160; i++) { const x = (i * 97.3 + t * 900 * 0.3) % 1180 - 50, y = (i * 211.7 + t * 2600) % 2100 - 100; g.globalAlpha = a * (0.3 + (i % 5) * 0.12); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 14, y + 70); g.stroke(); } g.restore(); };
const counter = (g, n, unit, k) => { g.save(); g.translate(540, 360); const s = T_back(clamp(k / 0.25)); g.scale(s, s); richLine(g, `*${n}*`, 0, 0, 260); richLine(g, unit, 0, 190, 100); g.restore(); };
const chart = (g, t, crash) => { // price-of-a-bowl chart panel, top of frame
  g.save(); g.translate(90, 210); g.fillStyle = 'rgba(16,12,24,0.82)'; g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.beginPath(); g.roundRect(0, 0, 900, 470, 30); g.fill(); g.stroke();
  g.font = '60px LomaB'; g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('ราคาชาม', 40, 60);
  const N = 40, pts = []; for (let i = 0; i <= N; i++) { const x = i / N; let y = 0.15 + 0.6 * Math.pow(x, 1.6) + 0.04 * Math.sin(i * 1.9); if (crash) y = x < 0.55 ? 0.15 + 0.7 * Math.pow(x / 0.55, 1.5) + 0.03 * Math.sin(i * 2.3) : 0.85 - 0.8 * eo((x - 0.55) / 0.2) + 0.02 * Math.sin(i * 3); pts.push([60 + x * 780, 420 - y * 300]); }
  const shown = Math.floor(clamp(t) * N); g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = crash && shown > N * 0.56 ? '#ff4a4a' : '#4ae07a';
  g.beginPath(); pts.slice(0, shown + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  const [lx, ly] = pts[Math.min(shown, N)]; g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(lx, ly, 16, 0, 7); g.fill();
  g.font = '90px LomaB'; g.textAlign = 'right'; g.fillText(crash && shown > N * 0.56 ? '▼' : '▲', 860, 70); g.restore();
};
const tag = (g, k, t) => { g.save(); g.translate(540, 330); g.rotate(-0.05 + 0.02 * Math.sin(t * 3)); const s = T_back(clamp(k / 0.3)); g.scale(s, s);
  g.fillStyle = '#f4ead2'; g.strokeStyle = '#140c18'; g.lineWidth = 8; g.beginPath(); g.roundRect(-330, -150, 660, 300, 24); g.fill(); g.stroke();
  g.fillStyle = '#140c18'; g.font = '74px LomaB'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ข้าวสาร 1 ถุง', 0, -70);
  g.font = '96px LomaB'; g.fillStyle = '#7a6a60'; g.fillText('2 ชาม', -150, 50); g.strokeStyle = '#d02a2a'; g.lineWidth = 12; g.beginPath(); g.moveTo(-270, 50); g.lineTo(-30, 50); g.stroke();
  if (k > 0.5) { g.fillStyle = '#d02a2a'; g.font = '110px LomaB'; g.fillText('20 ชาม', 160, 50); } g.restore(); };

// ---------- camera helper ----------
const camK = (K, t) => { if (t <= K[0].t) return { ...K[0] }; const L = K[K.length - 1]; if (t >= L.t) return { ...L };
  const i = K.findIndex((k, j) => t >= k.t && t <= K[j + 1].t), a = K[i], b = K[i + 1], e = (b.ease === 'out' ? eo : b.ease === 'lin' ? (x) => x : sm)((t - a.t) / (b.t - a.t));
  return { pos: lerp3(a.pos, b.pos, e), look: lerp3(a.look, b.look, e), fov: lerp(a.fov, b.fov, e), roll: lerp(a.roll || 0, b.roll || 0, e) }; };
const shake = (c, t, t0, amp = 0.04, dur = 0.3) => { const d = t - t0; if (d < 0 || d > dur) return c; const s = amp * (1 - d / dur) * Math.sin(d * 90); c.look = [c.look[0] + s, c.look[1] + s * 0.7, c.look[2]]; c.roll = (c.roll || 0) + s * 25; return c; };
const handheld = (c, t, a = 0.012) => { c.look = [c.look[0] + a * Math.sin(t * 1.7), c.look[1] + a * Math.sin(t * 2.3 + 1), c.look[2] + a * Math.sin(t * 1.1)]; return c; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------- positions ----------
const AUNT = [7.25, SW, -6.1], CUST = [5.0, SW, -5.6];
const HOUSE = (x, z) => [RX + x, FL, z];
const OLD = [RX + 14, 0, 15.6];

// ---------- shots ----------
// each: a, b (s), area, light, cam(t)->{pos,look,fov,roll}, world(t), actors(t), over(g,ctx,t), dof(t,cam)
const S = [];
const shot = (o) => S.push(o);

// 1 HOOK: push in down the night street, billboard "house = 1 bowl"
shot({ a: 0, b: 2.4, area: 'city', light: 'city', points: () => [{ pos: [-3, 5, -24], col: '#ff4fa3', i: 6, d: 20 }, { pos: [6, 4, -10], col: '#ffb46a', i: 6, d: 20 }],
  cam: (t) => camK([{ t: 0, pos: [0.6, 5.5, 26], look: [-3.5, 9.5, -30], fov: 50 }, { t: 2.4, pos: [-0.8, 7.6, 2], look: [-6.0, 12.6, -30], fov: 40, ease: 'out' }], t),
  actors: (t) => [A(EX(1), { expr: 'neutral', step: q((t * 1.6) % 1), blink: blinkAt(t, 3) }, [-5, SW, -6 + t * 1.2]), A(EX(2), { expr: 'smile', step: q((t * 1.6 + 0.5) % 1) }, [-5.6, SW, -14 + t * 1.1]),
    A(EX(3), { expr: 'grin', L: 'hold', R: 'hold', prop: 'bowl' }, [5.2, SW, -2])],
  over: (g, c, t) => { bigText(g, ['ลาบจานเดียว'], 300, 128, clamp(t / 0.35)); bigText(g, ['*ซื้อบ้าน*ได้ไหม?'], 460, 128, clamp((t - 0.25) / 0.35)); },
});
// 2 TAXI: passenger pays with a bowl, driver sniffs, approves
shot({ a: 2.4, b: 5.0, area: 'city', light: 'city', points: () => [{ pos: [4.5, 3.5, -5], col: '#ffb46a', i: 7, d: 12 }, { pos: [0, 3, -12], col: '#3fe0d0', i: 4, d: 12 }],
  cam: (t) => handheld(camK([{ t: 2.4, pos: [5.6, 1.5, -4.2], look: [3.3, 1.4, -8.3], fov: 40 }, { t: 5.0, pos: [5.4, 1.5, -4.7], look: [3.3, 1.4, -8.3], fov: 37 }], t), t),
  actors: (t) => { const lt = t - 2.4, open = lt > 1.0; return [
    A('driver', { expr: lt < 1.0 ? 'neutral' : lt < 1.7 ? 'whistle' : 'proud', L: 'hold', R: lt > 1.8 ? 'count' : 'hold', count: 1, prop: lt > 0.5 ? 'bowl' : null, propOpts: { open }, blink: blinkAt(t, 41), headTilt: lt > 1.0 && lt < 1.7 ? -8 : 0 }, [3.0, 0, -8.8]),
    A(EX(4), { expr: lt < 1.8 ? 'nervous' : 'grin', L: lt < 0.6 ? 'reach' : 'hang', R: 'hang', facing: -1, look: -0.6 }, [4.5, 0, -6.9])]; },
  fx: (t) => { const lt = t - 2.4; return lt > 1.0 && lt < 1.8 ? [FX('sn' + q(lt, 1), sniff(lt), [2.8, 1.28, -8.6], 0.35)] : []; },
  dof: (t, C) => ({ focus: dist(C.pos, [3.2, 1.4, -8.4]), cinf: 7 }),
});
// 3 STALL WIDE
shot({ a: 5.0, b: 7.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => camK([{ t: 5.0, pos: [1.2, 2.3, -1.2], look: [6.6, 1.4, -6.5], fov: 44 }, { t: 7.0, pos: [1.6, 2.1, -3.0], look: [6.6, 1.4, -6.3], fov: 42 }], t),
  actors: (t) => [A('auntie', { expr: 'grumpy', L: 'hip', R: 'hip', blink: blinkAt(t, 14) }, AUNT), A(EX(5), { expr: 'smile', R: 'point', L: 'hang', facing: 1, look: 0.6 }, CUST),
    A(EX(6), { step: q((t * 1.5) % 1) }, [4.6, SW, -12 + (t - 5) * 1.2]), A(EX(7), {}, [5.0, SW, 0.5])],
  over: (g, c, t) => bubble(g, c, [CUST[0], 2.0, CUST[2]], 'ข้าวสาร 1 ถุง', 5.4, t, { dy: -260 }),
});
// 4 AUNTIE CU haggling
shot({ a: 7.0, b: 9.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => camK([{ t: 7.0, pos: [5.0, 1.8, -5.3], look: [7.25, 1.62, -6.1], fov: 34, roll: 3 }, { t: 9.0, pos: [5.35, 1.78, -5.45], look: [7.25, 1.62, -6.1], fov: 31, roll: 4 }], t),
  actors: (t) => [A('auntie', { expr: t < 8 ? 'grumpy' : 'sly', L: 'hip', R: 'count', count: t < 8 ? 2 : 3, headTilt: q(4 * Math.sin(t * 7), 0), blink: blinkAt(t, 14) }, AUNT)],
  over: (g, c, t) => { bubble(g, c, [AUNT[0], 2.0, AUNT[2]], t < 8 ? 'สองชาม!' : 'สามชาม!', 7.2, t, { dy: -330 }); },
  dof: (t, C) => ({ focus: dist(C.pos, AUNT) , cinf: 9 }),
});
// 5 INSERT: the change slides in, three bowls of three sizes
shot({ a: 9.0, b: 11.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => camK([{ t: 9.0, pos: [4.0, 2.5, -4.3], look: [6.05, 1.12, -6.25], fov: 36, roll: -6 }, { t: 11.0, pos: [4.2, 2.35, -4.5], look: [6.05, 1.12, -6.25], fov: 33, roll: -2 }], t),
  world: (t) => ({ change: (t - 9.1) / 0.9 }),
  actors: () => [],
  dof: (t, C) => ({ focus: dist(C.pos, [6.15, 1.12, -6.0]), cinf: 4 }),
});
// 6 BITE TEST: auntie bites the bowl lid like a gold coin
shot({ a: 11.0, b: 14.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => shake(camK([{ t: 11, pos: [5.6, 1.75, -4.8], look: [7.2, 1.6, -6.0], fov: 36, roll: -5 }, { t: 14, pos: [5.85, 1.72, -5.15], look: [7.2, 1.62, -6.0], fov: 32, roll: -7 }], t), t, 12.0, 0.05, 0.4),
  world: () => ({ change: 2 }),
  actors: (t) => [A('auntie', { expr: t < 11.9 ? 'sly' : t < 12.7 ? 'yuck' : 'proud', L: 'hip', R: 'mouth', prop: 'bowl', propHand: 1, headTilt: t > 11.9 && t < 12.7 ? -6 : 0, blink: blinkAt(t, 14) }, AUNT),
    A(EX(5), { expr: t < 12 ? 'neutral' : 'shock', facing: 1, look: 0.5 }, [5.9, SW, -7.4])],
  fx: (t) => t > 11.9 && t < 12.5 ? [FX('b' + q((t - 11.9) / 0.6, 1), burst(q((t - 11.9) / 0.6, 1)), [6.95, 1.0, -5.95], 0.6)] : [],
  over: (g, c, t) => { if (t > 11.95 && t < 12.9) bigText(g, ['*กร๊อบ!*'], 330, 140, clamp((t - 11.95) / 0.3)); },
});
// 7 TONG WALKS (slow pan along the market) — savings box
shot({ a: 14.0, b: 20.0, area: 'city', light: 'city', points: (t) => MARKET(lerp(-2, -12, ramp(t, 14, 20))),
  cam: (t) => { const z = lerp(1.0, -9.6, sm(ramp(t, 14, 20))); return { pos: [1.9, 1.75, z + 1.2], look: [5.4, 1.45, z - 0.6], fov: 42 }; },
  actors: (t) => { const z = lerp(1.0, -9.8, ramp(t, 14, 19.6)), walking = t < 19.6; return [
    A('tong', { expr: 'proud', L: 'hold', R: 'hold', prop: 'box', step: walking ? q((t * 1.6) % 1) : 0, blink: blinkAt(t, 9), tilt: walking ? q(2 * Math.sin(t * 10), 0) : 0 }, [4.9, SW, z]),
    A(EX(8), { expr: 'shock', facing: -1, look: -0.6 }, [5.6, SW, -3.4]), A(EX(9), { expr: 'nervous', look: -0.6 }, [5.7, SW, -8.6]), A(EX(10), { expr: 'neutral' }, [7.25, SW, -14.0]),
    A('auntie', { expr: 'grumpy', L: 'hip', R: 'hip' }, AUNT)]; },
});
// 8 TONG SNIFFS + CAT
shot({ a: 20.0, b: 26.0, area: 'city', light: 'city', points: () => MARKET(-12),
  cam: (t) => camK([{ t: 20, pos: [2.4, 1.4, -9.4], look: [4.75, 0.98, -9.9], fov: 46 }, { t: 26, pos: [2.8, 1.38, -9.5], look: [4.75, 1.02, -9.9], fov: 42 }], t),
  actors: (t) => { const sniffing = t < 23.3, catIn = clamp((t - 21.6) / 1.2), grab = t > 23.6; const out = [
    A('tong', { expr: sniffing ? (Math.floor(t * 3) % 2 ? 'smile_closed' : 'whistle') : grab ? 'shock' : 'proud', L: grab ? 'hug' : 'hip', R: grab ? 'hug' : 'hold', prop: grab ? 'box' : 'bowl', propHand: grab ? 0 : 1, blink: blinkAt(t, 9), tilt: grab ? -6 : 0, headTilt: sniffing ? 8 : 0 }, [4.95, SW, -10.0])];
    if (!grab) out.push(FX('boxg', propCard('box'), [4.6, SW + 0.0, -9.6], 0.35, { order: 3 }));
    if (catIn > 0) out.push(FX('cat' + (t > 22.7 ? 1 : 0) + blinkAt(t, 2), cat(t > 22.7 && t < 23.7 ? 1 : 0, blinkAt(t, 2)), [lerp(4.25, 4.5, eo(catIn)), SW, lerp(-8.7, -9.85, eo(catIn))], 0.85, { order: 4, flip: true }));
    return out; },
  fx: (t) => t > 23.6 && t < 24.4 ? [FX('bst' + q((t - 23.6) / 0.8, 1), burst(q((t - 23.6) / 0.8, 1), '#ffe9a0'), [4.95, 1.0, -10.0], 0.9)] : [],
  dof: (t, C) => ({ focus: dist(C.pos, [4.9, 1.3, -10]), cinf: 6 }),
});
// 9 FIELD WIDE (morning)
shot({ a: 26.0, b: 28.0, area: 'rural', light: 'morning',
  cam: (t) => camK([{ t: 26, pos: [RX + 24, 5.5, 33], look: [RX + 12, 1.0, 16], fov: 42 }, { t: 28, pos: [RX + 22.5, 4.6, 31], look: [RX + 12, 1.0, 16], fov: 40 }], t),
  actors: (t) => [A('hero', { expr: 'neutral', step: q((t * 1.4) % 1) }, [RX + 6 + (t - 26) * 1.2, 0, 17.6]), A('old', { expr: 'neutral', sit: true, L: 'knee', R: 'knee' }, OLD)],
});
// 10 OLD MAN ECU eyes
shot({ a: 28.0, b: 30.0, area: 'rural', light: 'morning',
  cam: (t) => camK([{ t: 28, pos: [RX + 14.15, 1.0, 17.3], look: [RX + 14, 0.9, 15.6], fov: 30 }, { t: 30, pos: [RX + 14.15, 0.98, 17.0], look: [RX + 14, 0.9, 15.6], fov: 28 }], t),
  actors: (t) => [A('old', { expr: t < 29 ? 'neutral' : 'sly', sit: true, L: 'knee', R: 'knee', look: t < 29 ? 0 : 0.8, blink: blinkAt(t, 21), headTilt: q(2 * Math.sin(t * 2), 1) }, OLD)],
});
// 11 BOOK INSERT on the sack
shot({ a: 30.0, b: 33.0, area: 'rural', light: 'morning',
  cam: (t) => camK([{ t: 30, pos: [RX + 15.0, 0.75, 16.4], look: [RX + 14.6, 0.08, 15.95], fov: 40 }, { t: 33, pos: [RX + 14.75, 0.6, 16.35], look: [RX + 14.6, 0.08, 15.95], fov: 34 }], t),
  actors: (t) => [A('old', { expr: 'neutral', sit: true, L: 'knee', R: 'knee' }, OLD)],
  dof: (t, C) => ({ focus: dist(C.pos, [RX + 14.6, 0.08, 15.95]), cinf: 10 }),
});
// 12 SIGN "ไม่รับทอน" — hero offers a bowl, old man raises a brow
shot({ a: 33.0, b: 36.0, area: 'rural', light: 'morning',
  cam: (t) => camK([{ t: 33, pos: [RX + 16.6, 1.25, 19.6], look: [RX + 14.3, 0.9, 15.8], fov: 40 }, { t: 36, pos: [RX + 16.2, 1.2, 19.1], look: [RX + 14.3, 0.9, 15.8], fov: 38 }], t),
  actors: (t) => [A('old', { expr: t < 34.4 ? 'neutral' : 'sly', sit: true, L: t < 34 ? 'knee' : 'point', R: 'knee', blink: blinkAt(t, 21), facing: 1 }, OLD),
    A('hero', { expr: t < 34.4 ? 'smile' : 'nervous', L: 'hold', R: 'hold', prop: 'bowl', blink: blinkAt(t, 5), facing: -1, look: -0.5 }, [RX + 15.6, 0, 16.6]),
    FX('sign', (p) => { p.poly([[110, 560], [490, 540], [500, 800], [100, 820]], '#c8a06a', 12); p.g.font = '110px LomaB'; p.g.textAlign = 'center'; p.g.fillStyle = '#241726'; p.g.fillText('ไม่รับทอน', 300, 720); p.stroke([[300, 820], [300, 990]], 16, '#6a4a32'); }, [RX + 13.1, 0, 16.0], 0.75, { order: 3, shadow: true })],
});
// 13 THINKING (slow push-in, lamp, shadow on wall counts fingers then toes)
shot({ a: 36.0, b: 48.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9 + 0.6 * Math.sin(t * 7)), COALS(3)],
  cam: (t) => camK([{ t: 36, pos: [RX + 0.3, 2.2, 3.0], look: [RX + 0.1, 2.1, -1.2], fov: 46 }, { t: 48, pos: [RX + 0.05, 2.35, 1.3], look: [RX - 0.12, 2.3, -0.15], fov: 40 }], t),
  world: (t) => ({ book: { open: 0 }, tableBowl: true }),
  actors: (t) => { const n = Math.min(5, 1 + Math.floor((t - 37) / 1.2)), toes = t > 43.5; return [
    A('hero', { expr: 'think', L: 'think', R: t > 38 ? 'count' : 'hang', count: n, blink: blinkAt(t, 5), headTilt: q(3 * Math.sin(t * 0.8), 1) }, [RX - 0.2, FL, -0.15]),
    A('hero', { expr: 'think', L: toes ? 'knee' : 'count', R: 'count', count: toes ? 5 : n, step: toes ? 0.25 : 0 }, [RX + 0.4, FL, -2.88], { yawAbs: 0, tint: '#000000', alpha: 0.42, s: 1.35, shadow: false, ground: undefined, order: 1, key: 'shadow' + n + toes })]; },
  over: (g, c, t) => { const n = Math.min(5, 1 + Math.floor((t - 37) / 1.2)); if (t > 37 && t < 43.5) { const [x, y] = c.toScreen([RX + 1.0, FL + 2.3, -2.85]); g.save(); g.font = '120px LomaB'; g.fillStyle = 'rgba(255,230,180,0.85)'; g.textAlign = 'center'; g.fillText(String(n), x, y); g.restore(); }
    if (t > 43.5) { const [x, y] = c.toScreen([RX + 0.8, FL + 0.6, -2.85]); g.save(); g.font = '100px LomaB'; g.fillStyle = 'rgba(255,230,180,0.85)'; g.textAlign = 'center'; g.fillText(String(5 + Math.min(5, 1 + Math.floor((t - 43.5) / 0.6))), x, y); g.restore(); } },
  dof: (t, C) => ({ focus: dist(C.pos, [RX - 0.2, 2.3, -0.15]), cinf: 6 }),
});
// 14 BOOK OPENS (hands, close-up)
shot({ a: 48.0, b: 50.0, area: 'rural', light: 'inside', points: (t) => [LAMP(10), COALS(3)],
  cam: (t) => camK([{ t: 48, pos: [RX - 0.42, 2.85, 1.35], look: [RX - 0.42, 1.66, 0.64], fov: 36, roll: 0 }, { t: 50, pos: [RX - 0.42, 2.7, 1.25], look: [RX - 0.42, 1.66, 0.64], fov: 33 }], t),
  world: (t) => ({ book: { open: eo((t - 48.3) / 1.0) } }),
  actors: () => [],
  dof: (t, C) => ({ focus: dist(C.pos, [RX - 0.47, 1.66, 0.62]), cinf: 8 }),
});
// 15 TONG AT THE WINDOW "ทำอะไรตอนดึก?"
shot({ a: 50.0, b: 53.0, area: 'rural', light: 'inside', points: (t) => [LAMP(10), COALS(3)],
  cam: (t) => camK([{ t: 50, pos: [RX - 0.4, 2.3, -0.4], look: [RX + 0.05, 2.45, 3.0], fov: 40 }, { t: 53, pos: [RX - 0.35, 2.3, 0.0], look: [RX + 0.05, 2.45, 3.0], fov: 38 }], t),
  world: () => ({ book: { open: 1 } }),
  actors: (t) => [A('tong', { expr: 'sly', look: 0.3, blink: blinkAt(t, 9), L: 'hang', R: 'hang' }, [RX + 0.1, lerp(0.2, 0.92, T_back(clamp((t - 50.25) / 0.35))), 3.45], { ground: undefined })],
  over: (g, c, t) => bubble(g, c, [RX + 0.1, 2.6, 3.45], 'ทำอะไรตอนดึก?', 50.9, t, { dy: -360 }),
});
// 16 "นอนไม่หลับ" with smoke billowing behind
shot({ a: 53.0, b: 56.0, area: 'rural', light: 'inside', points: (t) => [LAMP(10), COALS(5)],
  cam: (t) => camK([{ t: 53, pos: [RX + 0.6, 2.4, 3.3], look: [RX + 1.6, 2.2, -0.6], fov: 34 }, { t: 56, pos: [RX + 0.7, 2.38, 2.9], look: [RX + 1.6, 2.2, -0.6], fov: 32 }], t),
  actors: (t) => [A('hero', { expr: 'innocent', L: 'hang', R: 'wave', wv: q(t * 9, 1), blink: blinkAt(t, 5), headTilt: -4 }, [RX + 1.6, FL, -0.6]),
    FX('smk' + q(ramp(t, 53.3, 56), 2), bigSmoke(eo(ramp(t, 53.3, 56))), [RX + 2.4, FL + 0.6, -1.8], lerp(1.2, 2.2, ramp(t, 53, 56)), { order: 1, alpha: 0.95 })],
  over: (g, c, t) => bubble(g, c, [RX + 1.6, 2.5, -0.6], 'นอนไม่หลับ', 53.6, t, { dy: -360 }),
});
// 17 PAGES FLIP (fast insert)
shot({ a: 56.0, b: 60.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9 + 2 * Math.sin(t * 13)), COALS(3)],
  cam: (t) => camK([{ t: 56, pos: [RX - 0.3, 2.65, 1.2], look: [RX - 0.45, 1.66, 0.6], fov: 34, roll: -8 }, { t: 60, pos: [RX - 0.35, 2.5, 1.1], look: [RX - 0.45, 1.66, 0.6], fov: 31, roll: 6 }], t),
  world: (t) => ({ book: { open: 1, flip: ((t - 56) / 1.3) % 1 } }),
  actors: () => [],
  dof: (t, C) => ({ focus: dist(C.pos, [RX - 0.42, 1.66, 0.6]), cinf: 7 }),
});
// 18 KITCHEN: first bowl too salty, Tong tastes
shot({ a: 60.0, b: 67.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(5)],
  cam: (t) => camK([{ t: 60, pos: [RX - 1.3, 2.3, 2.6], look: [RX + 2.0, 1.85, -1.0], fov: 46 }, { t: 67, pos: [RX - 0.9, 2.25, 2.2], look: [RX + 2.0, 1.85, -1.0], fov: 42 }], t),
  actors: (t) => { const tongIn = clamp((t - 62.6) / 0.9), tasting = t > 63.8, yuck = t > 64.6; const out = [
    A('hero', { expr: t < 61.6 ? 'neutral' : t < 62.6 ? 'yuck' : 'nervous', L: 'hang', R: t < 62.6 ? 'mouth' : 'hip', prop: t < 62.6 ? 'spoon' : null, propHand: 1, blink: blinkAt(t, 5) }, [RX + 1.8, FL, -1.25])];
    if (tongIn > 0) out.push(A('tong', { expr: !tasting ? 'sly' : !yuck ? 'smile_closed' : 'yuck', L: 'hang', R: tasting ? 'mouth' : 'hang', prop: tasting ? 'spoon' : null, propHand: 1, tilt: yuck ? q(-10 + 4 * Math.sin(t * 30), 0) : 0, blink: blinkAt(t, 9), step: tongIn < 1 ? q((t * 2) % 1) : 0 }, [lerp(RX + 3.6, RX + 2.35, eo(tongIn)), FL, lerp(0.3, -0.8, eo(tongIn))]));
    out.push(FX('stm' + q(t % 3, 1), steam(t), [RX + 2.6, FL + 0.95, -1.95], 0.8, { order: 1 }));
    return out; },
  over: (g, c, t) => { if (t > 61.6 && t < 62.6) bigText(g, ['*เค็ม!*'], 300, 150, clamp((t - 61.6) / 0.3)); if (t > 64.6 && t < 66.5) bubble(g, c, [RX + 2.35, 2.5, -0.8], 'อ๊วก!', 64.6, t, { dy: -360 }); },
  fx: (t) => t > 64.6 && t < 65.4 ? [FX('by' + q((t - 64.6) / 0.8, 1), burst(q((t - 64.6) / 0.8, 1), '#c8f0ff'), [RX + 2.35, FL + 0.8, -0.8], 0.9)] : [],
});
// 19 KITCHEN: second bowl hidden behind the cabinet
shot({ a: 67.0, b: 74.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(4)],
  cam: (t) => camK([{ t: 67, pos: [RX - 1.0, 2.2, 3.2], look: [RX - 2.7, 1.75, 0.6], fov: 50 }, { t: 74, pos: [RX - 1.15, 2.15, 3.0], look: [RX - 2.7, 1.75, 0.6], fov: 47 }], t),
  actors: (t) => { const hide = t > 68.6, peek = t > 70.2; return [
    A('hero', { expr: hide && t < 71.4 ? 'nervous' : t > 71.4 ? 'innocent' : 'smile', L: hide ? 'hang' : 'hold', R: hide ? (t < 70 ? 'reach' : 'hip') : 'hold', prop: hide ? null : 'bowl', blink: blinkAt(t, 5), sweat: hide && t < 71.4 }, [lerp(RX - 2.0, RX - 2.95, ramp(t, 67.5, 68.6)), FL, 0.75]),
    A('tong', { expr: peek ? 'sly' : 'neutral', L: 'hip', R: peek ? 'point' : 'hang', look: -0.7, blink: blinkAt(t, 9), facing: -1, headTilt: peek ? 8 : 0 }, [RX - 2.9, FL, -1.0])]; },
  over: (g, c, t) => { if (t > 70.2) bubble(g, c, [RX - 2.9, 2.5, -1.0], 'อะไรอยู่หลังตู้?', 70.4, t, { dy: -330, t1: 72.6 }); if (t > 72.0) bubble(g, c, [RX - 2.95, 2.5, 0.75], 'ไม่มี', 72.3, t, { dy: -320 }); },
});
// 20 MONTAGE a: cooking fast "1"
shot({ a: 74.0, b: 76.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(6)],
  cam: (t) => camK([{ t: 74, pos: [RX + 1.0, 2.3, 0.9], look: [RX + 2.3, 1.85, -1.6], fov: 40, roll: 5 }, { t: 76, pos: [RX + 1.2, 2.25, 0.6], look: [RX + 2.3, 1.85, -1.6], fov: 36, roll: 8 }], t),
  actors: (t) => [A('hero', { expr: 'grin', L: Math.floor(t * 8) % 2 ? 'hold' : 'mouth', R: Math.floor(t * 8) % 2 ? 'mouth' : 'hold', prop: 'spoon', propHand: Math.floor(t * 8) % 2, blink: 0 }, [RX + 1.9, FL, -1.2]),
    FX('stmA' + q(t % 3, 1), steam(t), [RX + 2.6, FL + 0.95, -1.95], 0.9, { order: 1 })],
  over: (g, c, t) => counter(g, '1', 'ชาม', t - 74),
});
// 21 MONTAGE b: shelf 10
shot({ a: 76.0, b: 78.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(4)],
  cam: (t) => camK([{ t: 76, pos: [RX - 0.6, 2.0, 0.2], look: [RX - 2.1, 1.6, -2.7], fov: 44, roll: -6 }, { t: 78, pos: [RX - 0.9, 1.95, -0.2], look: [RX - 2.1, 1.6, -2.7], fov: 40 }], t),
  world: (t) => ({ shelf: Math.min(10, Math.floor((t - 76) * 12)) }),
  actors: () => [], over: (g, c, t) => counter(g, '10', 'ชาม', t - 76),
});
// 22 MONTAGE c: shelf 100 (pull back)
shot({ a: 78.0, b: 80.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(4)],
  cam: (t) => camK([{ t: 78, pos: [RX - 1.6, 1.9, -0.9], look: [RX - 2.1, 1.7, -2.7], fov: 40 }, { t: 80, pos: [RX - 0.4, 2.1, 1.3], look: [RX - 2.1, 1.7, -2.7], fov: 46, ease: 'out' }], t),
  world: (t) => ({ shelf: Math.min(104, 10 + Math.floor((t - 78) * 90)) }),
  actors: (t) => [A('hero', { expr: 'proud', L: 'hip', R: 'hip', blink: blinkAt(t, 5) }, [RX - 0.6, FL, -1.6])], over: (g, c, t) => counter(g, '100', 'ชาม', t - 78),
});
// 23 MONTAGE d: auntie's ear on the door (outside, night)
shot({ a: 80.0, b: 82.0, area: 'rural', light: 'ruralNight', points: () => [WINDOW_GLOW, { pos: [RX + 3, 2.2, 4.5], col: '#ffb05a', i: 3, d: 6 }],
  cam: (t) => camK([{ t: 80, pos: [RX + 5.0, 1.95, 6.0], look: [RX + 3.1, 1.95, 3.3], fov: 38 }, { t: 82, pos: [RX + 4.7, 1.95, 5.6], look: [RX + 3.1, 1.95, 3.3], fov: 35 }], t),
  actors: (t) => [A('auntie', { expr: 'sly', L: 'ear', R: 'hip', look: -0.8, facing: -1, headTilt: -10, blink: 0 }, [RX + 3.45, FL - 0.06, 3.4])],
  fx: (t) => [FX('sn2' + q(t % 1, 1), sniff(t), [RX + 3.2, FL + 1.45, 3.4], 0.3)],
  over: (g, c, t) => bubble(g, c, [RX + 3.45, 2.5, 3.4], 'ฟุดฟิด...', 80.4, t, { dy: -330 }),
});
// 24 MONTAGE e: rice now costs 20 bowls — pile lands
shot({ a: 82.0, b: 85.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => shake(camK([{ t: 82, pos: [2.9, 2.2, -2.4], look: [6.2, 1.3, -6.0], fov: 40 }, { t: 85, pos: [3.2, 2.15, -2.8], look: [6.2, 1.3, -6.0], fov: 37 }], t), t, 83.0, 0.05, 0.4),
  world: (t) => ({ pile: ramp(t, 82.4, 83.2), crate: false }),
  actors: (t) => [A('auntie', { expr: 'grumpy', L: 'hip', R: 'count', count: 2, blink: blinkAt(t, 14) }, AUNT), A(EX(5), { expr: t < 83 ? 'neutral' : 'shock', facing: 1, look: 0.4 }, [5.0, SW, -4.9])],
  over: (g, c, t) => tag(g, ramp(t, 82.2, 83.4), t),
});
// 25 MONTAGE f: customer wobbling a tower of bowls
shot({ a: 85.0, b: 88.0, area: 'city', light: 'city', points: () => MARKET(-6),
  cam: (t) => camK([{ t: 85, pos: [2.2, 1.9, -3.0], look: [4.8, 2.0, -5.0], fov: 46, roll: -4 }, { t: 88, pos: [2.5, 2.0, -3.3], look: [4.8, 2.1, -5.0], fov: 42, roll: 4 }], t),
  actors: (t) => [A(EX(5), { expr: 'pale', L: 'up', R: 'up', step: q((t * 1.2) % 1), tilt: q(6 * Math.sin(t * 4), 0) }, [4.8 - (t - 85) * 0.3, SW, -5.0]),
    FX('stack' + q(Math.sin(t * 4), 1), stack(14, Math.sin(t * 4)), [4.8 - (t - 85) * 0.3, 1.95, -5.0], 1.0, { order: 3, shadow: true })],
});
// 26 QUEUE: pull-out reveals the line, auntie points
shot({ a: 88.0, b: 95.0, area: 'city', light: 'city', points: (t) => MARKET(-14),
  cam: (t) => camK([{ t: 88, pos: [3.4, 1.75, -15.4], look: [5.2, 1.6, -17.2], fov: 36 }, { t: 95, pos: [0.4, 4.6, -6.2], look: [5.4, 1.2, -21.5], fov: 46 }], t),
  actors: (t) => { const out = [A('hero', { expr: t < 90 ? 'neutral' : 'nervous', L: 'hang', R: 'hang', blink: blinkAt(t, 5), look: 0.4 }, [5.2, SW, -17.2])];
    for (let i = 0; i < 9; i++) out.push(A(EX(11 + i), { expr: i % 3 ? 'grin' : 'smile', L: i % 2 ? 'wave' : 'hang', R: i % 4 === 0 ? 'point' : 'hang', wv: q(t * 6 + i, 1), facing: -1, look: -0.5, blink: blinkAt(t, 11 + i) }, [4.9 + (i % 2) * 0.6, SW, -18.6 - i * 1.15]));
    out.push(A('auntie', { expr: 'grin', L: 'point', R: 'hip', facing: -1 }, AUNT));
    return out; },
  over: (g, c, t) => bubble(g, c, [AUNT[0], 2.1, AUNT[2]], 'นั่นไง! คนที่ลาบที่สุด!', 91.0, t, { dy: -260, size: 62 }),
});
// 27 "ไม่รู้จัก" — pale hero sidesteps, the crowd follows
shot({ a: 95.0, b: 102.0, area: 'city', light: 'city', points: (t) => MARKET(-16),
  cam: (t) => camK([{ t: 95, pos: [2.7, 1.72, -16.4], look: [5.2, 1.6, -17.2], fov: 34 }, { t: 102, pos: [2.3, 1.8, -16.6], look: [4.9, 1.5, -17.5], fov: 42 }], t),
  actors: (t) => { const slide = ramp(t, 98.6, 101.6), x = 5.2 - slide * 0.6, z = -17.2 + slide * 1.6; const out = [A('hero', { expr: 'pale', pale: true, L: 'hang', R: 'hang', sweat: true, step: slide > 0 && slide < 1 ? q((t * 1.4) % 1) : 0, blink: blinkAt(t, 5) }, [x, SW, z])];
    for (let i = 0; i < 4; i++) out.push(A(EX(11 + i), { expr: 'grin', facing: -1, look: -0.5, step: slide > 0 && slide < 1 ? q((t * 1.4 + i * 0.3) % 1) : 0, blink: blinkAt(t, 11 + i) }, [4.9 + (i % 2) * 0.6 - slide * 0.6, SW, -18.6 - i * 1.15 + ramp(t, 99.2, 102) * 1.6]));
    return out; },
  over: (g, c, t) => bubble(g, c, [5.2, 2.4, -17.2], 'ไม่รู้จัก', 96.0, t, { dy: -360 }),
  dof: (t, C) => ({ focus: dist(C.pos, [5.2, 1.6, -17.2]), cinf: 8 }),
});
// 28-34 PARALLEL CUTS: investor vs Tong, price chart up then crash
const INV = [-5.2, SW, -20];
const invCU = (a, b, line, expr, R = 'ear') => shot({ a, b, area: 'city', light: 'city', points: () => [{ pos: [-7, 4, -18], col: '#ff4fa3', i: 7, d: 12 }, { pos: [-2, 4, -22], col: '#3fe0d0', i: 5, d: 12 }],
  cam: (t) => camK([{ t: a, pos: [-3.4, 1.75, -18.6], look: [-5.2, 1.62, -20], fov: 34, roll: -4 }, { t: b, pos: [-3.6, 1.75, -18.85], look: [-5.2, 1.62, -20], fov: 31, roll: -6 }], t),
  actors: (t) => [A('investor', { expr, L: 'hip', R, prop: R === 'ear' ? 'phone' : null, propHand: 1, blink: blinkAt(t, 31), headTilt: q(3 * Math.sin(t * 6), 1) }, INV)],
  over: (g, c, t) => line && bubble(g, c, [INV[0], 2.3, INV[2]], line, a + 0.2, t, { dy: -320 }),
  dof: (t, C) => ({ focus: dist(C.pos, INV), cinf: 9 }) });
invCU(102.0, 104.0, 'ซื้อหมด!', 'grin');
shot({ a: 104.0, b: 106.0, area: 'city', light: 'city', points: () => MARKET(-14),
  cam: (t) => camK([{ t: 104, pos: [3.0, 1.7, -12.4], look: [5.0, 1.55, -14.2], fov: 38 }, { t: 106, pos: [3.3, 1.7, -12.8], look: [5.0, 1.55, -14.2], fov: 35 }], t),
  actors: (t) => [A('tong', { expr: 'proud', L: 'hold', R: 'hold', prop: 'box', blink: blinkAt(t, 9), bob: q(0.03 * Math.abs(Math.sin(t * 8)), 2) }, [5.0, SW, -14.2])],
  over: (g, c, t) => chart(g, ramp(t, 104, 106) * 0.5, false),
});
shot({ a: 106.0, b: 108.0, area: 'city', light: 'city', points: () => MARKET(-14),
  cam: (t) => camK([{ t: 106, pos: [-0.8, 3.6, -11.0], look: [5.0, 1.0, -16.5], fov: 46 }, { t: 108, pos: [-0.6, 3.4, -11.6], look: [5.0, 1.0, -16.5], fov: 44 }], t),
  actors: (t) => [A('tong', { expr: 'proud', L: 'hold', R: 'hold', prop: 'box', step: q((t * 1.5) % 1) }, [5.0, SW, -14.2 + (t - 106) * 0.8]), A('investor', { expr: 'grin', L: 'hold', R: 'hold', prop: 'box', step: q((t * 1.5 + 0.5) % 1) }, [4.4, SW, -16.4 + (t - 106) * 0.8]),
    A(EX(12), { expr: 'shock' }, [5.6, SW, -9.5]), A(EX(13), { expr: 'shock' }, [5.8, SW, -19])],
  over: (g, c, t) => chart(g, 0.5 + ramp(t, 106, 108) * 0.5, false),
});
invCU(108.0, 110.0, 'ขายด่วน!!', 'shock');
shot({ a: 110.0, b: 112.0, area: 'city', light: 'city', points: () => MARKET(-14),
  cam: (t) => shake(camK([{ t: 110, pos: [-0.6, 3.4, -11.6], look: [5.0, 1.0, -15.5], fov: 44, roll: 0 }, { t: 112, pos: [-0.3, 3.1, -12.0], look: [5.0, 1.0, -15.5], fov: 46, roll: -8 }], t), t, 110.9, 0.06, 0.5),
  actors: (t) => [A('tong', { expr: t < 110.9 ? 'proud' : 'shock', L: 'hold', R: 'hold', prop: 'box' }, [5.0, SW, -12.6]), A(EX(12), { expr: 'laugh', L: 'point' }, [5.6, SW, -9.5])],
  over: (g, c, t) => chart(g, ramp(t, 110, 111.4), true),
});
invCU(112.0, 114.0, '', 'whistle', 'hip');
shot({ a: 114.0, b: 116.0, area: 'city', light: 'city', points: () => MARKET(-14),
  cam: (t) => camK([{ t: 114, pos: [3.0, 1.72, -12.0], look: [5.0, 1.55, -12.6], fov: 36 }, { t: 116, pos: [3.25, 1.7, -12.1], look: [5.0, 1.55, -12.6], fov: 32 }], t),
  actors: (t) => [A('tong', { expr: 'cry', L: 'hug', R: 'hug', prop: 'box', tears: q(0.4 + 0.5 * ((t * 2) % 1), 1), tilt: q(3 * Math.sin(t * 18), 0) }, [5.0, SW, -12.6])],
  dof: (t, C) => ({ focus: dist(C.pos, [5.0, 1.6, -12.6]), cinf: 9 }),
});
// 35 RAIN NIGHT: push-in toward the lit window, a figure watches
const FIG = [RX + 1.55, 0, 4.25];
shot({ a: 116.0, b: 124.0, area: 'rural', light: 'rain', points: () => [WINDOW_GLOW, LAMP(7)],
  cam: (t) => camK([{ t: 116, pos: [RX + 6.5, 2.6, 14.0], look: [RX + 0.4, 1.9, 3.0], fov: 44 }, { t: 124, pos: [RX + 3.6, 1.95, 8.0], look: [RX + 0.9, 1.9, 3.4], fov: 38 }], t),
  world: () => ({ wind: 2.2 }),
  actors: (t) => [A('old', { expr: 'neutral', scarf: true, L: 'write', R: 'write', prop: 'book', look: -0.9, facing: -1, blink: blinkAt(t, 21) }, FIG, { tint: '#5a6070' }),
    A('hero', { expr: 'neutral', L: 'hang', R: 'mouth', prop: 'spoon', propHand: 1 }, [RX + 0.2, FL, -0.2])],
  over: (g, c, t) => rain(g, t),
});
// 36 FIGURE MEDIUM: writing; lightning -> banana-leaf disguise
shot({ a: 124.0, b: 132.0, area: 'rural', light: 'rain', points: (t) => [WINDOW_GLOW, LAMP(7)],
  cam: (t) => { const c = camK([{ t: 124, pos: [RX + 3.2, 1.55, 6.9], look: [RX + 1.45, 1.35, 4.25], fov: 40 }, { t: 132, pos: [RX + 2.9, 1.5, 6.4], look: [RX + 1.45, 1.4, 4.25], fov: 36 }], t);
    c.flash = t > 126.8 && t < 127.3 ? 0.7 * (1 - (t - 126.8) / 0.5) : 0; return c; },
  world: () => ({ wind: 2.2 }),
  actors: (t) => { const hidden = t > 126.9 && t < 129.8; const out = [A('old', { expr: hidden ? 'nervous' : 'neutral', scarf: true, L: 'write', R: 'write', prop: 'book', look: -0.9, facing: -1, blink: blinkAt(t, 21) }, FIG, { tint: t > 126.8 && t < 127.3 ? '#c0c8e0' : '#5a6070' }),
    A('hero', { expr: t > 127.2 && t < 129.5 ? 'think' : 'neutral', L: 'hang', R: 'hang', look: 0.8 }, [RX + 0.25, FL, 0.6])];
    if (hidden) out.push(FX('leaf', leaf, [FIG[0] - 0.05, 0.85, FIG[2] + 0.25], 0.62, { order: 4, tint: '#7a8a7a' }));
    return out; },
  over: (g, c, t) => { rain(g, t); if (t > 127.0 && t < 128.4) bigText(g, ['*ครืน!*'], 330, 130, clamp((t - 127.0) / 0.3)); },
  dof: (t, C) => ({ focus: dist(C.pos, [FIG[0], 1.3, FIG[2]]), cinf: 7 }),
});
// 37 END: book close-up
shot({ a: 132.0, b: 135.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(3)],
  cam: (t) => camK([{ t: 132, pos: [RX - 0.48, 2.85, 1.3], look: [RX - 0.48, 1.66, 0.62], fov: 34 }, { t: 135, pos: [RX - 0.48, 2.7, 1.2], look: [RX - 0.48, 1.66, 0.62], fov: 31 }], t),
  world: () => ({ book: { open: 1 } }),
  actors: () => [],
  over: (g, c, t) => rain(g, t, 0.25),
});
shot({ a: 135.0, b: 138.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(3)],
  cam: (t) => camK([{ t: 135, pos: [RX - 0.3, 2.3, 2.2], look: [RX - 0.3, 1.95, 0.0], fov: 38 }, { t: 138, pos: [RX - 0.3, 2.28, 2.0], look: [RX - 0.3, 1.95, 0.0], fov: 35 }], t),
  world: (t) => ({ book: { open: 1, flip: t > 136.4 ? clamp((t - 136.4) / 1.2) * 0.2 : undefined } }),
  actors: (t) => [A('hero', { expr: t < 136.5 ? 'neutral' : 'think', L: 'hold', R: 'hold', blink: blinkAt(t, 5), look: 0, headTilt: 6 }, [RX - 0.25, FL, -0.1])],
  over: (g, c, t) => rain(g, t, 0.25),
});
shot({ a: 138.0, b: 141.0, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(3)],
  cam: (t) => camK([{ t: 138, pos: [RX - 0.42, 2.4, 0.95], look: [RX - 0.44, 1.66, 0.6], fov: 36 }, { t: 141, pos: [RX - 0.43, 2.15, 0.8], look: [RX - 0.44, 1.66, 0.6], fov: 30, ease: 'out' }], t),
  world: () => ({ book: { open: 1, torn: true } }),
  actors: () => [],
  dof: (t, C) => ({ focus: dist(C.pos, [RX - 0.3, 1.66, 0.6]), cinf: 10 }),
});
shot({ a: 141.0, b: 143.5, area: 'rural', light: 'inside', points: (t) => [LAMP(9), COALS(3)],
  cam: (t) => shake(camK([{ t: 141, pos: [RX - 0.25, 2.3, 1.6], look: [RX - 0.25, 2.3, -0.1], fov: 34 }, { t: 141.4, pos: [RX - 0.25, 2.33, 0.9], look: [RX - 0.25, 2.33, -0.1], fov: 30, ease: 'out' }, { t: 143.5, pos: [RX - 0.25, 2.33, 0.85], look: [RX - 0.25, 2.33, -0.1], fov: 29 }], t), t, 141.4, 0.04, 0.4),
  world: () => ({ book: { open: 1, torn: true } }),
  actors: (t) => [A('hero', { expr: 'shock', pale: t > 142, L: 'cheek', R: 'cheek', blink: 0 }, [RX - 0.25, FL, -0.1])],
});
shot({ a: 143.5, b: 146.5, area: 'rural', light: 'inside', points: (t) => [LAMP(7 + 2 * Math.sin(t * 11)), COALS(3)],
  cam: (t) => camK([{ t: 143.5, pos: [RX - 0.4, 2.9, 1.25], look: [RX - 0.45, 1.66, 0.6], fov: 36, roll: -4 }, { t: 146.5, pos: [RX - 0.42, 2.6, 1.05], look: [RX - 0.45, 1.66, 0.6], fov: 32, roll: 3 }], t),
  world: () => ({ book: { open: 1, torn: true } }),
  actors: () => [],
  over: (g, c, t) => rain(g, t, 0.3),
});
// freeze 146.5-148.0 is handled in frameState (holds the frame, silence in the mix)
// 38 REVEAL: the figure lowers the scarf — the old man, holding the missing page
shot({ a: 148.0, b: 150.0, area: 'rural', light: 'rain', points: () => [{ pos: [RX + 13.0, 1.6, 17.6], col: '#ffb05a', i: 6, d: 8 }],
  cam: (t) => camK([{ t: 148, pos: [RX + 13.55, 1.5, 18.2], look: [RX + 13.1, 1.4, 16.4], fov: 34 }, { t: 150, pos: [RX + 13.45, 1.48, 17.9], look: [RX + 13.1, 1.42, 16.4], fov: 31 }], t),
  actors: (t) => [A('old', { expr: t < 148.7 ? 'neutral' : 'sly', scarf: true, unmask: t > 148.5, L: t < 148.5 ? 'mouth' : 'hold', R: 'hang', prop: t > 148.5 ? null : null, blink: 0, look: 0.2 }, [RX + 13.1, 0, 16.4], { tint: '#8a8ea0' }),
    FX('page', pageCard, [RX + 13.3, 0.75, 16.75], 0.42, { order: 4, tint: '#a0a4b0', roll: 0.1 })],
  over: (g, c, t) => rain(g, t, 0.6),
  dof: (t, C) => ({ focus: dist(C.pos, [RX + 13.1, 1.4, 16.4]), cinf: 8 }),
});

export const SHOTS = S;
export const shotAt = (t) => S.find((s) => t >= s.a && t < s.b) || S[S.length - 1];
export const frameState = (f, T) => {
  T_ = T;
  let t = f / 30;
  const frozen = t >= 146.5 && t < 148.0; if (frozen) t = 146.5 - 1 / 30;
  const s = shotAt(t), L = { ...LIGHTS[s.light] };
  L.points = s.points ? s.points(t) : [];
  const cam = s.cam(t), world = { area: s.area, ...(s.world ? s.world(t) : {}) };
  if (world.book === undefined) world.book = { open: 0 };
  const actors = [...(s.actors ? s.actors(t) : []), ...(s.fx ? s.fx(t) : [])];
  const dof = s.dof ? s.dof(t, cam) : { focus: 5, cinf: 0 };
  const tc = f / 30;
  const overlay = (g, ctx) => { if (s.over) s.over(g, ctx, t); drawCaption(g, tc, 1580); };
  return { cam, light: L, world, actors, dof, overlay, shot: s };
};
