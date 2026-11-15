// "ถ้าโลกนี้ลาบคือของมีค่า?!" renderer: 3D toon sets + 2D card cast + ink pass + lens + 2D overlay (captions, bubbles).
import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';

const W = 1080, H = 1920;
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const out = document.getElementById('c'); const og = out.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 2500);
const rx = (a) => a * Math.PI / 180;
const FONT = 'LomaB';
await (async () => { const ff = new FontFace(FONT, 'url(Loma-Bold.otf)'); await ff.load(); document.fonts.add(ff); })();
const { TOTAL, frameState } = await import('./story.js');

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([95, 95, 95, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const M = {
  plank: texM(P.planks(1), 1, 1), plankDark: texM(P.planks(3), 1, 1, '#b89a80'), floor: texM(P.planks(5), 2, 2, '#d8b896'),
  roof: texM(P.roof(9), 3, 2, '#c08a6a'), grass: texM(P.grass(6), 120, 120), dirt: texM(P.dirt(7), 3, 40),
  asphalt: toon({ color: '#3a3d48' }), curb: toon({ color: '#9a9aa2' }), walk: toon({ color: '#6f6b72' }),
  trunk: toon({ color: '#6a4a32' }), leaf: toon({ color: '#3f7a3a' }), leaf2: toon({ color: '#5a9a42' }), bush: toon({ color: '#4f8a3a' }),
  mount: toon({ color: '#7f95b0' }), clay: toon({ color: '#b5653c' }), wok: toon({ color: '#2e2b2c' }),
  bowl: toon({ color: '#ddd6c6' }), lid: toon({ color: '#c99a52' }), sack: toon({ color: '#d8c89a' }),
  metal: toon({ color: '#8a8f99' }), tire: toon({ color: '#1e1e22' }), glass: toon({ color: '#2b3550' }), cream: toon({ color: '#efe3c6' }),
};
{ const [c, g] = cv(256, 256); g.fillStyle = '#5f9a3e'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#6fae48' : '#4f8a34'; g.fillRect(0, i * 16, 256, 9); } M.paddy = texM(c, 6, 6); }
const glow = (col) => new THREE.MeshBasicMaterial({ color: col, fog: true });

// ---------- ink contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`, side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`, side: THREE.DoubleSide,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => { const g = box(w, h, d), uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); } return g; };
const clampTex = (c) => { const t = P.tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 }, stars: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize, stars; varying vec3 vP;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .5)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .3*pow(max(s,0.), 20.)*step(.0001,sunSize));
      if (stars > 0.) { vec2 q = vec2(atan(vP.z, vP.x)*260., vP.y*260.); vec2 i = floor(q); float r = h21(i); vec2 f = fract(q)-.5;
        c += stars * step(.985, r) * smoothstep(.22, .0, length(f)) * smoothstep(.05,.3,vP.y) * vec3(1.,.96,.88); }
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const points = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#ffffff', 0, 20, 1.6); scene.add(l); return l; });
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ================= CITY (x ~ 0, road along z) =================
const city = new THREE.Group(); scene.add(city);
add(new THREE.PlaneGeometry(8, 400), M.asphalt, 0, 0, -120, city, { cast: false }).rotation.x = -Math.PI / 2;
for (let z = 30; z > -300; z -= 6) add(new THREE.PlaneGeometry(0.18, 2.4), glow('#cfcbc0'), 0, 0.01, z, city, { cast: false }).rotation.x = -Math.PI / 2;
for (const s of [-1, 1]) { const w = s > 0 ? 7 : 3.5; add(box(w, 0.18, 400), M.walk, s * (4 + w / 2), 0.09, -120, city, { cast: false }); add(box(0.25, 0.2, 400), M.curb, s * 4.1, 0.1, -120, city, { cast: false }); }
const facade = (seed, w, h, base) => {
  const r = P.rng(seed), cols = Math.max(2, Math.round(w / 2.2)), rows = Math.max(2, Math.round(h / 3));
  const [c, g] = cv(256, 512), [e, ge] = cv(256, 512);
  g.fillStyle = base; g.fillRect(0, 0, 256, 512); ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.fillRect(r() * 256, r() * 512, 20 + r() * 60, 10 + r() * 40); }
  const cw = 256 / cols, rh = 512 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows - 1; j++) {
    const x = i * cw + cw * 0.22, y = j * rh + rh * 0.25, ww = cw * 0.56, hh = rh * 0.5, lit = r() < 0.55;
    g.fillStyle = '#1c1d2a'; g.fillRect(x - 3, y - 3, ww + 6, hh + 6);
    const col = lit ? (r() < 0.6 ? `hsl(${34 + r() * 14},90%,${62 + r() * 12}%)` : `hsl(${190 + r() * 30},70%,${70 + r() * 10}%)`) : '#262a3a';
    g.fillStyle = col; g.fillRect(x, y, ww, hh); if (lit) { ge.fillStyle = col; ge.fillRect(x, y, ww, hh); ge.fillStyle = 'rgba(0,0,0,.35)'; ge.fillRect(x + ww * 0.45, y, 3, hh); }
  }
  return toon({ map: clampTex(c), emissiveMap: clampTex(e), emissive: '#ffffff', emissiveIntensity: 1 });
};
const signMat = (txt, col) => { const [c, g] = cv(256, 512); g.fillStyle = '#14101c'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = col; g.lineWidth = 12; g.shadowColor = col; g.shadowBlur = 24; g.strokeRect(16, 16, 224, 480);
  g.font = `100px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = txt.split('|'); lines.forEach((l, i) => { const y = 256 + (i - (lines.length - 1) / 2) * 120; g.fillStyle = col; g.fillText(l, 128, y); g.shadowBlur = 0; g.fillStyle = '#ffffffcc'; g.fillText(l, 128, y); g.shadowBlur = 24; });
  return new THREE.MeshBasicMaterial({ map: clampTex(c), fog: true }); };
const SIGNS = [['ส้มตำ', '#ff4fa3'], ['ข้าว|ต้ม', '#3fe0d0'], ['ตลาด|โต้รุ่ง', '#ffb13b'], ['เปิด|24 ชม.', '#7ab8ff'], ['ก๋วย|เตี๋ยว', '#ff5a4a'], ['นวด', '#b07aff'], ['ซ่อม|รถ', '#5aff8a'], ['ขนม|หวาน', '#ff8ad0']];
{ const rb = P.rng(5); let si = 0, bi = 0;
  for (const s of [-1, 1]) for (let z = 26; z > -260;) {
    const d = 7 + rb() * 6, w = 8 + rb() * 6, h = 9 + rb() * 22, x0 = s > 0 ? 11.2 : 7.6, cx = s * (x0 + w / 2);
    const base = `hsl(${200 + rb() * 60},${10 + rb() * 15}%,${28 + rb() * 18}%)`;
    const m = facade(30 + bi++, d, h, base);
    // box(width along z = d, h, depth along x = w); facade texture on the road-facing side (+x face for s=-1, -x face for s=+1)
    const mats = [M.walk, M.walk, M.walk, M.walk, M.walk, M.walk]; mats[s < 0 ? 0 : 1] = m;
    add(box(w, h, d), mats, cx, h / 2, z - d / 2, city);
    if (rb() < 0.8 && h > 8) { const [t, col] = SIGNS[si++ % SIGNS.length]; const sm = signMat(t, col); const sg = add(box(0.18, 2.6, 1.1), [sm, sm, glow(col), glow(col), glow(col), glow(col)], s * (x0 - 0.15), 4.4 + rb() * 3, z - d / 2 + (rb() - 0.5) * 3, city, { cast: false }); }
    add(box(1.6, 0.4, d * 0.96), toon({ color: `hsl(${rb() * 360},45%,45%)` }), s * (x0 - 0.5), 3.1, z - d / 2, city);
    z -= d + 0.4;
  } }
// billboard on the left: house for 1 bowl (hook gag)
{ const [c, g] = cv(1024, 512); g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 1024, 512); g.fillStyle = '#c23a30'; g.fillRect(0, 0, 1024, 100);
  g.font = `76px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('บ้านพร้อมอยู่', 512, 52);
  g.fillStyle = '#3f6fb5'; g.fillRect(120, 230, 260, 200); g.fillStyle = '#7a3a2a'; g.beginPath(); g.moveTo(90, 240); g.lineTo(250, 140); g.lineTo(410, 240); g.fill(); g.fillStyle = '#ffd77a'; g.fillRect(170, 280, 60, 60); g.fillRect(280, 300, 60, 130);
  g.fillStyle = '#241726'; g.font = `100px ${FONT}`; g.fillText('ราคา', 720, 220); g.fillStyle = '#c23a30'; g.font = `150px ${FONT}`; g.fillText('1 ชาม', 720, 370);
  const bb = add(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: clampTex(c), fog: true }), -7.0, 13, -30, city, { cast: false }); bb.rotation.y = Math.PI / 2;
  add(box(0.3, 11, 0.3), M.metal, -7.3, 5.5, -30, city); }
const car = (x, z, col, rot = 0, taxi = false) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; city.add(g);
  const body = toon({ color: col }); add(tbox(1.8, 0.7, 4.2), body, 0, 0.65, 0, g); add(tbox(1.6, 0.6, 2.2), body, 0, 1.25, -0.2, g);
  for (const s of [-1, 1]) add(box(0.02, 0.45, 1.9), M.glass, s * 0.81, 1.27, -0.2, g, { cast: false });
  add(box(1.5, 0.45, 0.02), M.glass, 0, 1.27, 0.91, g, { cast: false }); add(box(1.5, 0.45, 0.02), M.glass, 0, 1.27, -1.31, g, { cast: false });
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) { const w = add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), M.tire, sx * 0.85, 0.36, sz, g); w.rotation.z = Math.PI / 2; }
  for (const sx of [-0.6, 0.6]) { add(box(0.3, 0.14, 0.05), glow('#fff4c8'), sx, 0.75, 2.11, g, { cast: false }); add(box(0.3, 0.14, 0.05), glow('#ff3a3a'), sx, 0.75, -2.11, g, { cast: false }); }
  if (taxi) { add(box(0.8, 0.25, 0.3), glow('#ffe7a0'), 0, 1.68, -0.2, g, { cast: false }); for (const s of [-1, 1]) add(box(0.03, 0.12, 3.0), toon({ color: '#f4f0e8' }), s * 0.91, 0.75, 0, g); }
  return g; };
car(1.8, -8, '#2f9a8a', 0, true);
[[-2.2, 4, '#5a7ab8'], [-2.2, -14, '#b8b2a8'], [-2.2, -26, '#8a3a3a'], [-2.2, -40, '#3a5a4a'], [-2.2, -56, '#d8d4cc'], [-2.2, -75, '#4a4a6a']].forEach(([x, z, c], i) => car(x, z, c, i % 2 ? 0 : Math.PI));
for (let z = 20; z > -200; z -= 16) for (const s of [-1, 1]) { const x = s * 4.35; add(new THREE.CylinderGeometry(0.07, 0.09, 5, 8), M.metal, x, 2.5, z, city); add(box(1.2, 0.08, 0.08), M.metal, x - s * 0.55, 5, z, city); add(new THREE.SphereGeometry(0.2, 10, 8), glow('#ffe2b0'), x - s * 1.1, 4.9, z, city, { cast: false }); }

// ---- bowls ----
const bowlGeo = (() => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.06 + 0.1 * Math.sin(t * 1.4) + 0.02 * t, t * 0.09)); } return new THREE.LatheGeometry(pts, 18); })();
const lidGeo = new THREE.SphereGeometry(0.17, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4); lidGeo.scale(1, 0.55, 1);
const knobGeo = new THREE.SphereGeometry(0.03, 8, 6), bandGeo = new THREE.TorusGeometry(0.165, 0.012, 6, 24), foodGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16);
const bandM = toon({ color: '#3f7ab8' }), knobM = toon({ color: '#9a6a32' }), foodM = toon({ color: '#8a5a3a' });
const bowl3 = (parent, x, y, z, s = 1) => { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  add(bowlGeo, M.bowl, 0, 0, 0, g); add(bandGeo, bandM, 0, 0.055, 0, g, { cast: false }).rotation.x = Math.PI / 2;
  const lid = new THREE.Group(); lid.position.y = 0.085; g.add(lid); add(lidGeo, M.lid, 0, 0, 0, lid); add(knobGeo, knobM, 0, 0.095, 0, lid);
  const food = add(foodGeo, foodM, 0, 0.075, 0, g, { cast: false }); food.visible = false;
  g.userData.lid = lid; g.userData.food = food; return g; };
// ---- market plaza on the right sidewalk ----
const stall = (x, z, col, w = 3) => { const g = new THREE.Group(); g.position.set(x, 0.18, z); city.add(g);
  add(tbox(1.1, 0.08, w, 1), M.plank, 0, 0.9, 0, g); for (const sz of [-1, 1]) for (const sx of [-1, 1]) add(box(0.08, 0.9, 0.08), M.trunk, sx * 0.45, 0.45, sz * (w / 2 - 0.1), g);
  const [c, gg] = cv(256, 64); for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? '#f4efe6' : col; gg.fillRect(i * 32, 0, 32, 64); }
  const aw = add(box(1.8, 0.06, w + 0.4), toon({ map: clampTex(c) }), 0.1, 2.35, 0, g); aw.rotation.z = 0.22;
  for (const sz of [-1, 1]) add(box(0.06, 2.4, 0.06), M.metal, 0.75, 1.2, sz * (w / 2), g);
  return g; };
const stalls = [stall(6.2, 2, '#c23a30'), stall(6.2, -6, '#2f7a4a'), stall(6.2, -14, '#3f5fb0'), stall(6.2, -22, '#c27a2a'), stall(6.2, -30, '#8a3a8a')];
const auntie = stalls[1];
for (let i = 0; i < 3; i++) { const s = add(new THREE.SphereGeometry(0.26, 12, 10), M.sack, 0.05, 1.16, -1.1 + i * 0.36, auntie); s.scale.set(0.9, 1.15, 0.8); }
const crate = new THREE.Group(); crate.position.set(0.05, 0.94, 0.85); auntie.add(crate);
add(tbox(0.7, 0.28, 0.9, 0.5), M.plankDark, 0, 0.14, 0, crate);
for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) bowl3(crate, -0.17 + i * 0.34, 0.28, -0.28 + j * 0.28, 0.85);
stalls.forEach((s, k) => { if (k === 1) return; for (let i = 0; i < 6; i++) { if (k % 2) bowl3(s, -0.2 + (i % 2) * 0.3, 0.94, -1 + Math.floor(i / 2) * 0.6, 0.9); else add(new THREE.SphereGeometry(0.12, 10, 8), toon({ color: ['#e2702a', '#7ab83a', '#d8352a'][i % 3] }), -0.2 + (i % 2) * 0.3, 1.05, -1 + Math.floor(i / 2) * 0.5, s); } });
for (let z = 6; z > -34; z -= 1.2) add(new THREE.SphereGeometry(0.09, 8, 6), glow(['#ffcf7a', '#ff9a6a', '#fff0b0'][Math.abs(Math.round(z)) % 3]), 8.6 + Math.sin(z * 0.9) * 0.15, 3.3 - 0.25 * Math.abs(Math.sin(z * 0.6)), z, city, { cast: false });
for (let z = 6; z > -34; z -= 5) add(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6), M.metal, 8.6, 1.7, z, city);
const changeBowls = [0.55, 1.0, 1.55].map((s) => bowl3(auntie, 0, 0.94, 0, s));
const pile = new THREE.Group(); auntie.add(pile); pile.position.set(-0.05, 0.94, -0.1);
for (let i = 0; i < 20; i++) { const lv = Math.floor(Math.sqrt(i)); const b = bowl3(pile, (i % 4 - 1.5) * 0.16 + (lv % 2) * 0.05, lv * 0.13, ((i * 7) % 3 - 1) * 0.15, 0.7); b.rotation.y = i; }

// ================= RURAL (x ~ 1000) =================
const RX = 1000; const rural = new THREE.Group(); scene.add(rural);
add(new THREE.PlaneGeometry(2400, 2400), M.grass, RX, 0, 0, rural, { cast: false }).rotation.x = -Math.PI / 2;
for (let i = 0; i < 18; i++) { const px = RX - 70 + (i % 6) * 24, pz = -90 + Math.floor(i / 6) * 26; const pd = add(new THREE.PlaneGeometry(22, 22), M.paddy, px, 0.03, pz, rural, { cast: false }); pd.rotation.x = -Math.PI / 2; }
for (let i = 0; i < 10; i++) { const pd = add(new THREE.PlaneGeometry(22, 22), M.paddy, RX + 30 + (i % 5) * 24, 0.03, 10 + Math.floor(i / 5) * 24, rural, { cast: false }); pd.rotation.x = -Math.PI / 2; }
for (let i = 0; i < 10; i++) { const pd = add(new THREE.PlaneGeometry(22, 22), M.paddy, RX - 40 - (i % 5) * 24, 0.03, 10 + Math.floor(i / 5) * 24, rural, { cast: false }); pd.rotation.x = -Math.PI / 2; }
{ const p1 = add(new THREE.PlaneGeometry(2.2, 14), M.dirt, RX + 2.65, 0.04, 10, rural, { cast: false }); p1.rotation.x = -Math.PI / 2;
  const p2 = add(new THREE.PlaneGeometry(2.4, 160), M.dirt, RX + 2.6, 0.04, 17.5, rural, { cast: false }); p2.rotation.x = -Math.PI / 2; p2.rotation.z = Math.PI / 2; }
const palm = (x, z, h = 7) => { const g = new THREE.Group(); g.position.set(x, 0, z); rural.add(g);
  add(new THREE.CylinderGeometry(0.16, 0.24, h, 7), M.trunk, 0, h / 2, 0, g);
  for (let i = 0; i < 7; i++) { const a = i * 0.9, l = add(new THREE.ConeGeometry(0.35, 3.2, 4), i % 2 ? M.leaf : M.leaf2, Math.cos(a) * 1.3, h - 0.4, -Math.sin(a) * 1.3, g); l.rotation.order = 'YZX'; l.rotation.y = a; l.rotation.z = -(Math.PI / 2 - 0.45); }
  return g; };
const palms = [];
{ const rp = P.rng(19);
  for (let i = 0; i < 30; i++) { const a = rp() * Math.PI * 2, d = 10 + rp() * 70; const x = RX + Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(z - 17.5) < 3 || (Math.abs(x - RX - 2.6) < 3 && z > 0)) continue; if (Math.hypot(x - RX - 14, z - 14) < 7 || Math.hypot(x - RX, z) < 8) continue; palms.push(palm(x, z, 6 + rp() * 4)); }
  for (let i = 0; i < 40; i++) { const x = RX - 30 + rp() * 60, z = -30 + rp() * 60; if (Math.hypot(x - RX, z) < 7 || Math.abs(z - 17.5) < 2 || Math.hypot(x - RX - 14, z - 14) < 3) continue; const b = add(new THREE.SphereGeometry(0.6 + rp() * 0.8, 10, 8), M.bush, x, 0.3, z, rural); b.scale.y = 0.7; }
  for (let i = 0; i < 70; i++) { const a = rp() * Math.PI * 2, d = 140 + rp() * 70; const tr = add(new THREE.SphereGeometry(5 + rp() * 6, 10, 8), i % 2 ? M.leaf : M.bush, RX + Math.cos(a) * d, 3, Math.sin(a) * d, rural, { cast: false }); tr.scale.y = 0.8; }
  for (let i = 0; i < 14; i++) { const a = rp() * Math.PI * 2, d = 650 + rp() * 200, hh = 90 + rp() * 90; add(new THREE.ConeGeometry(140 + rp() * 80, hh, 7), M.mount, RX + Math.cos(a) * d, hh / 2 - 5, Math.sin(a) * d, rural, { cast: false }); } }
// ---- the little wooden house on stilts (interior x -4..4, z -3..3 local, floor y=0.9) ----
const house = new THREE.Group(); house.position.set(RX, 0, 0); rural.add(house);
const FL = 0.9, WH = 2.8, HX = 4, HZ = 3, WT = 0.12;
add(tbox(HX * 2, 0.15, HZ * 2, 2), M.floor, 0, FL - 0.075, 0, house);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.2, FL, 0.2), M.trunk, sx * (HX - 0.2), FL / 2, sz * (HZ - 0.2), house);
const wall = (x0, x1, y0, y1, z, mat = M.plank) => add(tbox(x1 - x0, y1 - y0, WT, 1.2), mat, (x0 + x1) / 2, (y0 + y1) / 2, z, house);
wall(-HX, HX, FL, FL + WH, -HZ);
const WY0 = 1.95, WY1 = 2.95;
wall(-HX, -0.8, FL, FL + WH, HZ); wall(-0.8, 0.8, FL, WY0, HZ); wall(-0.8, 0.8, WY1, FL + WH, HZ); wall(0.8, 2.2, FL, FL + WH, HZ); wall(3.1, HX, FL, FL + WH, HZ); wall(2.2, 3.1, 2.95, FL + WH, HZ);
add(tbox(0.9, 2.05, 0.08, 1), M.plankDark, 2.65, FL + 1.02, HZ + 0.02, house);
for (const s of [-1, 1]) { const m = add(tbox(HZ * 2, WH, WT, 1.2), M.plank, s * HX, FL + WH / 2, 0, house); m.rotation.y = Math.PI / 2; }
for (const [x, y, w, h] of [[0, WY0, 1.8, 0.1], [0, WY1, 1.8, 0.1], [-0.85, (WY0 + WY1) / 2, 0.1, 1.1], [0.85, (WY0 + WY1) / 2, 0.1, 1.1]]) add(box(w, h, 0.2), M.trunk, x, y, HZ + 0.05, house);
for (const s of [-1, 1]) { const sh = add(tbox(0.8, 1.0, 0.05, 1), M.plankDark, s * 1.32, (WY0 + WY1) / 2, HZ + 0.25, house); sh.rotation.y = -s * 0.5; }
// window-sill lamp glow (seen from outside)
{ const shape = new THREE.Shape(); shape.moveTo(-HX - 0.6, 0); shape.lineTo(HX + 0.6, 0); shape.lineTo(0, 2.0); shape.closePath();
  for (const z of [-HZ - WT / 2, HZ - WT / 2]) add(new THREE.ExtrudeGeometry(shape, { depth: WT, bevelEnabled: false }), M.plank, 0, FL + WH, z, house);
  for (const s of [-1, 1]) { const rf = add(tbox(Math.hypot(HX + 0.9, 2.1), 0.12, HZ * 2 + 1.2, 2), M.roof, s * (HX + 0.6) / 2, FL + WH + 1.0, 0, house); rf.rotation.z = -s * Math.atan2(2.0, HX + 0.6); }
  add(tbox(HX * 2, 0.08, HZ * 2, 2), M.plankDark, 0, FL + WH - 0.04, 0, house); }
add(tbox(HX * 2, 0.12, 1.4, 2), M.floor, 0, FL - 0.06, HZ + 0.7, house);
for (let i = 0; i < 3; i++) add(tbox(1.1, 0.1, 0.35, 1), M.plankDark, 2.65, FL - 0.3 - i * 0.28, HZ + 1.55 + i * 0.3, house);
// interior
const table = new THREE.Group(); table.position.set(-0.2, FL, 0.6); house.add(table);
add(tbox(1.6, 0.07, 0.9, 1), M.plank, 0, 0.72, 0, table); for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(0.07, 0.72, 0.07), M.trunk, sx * 0.72, 0.36, sz * 0.38, table);
const stove = new THREE.Group(); stove.position.set(2.6, FL, -2.0); house.add(stove);
add(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 16), M.clay, 0, 0.3, 0, stove);
const coals = add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 16), glow('#ff6a24'), 0, 0.6, 0, stove, { cast: false });
add(new THREE.SphereGeometry(0.42, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2.6), M.wok, 0, 0.98, 0, stove);
add(tbox(1.4, 0.8, 0.6, 1), M.plankDark, -0.9, 0.4, 0, stove);
const shelf = new THREE.Group(); shelf.position.set(-2.1, FL, -HZ + 0.3); house.add(shelf);
for (let i = 0; i < 4; i++) add(tbox(3.4, 0.05, 0.4, 1), M.plank, 0, 0.5 + i * 0.55, 0, shelf);
for (const s of [-1, 1]) add(tbox(0.06, 2.3, 0.4, 1), M.plank, s * 1.7, 1.15, 0, shelf);
const shelfBowls = [];
for (let i = 0; i < 104; i++) { const lv = Math.floor(i / 26), k = i % 26; const b = bowl3(shelf, -1.56 + k * 0.125, 0.53 + lv * 0.55, ((k + lv) % 2) * 0.1 - 0.05, 0.6); b.visible = false; shelfBowls.push(b); }
const cabinet = add(tbox(0.6, 1.8, 0.9, 1), M.plankDark, -3.55, FL + 0.9, 0.9, house);
add(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), M.metal, -0.2, FL + WH - 0.25, 0.6, house, { cast: false });
add(new THREE.SphereGeometry(0.13, 12, 10), glow('#ffd58a'), -0.2, FL + WH - 0.55, 0.6, house, { cast: false });
const tableBowl = bowl3(table, 0.45, 0.76, 0.1, 1.2);
// ---- the recipe book (3D) ----
const book = new THREE.Group(); book.position.set(-0.3, 0.76, 0.05); table.add(book); book.rotation.y = 0.15;
const coverTex = (() => { const [c, g] = cv(512, 640); g.fillStyle = '#7a2f2a'; g.fillRect(0, 0, 512, 640); g.strokeStyle = '#d9b86a'; g.lineWidth = 10; g.strokeRect(26, 26, 460, 588);
  g.fillStyle = '#e9d6a6'; g.fillRect(70, 190, 372, 200); g.fillStyle = '#5a1e1a'; g.font = `112px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('สูตรลาบ', 256, 290);
  const r = P.rng(4); for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(40,20,10,.14)'; g.fillRect(r() * 512, r() * 640, 30, 6); } return clampTex(c); })();
const pageTex = (n) => { const [c, g] = cv(512, 640); g.fillStyle = '#f1e6cc'; g.fillRect(0, 0, 512, 640); g.strokeStyle = 'rgba(120,90,50,.25)'; g.lineWidth = 2;
  for (let y = 90; y < 620; y += 38) { g.beginPath(); g.moveTo(40, y); g.lineTo(472, y); g.stroke(); }
  if (n < 5) { g.fillStyle = '#3a2a20'; g.font = `48px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const L = [['ข้าวคั่ว', 'พริกป่น', 'สะระแหน่', 'หอมแดง'], ['ห้ามบอกใคร', 'คั่วให้หอม', 'บีบมะนาว', 'ชิมก่อน'], ['ไฟอ่อน', 'สับละเอียด', 'น้ำปลา', 'ค่อยๆ ใส่']][n % 3];
    L.forEach((t, i) => g.fillText(t, 60, 140 + i * 76));
    g.strokeStyle = '#7a2f2a'; g.lineWidth = 5; g.beginPath(); g.ellipse(360, 520, 70, 40, 0.2, 0, 7); g.stroke(); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#c2402c' : '#4f9a3a'; g.beginPath(); g.ellipse(330 + i * 14, 515 + (i % 2) * 8, 9, 5, i, 0, 7); g.fill(); } }
  return clampTex(c); };
const BW = 0.34, BD = 0.44;
const pageGeo = new THREE.PlaneGeometry(BW, BD); pageGeo.translate(BW / 2, 0, 0); pageGeo.rotateX(-Math.PI / 2);
const coverM = toon({ color: '#6a2622' });
add(tbox(BW, 0.06, BD, 1), M.cream, BW / 2, 0.03, 0, book);
add(box(BW + 0.02, 0.012, BD + 0.02), coverM, BW / 2, 0.0, 0, book);
const leftBlock = add(tbox(BW, 0.06, BD, 1), M.cream, -BW / 2, 0.03, 0, book);
const leftCover = add(box(BW + 0.02, 0.012, BD + 0.02), coverM, -BW / 2, 0.0, 0, book);
const coverPivot = new THREE.Group(); coverPivot.position.set(0, 0.066, 0); book.add(coverPivot);
add(box(BW + 0.02, 0.012, BD + 0.02), [coverM, coverM, toon({ map: coverTex }), toon({ color: '#efe3c6' }), coverM, coverM], BW / 2 + 0.01, 0, 0, coverPivot);
const pages = [0, 1, 2, 3, 4].map((i) => { const pv = new THREE.Group(); pv.position.set(0, 0.062 + i * 0.0006, 0); book.add(pv);
  add(pageGeo, new THREE.MeshToonMaterial({ gradientMap: grad, map: pageTex(i), side: THREE.DoubleSide }), 0, 0, 0, pv, { cast: false }); pv.visible = false; return pv; });
const flat = (map, x, y) => { const m = add(new THREE.PlaneGeometry(BW, BD), new THREE.MeshToonMaterial({ gradientMap: grad, map, transparent: true, alphaTest: 0.5 }), x, y, 0, book, { cast: false }); m.rotation.x = -Math.PI / 2; return m; };
const leftPage = flat(pageTex(1), -BW / 2, 0.0612), rightPage = flat(pageTex(2), BW / 2, 0.0612);
const rightBlank = pageTex(5), rightFull = rightPage.material.map;
const tornTex = (() => { const [c, g] = cv(512, 640); g.fillStyle = '#fbf3df'; g.beginPath(); g.moveTo(0, 0); const pts = []; for (let y = 0; y <= 640; y += 26) pts.push([70 + ((y / 26) % 2) * 46 + ((y * 7) % 13), y]); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(0, 640); g.closePath(); g.fill();
  g.strokeStyle = '#241726'; g.lineWidth = 7; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.fillStyle = 'rgba(36,23,38,.25)'; g.fillRect(118, 0, 394, 640); return clampTex(c); })();
const tornStub = flat(tornTex, BW / 2, 0.0625);
// ---- roadside spot: sack + cardboard ----
const roadside = new THREE.Group(); roadside.position.set(RX + 14, 0, 15.6); rural.add(roadside);
{ const s = add(new THREE.SphereGeometry(0.45, 14, 10), M.sack, -0.8, 0.4, -0.2, roadside); s.scale.set(1, 1.2, 0.85);
  add(new THREE.ConeGeometry(0.2, 0.3, 8), M.sack, -0.8, 1.0, -0.2, roadside);
  const bk = new THREE.Group(); bk.position.set(0.6, 0.0, 0.35); roadside.add(bk); bk.rotation.y = -0.4;
  add(box(0.36, 0.1, 0.46), M.cream, 0, 0.05, 0, bk); add(box(0.38, 0.014, 0.48), [coverM, coverM, toon({ map: coverTex }), coverM, coverM, coverM], 0, 0.107, 0, bk);
  add(new THREE.SphereGeometry(0.3, 8, 6), toon({ color: '#9a948a' }), 1.5, 0.1, -0.6, roadside).scale.y = 0.5; }

// ---------- cards (2D cast + fx) ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    const [c, g] = cv(CW, CH); this.c = c; this.g = g;
    this.t = new THREE.CanvasTexture(c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) { if (key === this.key) return; this.key = key; const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0); const p = new T.Pen(g); fn(p, g); this.t.needsUpdate = true; }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- post: ink + lens ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 2.5 },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 }, dark: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash, dark; uniform vec3 lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(4./d, .55, 1.3);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue; if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(60., 400., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb; float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash); c *= 1. - dark;
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 3000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<40;i++){ float fi = float(i); float r = sqrt((fi+.5)/40.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame ----------
const tmpV = new THREE.Vector3();
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3), easeInOut = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
function applyLight(L) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0; skyU.stars.value = L.stars || 0;
  inkU.sat.value = L.sat ?? 1.08; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000'); inkU.vig.value = L.vig ?? 0.22;
  points.forEach((p, i) => { const q = (L.points || [])[i]; if (!q) { p.intensity = 0; p.visible = false; return; } p.visible = true; p.position.set(...q.pos); p.color.set(q.col); p.intensity = q.i; p.distance = q.d ?? 14; p.decay = q.decay ?? 1.4; });
}
function placeSun(L, focus) {
  const az = (L.az * Math.PI) / 180, el = (L.el * Math.PI) / 180; tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 20, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
function worldState(S, f) {
  city.visible = S.area === 'city'; rural.visible = S.area === 'rural';
  const t = f / 30;
  coals.material.color.setHSL(0.05, 1, 0.5 + 0.08 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23));
  palms.forEach((p, i) => { p.rotation.z = 0.03 * Math.sin(t * 1.3 + i) * (S.wind ?? 1); p.rotation.x = 0.02 * Math.sin(t * 1.7 + i * 2) * (S.wind ?? 1); });
  const n = S.shelf ?? 0; shelfBowls.forEach((b, i) => { b.visible = i < n; });
  changeBowls.forEach((b, i) => { const k = S.change !== undefined ? clamp((S.change - i * 0.25) / 0.5) : 0; b.visible = k > 0; b.position.set(-0.05 - (1 - easeOut(k)) * 0.7, 0.94, -0.45 + i * 0.42); });
  const pk = S.pile ?? 0; pile.visible = pk > 0; pile.children.forEach((b, i) => { const k = clamp(pk * 1.6 - (i / 20) * 0.8); b.visible = k > 0; b.position.y = Math.floor(Math.sqrt(i)) * 0.13 + (1 - easeOut(k)) * 1.6; });
  crate.visible = S.crate !== false;
  tableBowl.visible = !!S.tableBowl; tableBowl.userData.lid.visible = !S.tableBowlOpen; tableBowl.userData.food.visible = !!S.tableBowlOpen;
  const B = S.book || {}; book.visible = B.show !== false;
  const open = clamp(B.open ?? 0); coverPivot.rotation.z = open * Math.PI * 0.985;
  const isOpen = open > 0.98; leftBlock.visible = leftCover.visible = leftPage.visible = rightPage.visible = isOpen;
  pages.forEach((pv, i) => { const k = B.flip !== undefined ? clamp(B.flip * 5 - i) : 0; pv.visible = isOpen && k > 0 && k < 1; pv.rotation.z = easeInOut(k) * Math.PI * 0.98; });
  tornStub.visible = isOpen && !!B.torn; rightPage.material.map = B.torn ? rightBlank : rightFull;
}
function drawActors(list) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i); c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1) * (a.sx || 1), s * (a.sy || 1), s);
    c.mesh.rotation.set(a.pitch || 0, a.yawAbs ?? (Math.atan2(camera.position.x - a.x, camera.position.z - a.z) + (a.yaw || 0)), a.roll || 0, 'YXZ');
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false; c.mesh.renderOrder = a.order || 2;
    c.mat.depthTest = a.depthTest !== false;
    if (a.ground !== undefined && a.blob !== false) { c.blob.visible = true; c.blob.position.set(a.x, a.ground + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}
const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip || o === sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else { o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; } }
  });
};
const toScreen = (p) => { tmpV.set(...p).project(camera); return [(tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * H, tmpV.z < 1]; };

window.renderFrame = (f) => {
  const st = frameState(f, T);
  const S = st.world, L = st.light, C = st.cam;
  applyLight(L);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ((C.roll || 0) * Math.PI / 180);
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  worldState(S, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors(st.actors);
  sky.position.copy(camera.position);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  inkU.flash.value = C.flash || 0; inkU.dark.value = C.dark || 0;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  const D = st.dof || { focus: 5, cinf: 0 };
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  og.setTransform(1, 0, 0, 1, 0, 0); og.globalAlpha = 1; og.drawImage(glc, 0, 0);
  if (st.overlay) { og.save(); st.overlay(og, { toScreen, W, H, FONT, f }); og.restore(); }
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
