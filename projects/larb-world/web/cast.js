
// ---------------- "Larb World" cast: our own designs, built on the Pen / blob / face helpers above ----------------
FACE.think = { eye: ["slit", "slit"], brow: [4, -2], mouth: "wave" };
FACE.innocent = { eye: ["happy", "happy"], brow: [-3, -2], mouth: "smile" };
FACE.pale = { eye: ["small", "small"], brow: [-4, 3], mouth: "wave" };
FACE.cry = { eye: ["squeeze", "squeeze"], brow: [-5, 4], mouth: "O" };
FACE.grumpy = { eye: ["lid", "lid"], brow: [5, -4], mouth: "frown" };
FACE.yuck = { eye: ["squeeze", "shock"], brow: [-6, 3], mouth: "teeth" };
FACE.sly = { eye: ["lid", "lid"], brow: [-2, -5], mouth: "smirk" };
FACE.proud = { eye: ["happy", "happy"], brow: [-3, -4], mouth: "smileWide" };

const CAST = {
  hero: { shirt: "#2f63b0", pants: "#3b3630", feet: "#6b4a32", skin: "#e2ae80", hair: "#1b181d", style: "short", seed: 5, stains: true },
  tong: { shirt: "#d4473a", pants: "#2e3446", feet: "#f2efe8", skin: "#dca274", hair: "#231c1a", style: "slick", seed: 9, stout: true, chain: true, shades: true, flowers: "#ffd9c9" },
  auntie: { shirt: "#8a4f9e", pants: "#4a3a46", feet: "#c25a4a", skin: "#d39868", hair: "#2a2226", style: "bun", seed: 14, stout: true, apron: "#3f8a5a", flowers: "#e8c6f0" },
  old: { shirt: "#c9b99a", pants: "#4b4238", feet: "#5a4634", skin: "#cf9a70", hair: "#f2efe9", style: "messy", seed: 21, coat: "#7a5638", brows: "#f2efe9", stubble: true },
  investor: { shirt: "#f4f4f2", pants: "#1f2a40", feet: "#17171c", skin: "#efc79e", hair: "#16141a", style: "slick", seed: 31, suit: "#22304c", tie: "#b8283a" },
  driver: { shirt: "#3d8a7a", pants: "#2e3446", feet: "#222", skin: "#c98f62", hair: "#1e1a1a", style: "cap", cap: "#e07b2c", seed: 41 },
};
export const extra = (v) => {
  const shirts = ["#4f7fb8", "#c2573f", "#5d8a3a", "#b0632f", "#2f6f7a", "#7b5ac9", "#a04f6a", "#3f5f9a"];
  const skins = ["#e2ae80", "#d39868", "#efc79e", "#c98f62"];
  return { shirt: shirts[v % 8], pants: ["#3b3f52", "#4a3a2e", "#2e3446"][v % 3], feet: "#4a3426", skin: skins[v % 4], hair: v % 5 === 4 ? "#8a8580" : "#1e1a1a",
    style: ["short", "bun", "cap", "slick", "short"][v % 5], cap: ["#e2453c", "#3f6fb5", "#2f8a5a"][v % 3], seed: 50 + v * 7, stout: v % 3 === 1 };
};

/** held props, drawn at a hand position (hx, hy) in design units, u = 1 % head width */
const PROPS = {
  bowl: (p, x, y, u, o = {}) => { // covered larb bowl: clay bowl + woven lid
    p.ell(x, y + 4 * u, 30 * u, 9 * u, "#00000033", 0);
    p.poly([[x - 30 * u, y - 8 * u], [x + 30 * u, y - 8 * u], [x + 20 * u, y + 14 * u], [x - 20 * u, y + 14 * u]], "#d8d2c4", 3 * u);
    p.band([[x - 27 * u, y - 1 * u], [x + 27 * u, y - 1 * u]], "#3f7ab8", 3 * u, 0.8 * u);
    if (!o.open) { p.ell(x, y - 9 * u, 31 * u, 13 * u, "#c79a52", 3 * u, 180, 360); p.ell(x, y - 22 * u, 6 * u, 4 * u, "#a87a3a", 2 * u); }
    else { p.ell(x, y - 9 * u, 29 * u, 7 * u, "#8a5a3a", 2.5 * u); for (let i = 0; i < 7; i++) p.dot(x - 20 * u + i * 7 * u, y - 10 * u + (i % 2) * 2 * u, 2.4 * u, i % 3 ? "#4f9a3a" : "#c2402c"); }
  },
  box: (p, x, y, u) => { // wooden savings box full of covered bowls
    for (let i = 0; i < 3; i++) PROPS.bowl(p, x - 34 * u + i * 34 * u, y - 30 * u, u * 0.62);
    p.poly([[x - 62 * u, y - 30 * u], [x + 62 * u, y - 30 * u], [x + 58 * u, y + 32 * u], [x - 58 * u, y + 32 * u]], "#9a6a3c", 3.5 * u);
    for (const k of [-1, 0, 1]) p.stroke([[x - 58 * u, y + k * 16 * u], [x + 58 * u, y + k * 16 * u]], 1.5 * u, "#6e4626");
    p.poly(rrect(x - 9 * u, y - 10 * u, x + 9 * u, y + 10 * u, 3 * u), "#d6c08a", 2.4 * u); p.dot(x, y + 2 * u, 2.4 * u);
  },
  book: (p, x, y, u) => {
    p.poly([[x - 34 * u, y - 44 * u], [x + 34 * u, y - 44 * u], [x + 34 * u, y + 40 * u], [x - 34 * u, y + 40 * u]], "#7a2f2a", 3.5 * u);
    p.poly([[x + 34 * u, y - 44 * u], [x + 44 * u, y - 38 * u], [x + 44 * u, y + 46 * u], [x + 34 * u, y + 40 * u]], "#f1e6cc", 2.5 * u);
    for (let i = 1; i < 5; i++) p.stroke([[x + 36 * u, y - 38 * u + i * 16 * u], [x + 42 * u, y - 34 * u + i * 16 * u]], 0.9 * u, "#b9a984");
    p.poly(rrect(x - 22 * u, y - 24 * u, x + 22 * u, y + 2 * u, 4 * u), "#e9d6a6", 2 * u);
    p.ell(x, y - 11 * u, 9 * u, 6 * u, "#7a2f2a", 1.6 * u);
  },
  phone: (p, x, y, u) => { p.poly(rrect(x - 9 * u, y - 18 * u, x + 9 * u, y + 18 * u, 3 * u), "#1c1e26", 2.5 * u); p.poly(rrect(x - 6 * u, y - 14 * u, x + 6 * u, y + 12 * u, 2 * u), "#6fc3e8", 0); },
  spoon: (p, x, y, u) => { p.band([[x, y], [x + 4 * u, y - 34 * u]], "#c9ccd2", 3 * u, 1 * u, "round"); p.ell(x + 5 * u, y - 38 * u, 6 * u, 8 * u, "#dfe2e6", 2 * u); },
  pencil: (p, x, y, u) => { p.band([[x - 4 * u, y + 6 * u], [x + 14 * u, y - 26 * u]], "#d8a83a", 3.5 * u, 1 * u, "round"); },
  rice: (p, x, y, u) => { p.poly([[x - 30 * u, y - 40 * u], [x + 30 * u, y - 40 * u], [x + 36 * u, y + 36 * u], [x - 36 * u, y + 36 * u]], "#efe6cf", 3 * u); p.stroke([[x - 30 * u, y - 30 * u], [x + 30 * u, y - 30 * u]], 2 * u, "#c2a96a"); p.ell(x, y, 14 * u, 10 * u, "#6aa04a", 1.6 * u); },
};

/** front / 3-4 view person. opts: expr, blink, look, facing, L, R arm poses, prop, tilt, headTilt, bob, step, sit, pale, tears, scarf, noScarfFace */
export const person = (p, key, opts = {}) => {
  const O = typeof key === "string" ? CAST[key] : key;
  const { expr = "neutral", blink = 0, look = 0, facing = 0, L = "hang", R = "hang", tilt = 0, headTilt = 0, bob = 0, step = 0,
    sit = false, light = rad(-120), prop = null, propHand = 0, tears = 0, scarf = false, count = 0, squash = 0 } = opts;
  const seed = O.seed, lid = lidOf(blink);
  let skin = O.skin; if (opts.pale) skin = mix(skin, "#dfe6ea", 0.55);
  const H = headBlob(seed, 118, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const torsoL = O.stout ? 1.12 : 1.06, legsL = sit ? 0.0 : 1.36, sole = 975;
  const torsoBot = (sit ? sole - 0.25 * HH : sole - legsL * HH) - bob * HH, chin = torsoBot - torsoL * HH * (1 - squash * 0.12), hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u, cx = 300;
  const top = O.suit || O.coat || O.shirt;
  const legCol = mix(O.pants, INK, 0.35), armCol = mix(top, INK, 0.25);
  p.rot = null;
  // ---- coat tails behind (old man) ----
  if (O.coat && !sit) {
    const cp = [[cx - 0.5 * W, chin + 0.1 * HH], [cx + 0.5 * W, chin + 0.1 * HH], [cx + 0.6 * W, torsoBot + 0.75 * HH], [cx - 0.6 * W, torsoBot + 0.75 * HH]];
    p.gradFill(cp, O.coat, mul(O.coat, [0.6, 0.6, 0.7]), light); p.inkRing(cp, ow * 0.8, thick);
    p.stroke([[cx - 0.2 * W, torsoBot + 0.6 * HH], [cx - 0.12 * W, torsoBot + 0.74 * HH]], 2 * u, mul(O.coat, [0.6, 0.6, 0.7]));
  }
  // ---- legs ----
  for (const side of [-1, 1]) {
    if (sit) { // cross-legged on the ground
      const h = [cx + side * 18 * u, hipY], k = [cx + side * 52 * u, sole - 0.1 * HH], f = [cx - side * 10 * u, sole - 0.06 * HH];
      p.stroke(curve(h, k, f), 7 * u + 2 * ow * 0.9, INK); p.stroke(curve(h, k, f), 7 * u, mix(O.pants, "#000", 0.1));
      p.ell(f[0], f[1], 8 * u, 5 * u, O.feet, 2 * u); continue;
    }
    const up = Math.max(0, Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0)))) * 28 * (step ? 1 : 0);
    const hx = cx + side * 16 * u, fx = cx + side * 22 * u, fy = sole - 4 * u - up;
    p.stroke(curve([hx, hipY], [(hx + fx) / 2 + side * 2 * u, (hipY + fy) / 2], [fx, fy]), 6.4 * u, legCol);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u + 3, INK);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u, O.feet);
  }
  // ---- upper body ----
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const T = { a: (0.41 * W) / 1.06 * (O.stout ? 1.16 : 1), b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: O.stout ? 0.2 : 0.1, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = cx + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const S = (side) => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const arm = (side, pose) => {
    const s = S(side), X = (k) => tcx + side * (T.a * 1.1 + k * u);
    switch (pose) {
      case "point": return { pts: [s, [X(28), s[1] - 0.02 * HH], [X(62), s[1] - 0.1 * HH]], finger: true };
      case "up": return { pts: [s, [X(14), s[1] - 0.3 * HH], [X(22), s[1] - 0.75 * HH]] };
      case "wave": return { pts: [s, [X(16), s[1] - 0.2 * HH], [X(30 + 10 * Math.sin(opts.wv || 0)), s[1] - 0.62 * HH]] };
      case "hip": return { pts: [s, [X(22), s[1] + 0.3 * HH], [tcx + side * T.a * 0.95, torsoBot - 0.3 * HH]] };
      case "think": return { pts: [s, [X(6), s[1] + 0.42 * HH], [cx + side * 0.3 * H.a + 8 * u * facing, hc + 1.08 * H.b]], front: true };
      case "temple": return { pts: [s, [X(26), s[1] + 0.05 * HH], [cx + side * (H.a + 14 * u), hc - 0.1 * HH]] };
      case "cheek": return { pts: [s, [X(16), s[1] + 0.05 * HH], [cx + side * (H.a + 2 * u), hc + 0.25 * H.b]] };
      case "eye": return { pts: [s, [X(10), s[1] + 0.1 * HH], [cx + side * 0.28 * W + 7 * u * facing, hc + 4 * u]], front: true, fist: true };
      case "mouth": return { pts: [s, [X(6), s[1] + 0.38 * HH], [cx + 9 * u * facing + side * 4 * u, hc + 0.5 * H.b]], front: true };
      case "hold": return { pts: [s, [X(4), s[1] + 0.4 * HH], [tcx + side * 0.52 * T.a, chin + 0.62 * HH]], front: true };
      case "hug": return { pts: [s, [X(8), s[1] + 0.35 * HH], [tcx - side * 0.3 * T.a, chin + 0.6 * HH]], front: true };
      case "ear": return { pts: [s, [X(18), s[1] + 0.2 * HH], [cx + side * (H.a * 0.98), hc + 0.05 * H.b]] };
      case "shrug": return { pts: [s, [X(26), s[1] + 0.2 * HH], [X(40), s[1] - 0.12 * HH]], open: true };
      case "count": return { pts: [s, [X(16), s[1] - 0.05 * HH], [X(24), s[1] - 0.48 * HH]], fingers: count };
      case "reach": return { pts: [s, [X(42), s[1] - 0.05 * HH], [X(80), s[1] - 0.2 * HH]] };
      case "cross": return { pts: [s, [X(2), s[1] + 0.38 * HH], [tcx - side * 0.45 * T.a, s[1] + 0.32 * HH]], front: true };
      case "knee": return { pts: [s, [X(10), s[1] + 0.38 * HH], [cx + side * 40 * u, torsoBot + 0.02 * HH]], front: true };
      case "write": return { pts: [s, [X(6), s[1] + 0.4 * HH], [tcx + side * 0.1 * T.a, chin + 0.56 * HH]], front: true };
      default: return { pts: [s, [X(4), s[1] + 0.48 * HH], [X(3), chin + 1.04 * HH]] };
    }
  };
  const arms = [arm(-1, L), arm(1, R)];
  const drawArm = (a) => {
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 6.2 * u + 2 * ow * 0.85, INK);
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 6.2 * u, armCol);
    const [hx, hy] = a.pts[2];
    p.ell(hx, hy, 6.4 * u, 6.4 * u, skin, 2.6 * u);
    if (O.stains) p.dot(hx + 2 * u, hy + 2 * u, 1.8 * u, "#8a5a32");
    if (a.finger) { const dx = a.pts[2][0] - a.pts[1][0], dy = a.pts[2][1] - a.pts[1][1], l = Math.hypot(dx, dy); p.stroke([[hx, hy], [hx + dx / l * 13 * u, hy + dy / l * 13 * u]], 5.5 * u, INK); p.stroke([[hx, hy], [hx + dx / l * 13 * u, hy + dy / l * 13 * u]], 3 * u, skin); }
    if (a.fingers) for (let i = 0; i < Math.min(5, a.fingers); i++) { const ang = rad(-150 + i * 30), fx = hx + Math.cos(ang) * 14 * u, fy = hy + Math.sin(ang) * 14 * u; p.stroke([[hx, hy], [fx, fy]], 5.5 * u, INK); p.stroke([[hx, hy], [fx, fy]], 3 * u, skin); }
    if (a.open) for (let i = 0; i < 3; i++) { const ang = rad(-120 + i * 25 * Math.sign(hx - cx)), fx = hx + Math.cos(ang) * 10 * u, fy = hy + Math.sin(ang) * 10 * u; p.stroke([[hx, hy], [fx, fy]], 3 * u, INK); }
  };
  for (const a of arms) if (!a.front) drawArm(a);
  // ---- torso ----
  if (O.coat && sit) { const cp = blobPts(tcx, tcy + 0.1 * HH, { ...T, a: T.a * 1.25, b: T.b * 1.2, nBot: 3 }); p.gradFill(cp, O.coat, mul(O.coat, [0.6, 0.6, 0.7]), light); p.inkRing(cp, ow, thick); }
  p.gradFill(tp, top, mul(top, SH_CLOTH), light);
  p.clip(tp, () => {
    if (O.flowers) for (let i = 0; i < 14; i++) { const fx = tcx + (rnd(seed, 40 + i) - 0.5) * 1.8 * T.a, fy = chin + rnd(seed, 60 + i) * 1.05 * HH; p.ell(fx, fy, 5 * u, 5 * u, O.flowers, 0); p.dot(fx, fy, 1.8 * u, mul(top, [0.7, 0.7, 0.7])); }
    if (O.suit || O.coat) { // open jacket showing shirt
      p.poly([[tcx - 0.28 * T.a, chin - 0.05 * HH], [tcx + 0.28 * T.a, chin - 0.05 * HH], [tcx + 0.1 * T.a, torsoBot + 0.1 * HH], [tcx - 0.1 * T.a, torsoBot + 0.1 * HH]], O.shirt, 2 * u);
      if (O.tie) p.poly([[tcx - 5 * u, chin + 0.02 * HH], [tcx + 5 * u, chin + 0.02 * HH], [tcx + 7 * u, chin + 0.5 * HH], [tcx, chin + 0.6 * HH], [tcx - 7 * u, chin + 0.5 * HH]], O.tie, 1.8 * u);
      for (const s of [-1, 1]) p.stroke([[tcx + s * 0.28 * T.a, chin - 0.05 * HH], [tcx + s * 0.12 * T.a, chin + 0.42 * HH]], 2.2 * u, INK);
      if (O.coat) for (let i = 0; i < 3; i++) p.ell(tcx - 0.55 * T.a + i * 0.4 * T.a, chin + 0.7 * HH + (i % 2) * 0.1 * HH, 7 * u, 6 * u, mul(O.coat, [0.85, 0.8, 0.75]), 1.5 * u); // patches
    } else {
      p.stroke([[tcx - 0.25 * T.a, chin + 0.0 * HH], [tcx, chin + 0.12 * HH], [tcx + 0.25 * T.a, chin + 0.0 * HH]], 2.2 * u); // crew neck
      if (O.stains) { p.ell(tcx + 0.4 * T.a, chin + 0.7 * HH, 4 * u, 3 * u, "#7a5a3a", 0); p.ell(tcx - 0.3 * T.a, chin + 0.85 * HH, 3 * u, 2 * u, "#7a5a3a", 0); }
    }
    if (O.apron) p.poly([[tcx - 0.6 * T.a, chin + 0.28 * HH], [tcx + 0.6 * T.a, chin + 0.28 * HH], [tcx + 0.8 * T.a, torsoBot + 0.3 * HH], [tcx - 0.8 * T.a, torsoBot + 0.3 * HH]], O.apron, 2 * u);
    if (O.apron) p.poly(rrect(tcx - 0.35 * T.a, chin + 0.6 * HH, tcx + 0.35 * T.a, chin + 0.85 * HH, 3 * u), mul(O.apron, [0.8, 0.8, 0.8]), 1.6 * u);
  });
  p.inkRing(tp, ow, thick);
  if (O.chain) p.arc(tcx, chin + 0.02 * HH, 0.34 * T.a, 0.3 * HH, 20, 160, 3.5 * u, "#e0b445");
  if (scarf) { // long scarf wrapped high
    p.poly(rrect(cx - 0.52 * W, chin - 0.12 * HH, cx + 0.52 * W, chin + 0.12 * HH, 10 * u), "#5b2f3e", ow * 0.8);
    p.poly([[cx + 0.2 * W, chin + 0.05 * HH], [cx + 0.38 * W, chin + 0.05 * HH], [cx + 0.42 * W, chin + 0.9 * HH], [cx + 0.24 * W, chin + 0.92 * HH]], "#5b2f3e", ow * 0.8);
  }
  for (const a of arms) if (a.front) drawArm(a);
  if (prop) { const a = arms[propHand] || arms[0], b = arms[1]; const hx = L === "hold" && R === "hold" ? (arms[0].pts[2][0] + b.pts[2][0]) / 2 : a.pts[2][0], hy = L === "hold" && R === "hold" ? arms[0].pts[2][1] - 6 * u : a.pts[2][1];
    PROPS[prop](p, hx, hy, u, opts.propOpts || {}); if (L === "hold" && R === "hold") for (const q of [arms[0], b]) p.ell(q.pts[2][0], q.pts[2][1], 6.4 * u, 6.4 * u, skin, 2.6 * u); }
  // ---- head ----
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  p.rot = Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null;
  const hp = blobPts(cx, hc, H);
  if (O.style === "bun") p.ell(cx + 4 * u, hc - H.b * 1.08, 0.36 * H.a, 0.3 * H.b, O.hair, ow * 0.9);
  if (O.style === "messy" && !(scarf && !opts.unmask)) for (let i = 0; i < 9; i++) { const a = rad(200 + i * 17.5), r = H.a * (1.05 + 0.12 * rnd(seed, 80 + i)); const x = cx + Math.cos(a) * r, y = hc + Math.sin(a) * r * 0.98;
    p.poly([[x - 12 * u, y + 8 * u], [x + Math.cos(a) * 22 * u + 6 * u * (i % 2 ? 1 : -1), y + Math.sin(a) * 22 * u], [x + 12 * u, y + 8 * u]], O.hair, ow * 0.7); }
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (O.style === "cap") hatOn(p, { hat: "cap", cap: O.cap, jacket: top }, hp, H, cx, hc, light, seed, facing, false);
  else if (O.style === "messy" && !(scarf && !opts.unmask)) {
    const n = hp.length, cut = hc - H.b * 0.35, arc = hp.filter(([x, y]) => y < cut).map(([x, y]) => [cx + (x - cx) * 1.04, hc + (y - hc) * 1.04]);
    // white tufts over the crown, scalloped
    for (let i = 0; i < 7; i++) { const a = rad(200 + i * 23); p.ell(cx + Math.cos(a) * H.a * 0.86, hc + Math.sin(a) * H.b * 0.86, 0.28 * H.a, 0.2 * H.b, O.hair, ow * 0.6, 0, 360, (a * 180) / Math.PI + 90); }
    for (let i = 0; i < 4; i++) p.stroke([[cx - 30 * u + i * 20 * u, hc - H.b * 0.95], [cx - 34 * u + i * 20 * u, hc - H.b * 0.65]], 1.4 * u, "#b9b4ac");
  } else if (O.hair) {
    hatOn(p, { hat: "hair", hair: O.hair, jacket: top }, hp, H, cx, hc, light, seed, facing, false);
    if (O.style === "short") for (let i = 0; i < 5; i++) { const x = cx - 40 * u + i * 20 * u, y = hc - H.b * 0.98 + Math.abs(i - 2) * 6 * u; p.poly([[x - 9 * u, y + 6 * u], [x + 2 * u, y - 13 * u], [x + 9 * u, y + 6 * u]], O.hair, 0); }
    if (O.style === "slick") { p.stroke([[cx - 20 * u, hc - H.b * 0.98], [cx + 30 * u, hc - H.b * 0.62]], 2 * u, "#ffffff55"); p.stroke([[cx - 26 * u, hc - H.b * 0.95], [cx - 22 * u, hc - H.b * 0.56]], 1.8 * u, INK); }
    if (O.style === "bun") p.stroke([[cx + 18 * u, hc - H.b * 0.95], [cx + 34 * u, hc - H.b * 0.6]], 4 * u, "#9a949a");
  }
  if (O.stubble) p.clip(hp, () => { for (let i = 0; i < 26; i++) p.dot(cx + 6 * u * facing + (rnd(seed, 100 + i) - 0.5) * 70 * u, hc + (0.45 + 0.4 * rnd(seed, 130 + i)) * H.b, 1.4 * u, "#b8b1a6"); });
  faceFront(p, cx, hc, W, expr, facing, look, lid, false, skin, undefined, !!O.stout);
  if (O.brows) for (const s of [-1, 1]) p.ell(cx + 7 * u * facing + s * 14 * u, hc - 21 * u, 10 * u, 4.5 * u, O.brows, 1.8 * u);
  if (O.shades) { const y = hc - H.b * 0.62; for (const s of [-1, 1]) p.poly(rrect(cx + s * 22 * u - 14 * u + 5 * u * facing, y - 7 * u, cx + s * 22 * u + 14 * u + 5 * u * facing, y + 7 * u, 4 * u), "#1c2030", 2 * u); p.stroke([[cx - 8 * u, y], [cx + 8 * u, y]], 2.5 * u); }
  if (opts.pale) for (let i = 0; i < 4; i++) p.stroke([[cx - 24 * u + i * 14 * u, hc - H.b * 0.7], [cx - 24 * u + i * 14 * u, hc - H.b * 0.35]], 2.2 * u, "#6a8fc0");
  if (tears) for (const s of [-1, 1]) { const x = cx + 7 * u * facing + s * 13 * u; p.stroke([[x, hc + 6 * u], [x + s * 4 * u, hc + 6 * u + tears * 70 * u]], 7 * u, "#7cc4f0"); }
  if (opts.sweat) p.ell(cx + 52 * u, hc - 30 * u, 4 * u, 6.5 * u, "#9fd4ff", 2 * u);
  if (scarf && !opts.unmask) { // scarf over the mouth + hood shadow over the eyes
    p.clip(hp, () => { p.poly([[cx - 2 * H.a, hc + 0.12 * H.b], [cx + 2 * H.a, hc + 0.12 * H.b], [cx + 2 * H.a, hc + 2 * H.b], [cx - 2 * H.a, hc + 2 * H.b]], "#5b2f3e", 0);
      p.stroke([[cx - 2 * H.a, hc + 0.12 * H.b], [cx + 2 * H.a, hc + 0.12 * H.b]], 3 * u); });
    p.ell(cx, hc - 0.35 * H.b, H.a * 1.15, H.b * 0.95, "#2a2430", ow, 180, 360);
  }
  p.rot = null;
};

/** sitting cat for the market gag */
export const cat = (p, sniff = 0, blink = 0) => {
  const u = 2.4, light = rad(-120), th = thickAngle(light);
  const body = blobPts(300, 900, { a: 70, b: 60, nTop: 2.2, nBot: 2.6, egg: 0.2, asym: 0, rot: 0, noise: 0.01, seed: 3 });
  p.stroke(curve([360, 940], [430, 900], [420, 820]), 14, INK); p.stroke(curve([360, 940], [430, 900], [420, 820]), 8, "#d98a3a");
  p.shadedFill(body, "#e39a48", "#b86f2a", light, 70); p.inkRing(body, 10, th);
  const hy = 800 + sniff * 14, hx = 300 + sniff * 16, hp = blobPts(hx, hy, { a: 58, b: 48, nTop: 2.0, nBot: 2.4, egg: -0.1, asym: 0, rot: 0, noise: 0.01, seed: 4 });
  for (const s of [-1, 1]) p.poly([[hx + s * 50, hy - 22], [hx + s * 40, hy - 80], [hx + s * 12, hy - 44]], "#e39a48", 9);
  p.shadedFill(hp, "#e39a48", "#b86f2a", light, 58); p.inkRing(hp, 9, th);
  for (const s of [-1, 1]) { if (blink) p.stroke([[hx + s * 20 - 7, hy - 4], [hx + s * 20 + 7, hy - 4]], 5); else p.ell(hx + s * 20, hy - 4, 5, 8, INK, 0); }
  p.ell(hx, hy + 12, 6, 4, "#d0607a", 3);
  for (const s of [-1, 1]) for (const k of [-1, 1]) p.stroke([[hx + s * 18, hy + 14 + k * 3], [hx + s * 52, hy + 10 + k * 9]], 2.2);
  if (sniff > 0.3) for (let i = 0; i < 3; i++) p.arc(hx + 80 + i * 14, hy - 10, 10, 18, -60, 60, 3.5);
};

export const drawProp = (p, k, x, y, u, o) => PROPS[k](p, x, y, u, o || {});
export const bowlStack = (p, n, sway = 0) => { for (let i = 0; i < n; i++) { const x = 300 + Math.sin(i * 0.5) * sway * i * 3, y = 960 - i * 46; PROPS.bowl(p, x, y, 2.4); } };
