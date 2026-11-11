import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { TOTAL, shotAt, camAt, dofAt, lightFor, actorsAt, worldAt, fxAt } from './story.js';

const QS = new URLSearchParams(location.search);
const W = +(QS.get('w') || 1080), H = Math.round(W * 16 / 9), RS = W / 1080;
try { await document.fonts.load('700 40px Prompt'); } catch (e) { console.log('font load failed', e.message); }
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
// ---------- ink / normal-depth contract ----------
const NOINK = 'noink'; // userData flag: never outlined (cards, fx, water handled specially)
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ======================= WORLD: city avenue + plaza + stadium lot =======================
const GROUND = 0;
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const decal = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
const col = (c) => toon({ color: c });
const asphaltCanvas = () => { const c = cvs(256, 256), g = c.getContext('2d'); g.fillStyle = '#585a60'; g.fillRect(0, 0, 256, 256); const r = P.rng(5);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < .5 ? 20 : 210},${r() < .5 ? 20 : 210},${r() < .5 ? 24 : 215},${0.04 + r() * 0.06})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); } return c; };
const roadCanvas = () => { const c = asphaltCanvas(), g = c.getContext('2d'); g.fillStyle = '#f2c230'; for (let x = 0; x < 256; x += 128) g.fillRect(x + 8, 124, 78, 8);
  g.fillStyle = '#eceae2'; g.fillRect(0, 10, 256, 5); g.fillRect(0, 241, 256, 5); return c; };
const facadeCanvas = (base, seed, lit) => { const c = cvs(256, 256), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256); const r = P.rng(seed);
  g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 232, 256, 24);
  g.fillStyle = '#efe8d6'; g.fillRect(40, 36, 176, 150); g.fillStyle = r() < lit ? '#ffe08a' : (r() < .5 ? '#2c3e57' : '#3a5472'); g.fillRect(50, 46, 156, 130);
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(50, 46, 46, 130); g.fillStyle = '#efe8d6'; g.fillRect(124, 46, 8, 130); g.fillRect(50, 108, 156, 6);
  g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(36, 186, 184, 12); return c; };
const pitchCanvas = () => { const c = cvs(256, 256), g = c.getContext('2d'); g.fillStyle = '#4c9640'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#58a649'; g.fillRect(0, 0, 256, 128);
  const r = P.rng(3); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${r() < .5 ? 0 : 255},${r() < .5 ? 40 : 255},0,0.035)`; g.fillRect(r() * 256, r() * 256, 2, 2); } return c; };
const netCanvas = () => { const c = cvs(128, 128), g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } return c; };

const M = {
  road: decal(texM(roadCanvas(), 60, 1)), ground: col('#8e8c84'), plaza: decal(texM(P.stone(11, 40, 8, 74), 7, 7)), grassLot: col('#3d7c37'),
  pitch: decal(texM(pitchCanvas(), 8.5, 5.5)), white: decal(col('#f4f4ee')), side: col('#b7b2a6'),
  net: new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(netCanvas(), 4, 2), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
  roofSlab: col('#6a645c'), metal: col('#8a8f98'), dark: col('#2b2d33'), olive: col('#6f7f45'), oliveD: col('#55633a'), glass: new THREE.MeshBasicMaterial({ color: '#8fd3ff' }),
  carRed: col('#d6322f'), carWhite: col('#f1efe6'), flame: new THREE.MeshBasicMaterial({ color: '#ffb12b' }), lamp: new THREE.MeshBasicMaterial({ color: '#fff1b0' }),
  robot: col('#8fa8c8'), robotD: col('#45506a'), robotW: col('#e8ecf2'), eye: new THREE.MeshBasicMaterial({ color: '#58f0ff' }),
  gunM: col('#33363c'), wood2: col('#8a5e38'), parch: col('#f2e3bd'), tracer: new THREE.MeshBasicMaterial({ color: '#ffe46a' }), flash: new THREE.MeshBasicMaterial({ color: '#fff0a0' }),
  rubble: col('#6d675d'), rubble2: col('#8a8276'), burnt: col('#2e2a28'), crater: col('#2b2622'), tree: col('#4f8a3a'), trunk2: col('#6a4a32'), seat: col('#3b5fa8'), seat2: col('#d9a441'),
  awn: [col('#c0452f'), col('#2f7f6a'), col('#d09a2c'), col('#3a5ea8')],
};
const WALLS = [['#d9c7a0', 11], ['#c9a98a', 12], ['#b9c7cf', 13], ['#d9b0a0', 14], ['#a9b89a', 15], ['#cfc4b5', 16]].flatMap(([b, s]) => [texM(facadeCanvas(b, s, 0.15), 1, 1), texM(facadeCanvas(b, s + 20, 0.5), 1, 1)]);

const world = new THREE.Group(); scene.add(world);
const rnd = P.rng(21);
const ground = add(new THREE.PlaneGeometry(2600, 2600), M.ground, 0, GROUND, 0, world, { cast: false }); ground.rotation.x = -Math.PI / 2;
const road = add(new THREE.PlaneGeometry(900, 16), M.road, 0, 0.012, 0, world, { cast: false }); road.rotation.x = -Math.PI / 2;
const plaza = add(new THREE.CircleGeometry(22, 56), M.plaza, 0, 0.014, 0, world, { cast: false }); plaza.rotation.x = -Math.PI / 2;
for (const s of [-1, 1]) add(box(900, 0.22, 4), M.side, 0, 0.1, s * 10, world, { cast: false });

// buildings
const buildings = [];
const addBuilding = (x, z, w, d, h, rotY, full) => {
  const sd = z < 0 ? -1 : 1;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; world.add(g);
  const body = add(tbox(w, h, d, 4), WALLS[Math.floor(rnd() * WALLS.length)], 0, h / 2, 0, g, { cast: full });
  if (full) {
    add(box(w + 0.6, 0.5, d + 0.6), M.roofSlab, 0, h + 0.25, 0, g);
    if (rnd() < 0.7) add(box(2.2, 1.4, 2), M.metal, (rnd() - 0.5) * w * 0.4, h + 1.2, (rnd() - 0.5) * d * 0.4, g);
    add(box(w * 0.7, 0.3, 1.8), M.awn[Math.floor(rnd() * 4)], 0, 3.5, d / 2 + 0.9, g);
  }
  buildings.push({ g, rotY, th: rnd(), tiltX: sd * (0.03 + rnd() * 0.1), tiltZ: (rnd() - 0.5) * 0.08, sink: 1 + rnd() * h * 0.12, h });
};
for (const side of [-1, 1]) {
  let x = -150; while (x < 150) { const w = 8 + rnd() * 8, d = 10 + rnd() * 6, h = 10 + rnd() * 32; x += w / 2;
    const zc = (x + w / 2 > -27 && x - w / 2 < 27) ? 30 : 9.8; if (!(x + w / 2 > 70 && x - w / 2 < 190)) addBuilding(x, side * (zc + d / 2), w, d, h, side < 0 ? 0 : Math.PI, true); x += w / 2 + 1 + rnd() * 2.5; }
  x = -170; while (x < 170) { const w = 10 + rnd() * 10, d = 12 + rnd() * 10, h = 24 + rnd() * 44; x += w / 2;
    if (!(x + w / 2 > 70 && x - w / 2 < 190)) addBuilding(x, side * (44 + d / 2 + ((x + w / 2 > -27 && x - w / 2 < 27) ? 14 : 0)), w, d, h, 0, false); x += w / 2 + 2 + rnd() * 5; }
}
for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, dist = 190 + rnd() * 80; if (Math.cos(a) * dist > 60 && Math.cos(a) * dist < 200 && Math.abs(Math.sin(a) * dist) < 80) continue;
  addBuilding(Math.cos(a) * dist, Math.sin(a) * dist, 16 + rnd() * 16, 16 + rnd() * 16, 50 + rnd() * 80, rnd() * 3, false); }
// lamps + trees
for (const s of [-1, 1]) for (let x = -120; x <= 120; x += 15) { if (Math.abs(x) < 24 && s > 0) continue;
  add(new THREE.CylinderGeometry(0.1, 0.14, 6.4, 6), M.dark, x, 3.2, s * 8.6, world, { cast: false });
  add(new THREE.SphereGeometry(0.34, 8, 6), M.lamp, x, 6.5, s * 8.6, world, { cast: false }); }
for (const s of [-1, 1]) for (let x = -112; x <= 112; x += 21) { if (Math.abs(x) < 24) continue; const tr = new THREE.Group(); tr.position.set(x, 0, s * 8.8); world.add(tr);
  add(new THREE.CylinderGeometry(0.2, 0.28, 3.2, 7), M.trunk2, 0, 1.6, 0, tr); add(new THREE.SphereGeometry(2.0, 10, 8), M.tree, 0, 4.4, 0, tr); }
// rubble (appears with ruin)
const rubble = [];
for (let i = 0; i < 70; i++) { const side = rnd() < 0.5 ? -1 : 1, x = -90 + rnd() * 180, z = side * (3 + rnd() * 13) * (rnd() < 0.5 ? 1 : 0.4), s = 0.5 + rnd() * 2.2;
  const m = add(new THREE.DodecahedronGeometry(s, 0), rnd() < 0.5 ? M.rubble : M.rubble2, x, s * 0.5, z, world); m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); m.scale.y = 0.6; m.userData.th = rnd(); m.userData.s = 1; rubble.push(m); }
for (const [x, z, r] of [[-14, 3, 3.6], [11, -4, 4.2], [26, 2, 3.4], [-30, -3, 3.8], [42, -2, 4.4]]) { const c = add(new THREE.CircleGeometry(r, 20), M.crater, x, 0.02, z, world, { cast: false }); c.rotation.x = -Math.PI / 2; c.userData.crater = true; c.userData.th = 0.5 + (x % 5) * 0.05; rubble.push(c); }

// ---- stadium lot at x=130 ----
const PX = 130, pitch = new THREE.Group(); pitch.position.set(PX, 0, 0); world.add(pitch);
const lot = add(new THREE.PlaneGeometry(130, 96), M.grassLot, 0, 0.008, 0, pitch, { cast: false }); lot.rotation.x = -Math.PI / 2;
const pf = add(new THREE.PlaneGeometry(68, 44), M.pitch, 0, 0.016, 0, pitch, { cast: false }); pf.rotation.x = -Math.PI / 2;
const line = (w, d, x, z) => add(box(w, 0.02, d), M.white, x, 0.03, z, pitch, { cast: false });
line(68, 0.18, 0, 22); line(68, 0.18, 0, -22); line(0.18, 44, 34, 0); line(0.18, 44, -34, 0); line(0.18, 44, 0, 0);
for (const s of [-1, 1]) { line(0.18, 20, s * 17.5, 0); line(5.5, 0.18, s * 31.2, 5.5); line(5.5, 0.18, s * 31.2, -5.5); line(0.18, 11, s * 28.5, 0); }
{ const c = add(new THREE.RingGeometry(8.8, 9.0, 48), M.white, 0, 0.03, 0, pitch, { cast: false }); c.rotation.x = -Math.PI / 2; }
const goal = (s) => { const g = new THREE.Group(); g.position.set(s * 34, 0, 0); pitch.add(g);
  for (const z of [-3.66, 3.66]) add(new THREE.CylinderGeometry(0.1, 0.1, 2.44, 8), M.white, 0, 1.22, z, g);
  add(new THREE.CylinderGeometry(0.1, 0.1, 7.5, 8), M.white, 0, 2.44, 0, g).rotation.x = Math.PI / 2;
  add(new THREE.PlaneGeometry(7.3, 2.44), M.net, s * 2.2, 1.22, 0, g, { cast: false }).rotation.y = Math.PI / 2;
  for (const z of [-3.66, 3.66]) { const sn = add(new THREE.PlaneGeometry(2.2, 2.44), M.net, s * 1.1, 1.22, z, g, { cast: false }); }
  return g; };
goal(1); goal(-1);
// stands (damaged) + floodlights
for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const st = add(tbox(66, 1.0, 3, 2), i % 2 ? M.seat : M.seat2, 0, 0.5 + i * 1.0, s * (27 + i * 3), pitch); st.rotation.z = (rnd() - 0.5) * 0.03; st.scale.x = 0.7 + rnd() * 0.3; st.position.x = (rnd() - 0.5) * 10; }
const towers = [];
for (const [x, z] of [[-40, -28], [40, -28], [-40, 28], [40, 28]]) { const t = new THREE.Group(); t.position.set(x, 0, z); pitch.add(t);
  add(new THREE.CylinderGeometry(0.28, 0.4, 24, 8), M.metal, 0, 12, 0, t); add(tbox(5, 2.2, 0.8, 2), M.dark, 0, 24.8, 0, t); add(new THREE.SphereGeometry(0.7, 8, 6), M.lamp, 0, 24.8, 0.5, t);
  t.rotation.z = (x > 0 ? 1 : -1) * (0.05 + rnd() * 0.12); towers.push(t); }
for (let i = 0; i < 14; i++) { const m = add(new THREE.DodecahedronGeometry(0.7 + rnd() * 1.5, 0), M.rubble, (rnd() - 0.5) * 100, 0.4, (rnd() - 0.5) * 60, pitch); m.scale.y = 0.55; }
for (let i = 0; i < 4; i++) { const c = add(new THREE.CircleGeometry(1.8 + rnd() * 1.6, 18), M.crater, (rnd() - 0.5) * 50, 0.04, (rnd() - 0.5) * 30, pitch, { cast: false }); c.rotation.x = -Math.PI / 2; }
// ring of buildings behind the stadium
for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.cos(a) < -0.45) continue; addBuilding(PX + Math.cos(a) * 120, Math.sin(a) * 100, 18 + rnd() * 14, 18 + rnd() * 14, 20 + rnd() * 50, rnd() * 3, false); }

// ======================= PROPS (3D, inked) =======================
const mkProp = () => { const g = new THREE.Group(); scene.add(g); g.visible = false; return g; };
const cyl = (r0, r1, h, seg = 12) => new THREE.CylinderGeometry(r0, r1, h, seg);
// tank (barrel along +x)
const tank = mkProp(); {
  for (const z of [-1.6, 1.6]) { add(tbox(6.6, 1.0, 0.95, 2), M.dark, 0, 0.7, z, tank); for (let i = 0; i < 5; i++) add(cyl(0.42, 0.42, 0.98, 14), M.metal, -2.4 + i * 1.2, 0.55, z, tank).rotation.x = Math.PI / 2; }
  add(tbox(6.0, 1.0, 2.9, 2), M.olive, 0, 1.35, 0, tank); add(tbox(1.6, 0.8, 2.8, 2), M.olive, 3.1, 1.2, 0, tank).rotation.z = -0.45;
  const turret = new THREE.Group(); turret.position.set(-0.4, 1.9, 0); tank.add(turret);
  add(cyl(1.25, 1.4, 0.85, 18), M.olive, 0, 0.4, 0, turret); add(tbox(1.5, 0.7, 1.8, 2), M.oliveD, 0.7, 0.35, 0, turret);
  const barrel = new THREE.Group(); barrel.position.set(1.5, 0.4, 0); turret.add(barrel);
  add(cyl(0.17, 0.2, 4.4), M.dark, 2.2, 0, 0, barrel).rotation.z = Math.PI / 2; add(cyl(0.26, 0.26, 0.5), M.dark, 4.3, 0, 0, barrel).rotation.z = Math.PI / 2;
  add(cyl(0.4, 0.4, 0.25), M.metal, -0.2, 0.95, 0.3, turret); add(cyl(0.03, 0.03, 2.2, 5), M.dark, -1.0, 1.5, -0.7, turret);
  tank.userData = { turret, barrel };
}
// flying car (nose +x)
const car = mkProp(); {
  add(tbox(4.6, 0.9, 2.0, 2), M.carRed, 0, 0.9, 0, car); add(tbox(1.6, 0.5, 1.9, 2), M.carRed, 1.8, 1.25, 0, car).rotation.z = -0.25;
  add(tbox(2.2, 0.9, 1.8, 2), M.carWhite, -0.3, 1.75, 0, car); add(box(2.25, 0.5, 1.5), M.glass, -0.3, 1.8, 0, car);
  add(tbox(0.4, 0.7, 2.6, 2), M.carRed, -2.1, 1.6, 0, car);
  const flames = []; for (const x of [-1.5, 1.5]) for (const z of [-1.3, 1.3]) { add(cyl(0.38, 0.3, 0.6, 10), M.dark, x, 0.45, z, car);
    const f = add(new THREE.ConeGeometry(0.3, 1.1, 8), M.flame, x, -0.2, z, car, { cast: false }); f.rotation.x = Math.PI; f.userData.ndSkip = true; flames.push(f); }
  for (const z of [-0.6, 0.6]) add(new THREE.SphereGeometry(0.22, 8, 6), M.lamp, 2.5, 1.0, z, car, { cast: false });
  car.userData = { flames };
}
// machine gun (muzzle +x), scaled up for the cartoon
const gun = mkProp(); {
  for (const [a, z] of [[0.5, 0], [-0.4, 0.6], [-0.4, -0.6]]) { const leg = add(cyl(0.04, 0.05, 1.5, 6), M.dark, -0.3, 0.55, z, gun); leg.rotation.set(z * 0.7, 0, 0.35 + a * 0.2); }
  add(tbox(1.3, 0.42, 0.5, 1), M.gunM, 0, 1.2, 0, gun); add(cyl(0.05, 0.05, 2.0, 8), M.gunM, 1.55, 1.25, 0, gun).rotation.z = Math.PI / 2;
  add(cyl(0.11, 0.11, 1.0, 8), M.dark, 1.0, 1.25, 0, gun).rotation.z = Math.PI / 2; add(tbox(0.5, 0.4, 0.4, 1), M.olive, -0.2, 0.95, 0.4, gun); add(tbox(0.6, 0.12, 0.2, 1), M.metal, -0.7, 1.28, 0, gun);
  const fl = add(new THREE.ConeGeometry(0.35, 1.2, 7), M.flash, 3.0, 1.25, 0, gun, { cast: false }); fl.rotation.z = -Math.PI / 2; fl.userData.ndSkip = true;
  gun.userData = { fl };
}
// tracers
const tracers = []; for (let i = 0; i < 28; i++) { const m = add(cyl(0.07, 0.07, 3.0, 5), M.tracer, 0, 0, 0, scene, { cast: false }); m.visible = false; m.userData.ndSkip = true; tracers.push(m); }
// robot (faces +x)
const robot = mkProp(); {
  const legs = [], arms = [];
  for (const z of [-0.95, 0.95]) { const hip = new THREE.Group(); hip.position.set(0, 4.0, z); robot.add(hip);
    add(tbox(0.9, 1.9, 0.9, 2), M.robot, 0, -0.9, 0, hip); const knee = new THREE.Group(); knee.position.set(0, -1.9, 0); hip.add(knee);
    add(new THREE.SphereGeometry(0.5, 8, 6), M.robotD, 0, 0, 0, knee); add(tbox(0.8, 1.9, 0.8, 2), M.robotW, 0, -1.0, 0, knee); add(tbox(1.9, 0.5, 1.1, 2), M.robotD, 0.45, -2.1, 0, knee); legs.push({ hip, knee }); }
  add(tbox(1.8, 0.9, 3.0, 2), M.robotD, 0, 4.4, 0, robot); add(tbox(2.6, 2.8, 3.4, 2), M.robot, 0, 6.2, 0, robot); add(tbox(0.3, 1.5, 2.2, 1), M.robotW, 1.35, 6.4, 0, robot);
  add(tbox(0.3, 0.6, 1.4, 1), M.eye, 1.38, 6.9, 0, robot, { cast: false });
  for (const z of [-2.2, 2.2]) { const sh = new THREE.Group(); sh.position.set(0, 7.0, z); robot.add(sh); add(new THREE.SphereGeometry(0.85, 10, 8), M.robotD, 0, 0, 0, sh);
    add(tbox(0.8, 2.0, 0.8, 2), M.robot, 0, -1.2, 0, sh); const el = new THREE.Group(); el.position.set(0, -2.2, 0); sh.add(el); add(tbox(1.0, 1.9, 1.0, 2), M.robotW, 0.2, -0.9, 0, el); add(tbox(1.4, 1.3, 1.4, 2), M.robotD, 0.2, -2.1, 0, el); arms.push({ sh, el }); }
  add(tbox(1.9, 1.5, 2.0, 2), M.robot, 0.2, 8.4, 0, robot); add(tbox(0.2, 0.5, 1.5, 1), M.eye, 1.2, 8.6, 0, robot, { cast: false });
  add(cyl(0.06, 0.06, 1.4, 5), M.dark, 0, 9.8, 0, robot); add(new THREE.SphereGeometry(0.22, 8, 6), M.flame, 0, 10.5, 0, robot, { cast: false });
  robot.userData = { legs, arms };
}
// sign board (rules)
const boardCv = cvs(800, 1000), boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
const board = mkProp(); {
  add(tbox(5.6, 7.0, 0.5, 2), M.wood2, 0, 4.2, 0, board); add(new THREE.PlaneGeometry(5.0, 6.25), new THREE.MeshBasicMaterial({ map: boardTex }), 0, 4.2, 0.27, board, { cast: false });
  for (const x of [-2.2, 2.2]) add(cyl(0.2, 0.2, 4.2, 8), M.wood2, x, 1.0, -0.1, board);
}
let boardKey = -1;
const drawBoard = (idx, lines) => { if (idx === boardKey) return; boardKey = idx; const g = boardCv.getContext('2d'); g.fillStyle = '#f2e3bd'; g.fillRect(0, 0, 800, 1000);
  g.strokeStyle = '#8a5e38'; g.lineWidth = 22; g.strokeRect(16, 16, 768, 968); g.textAlign = 'center'; g.fillStyle = '#c0392b'; g.font = '700 190px Prompt'; g.fillText(lines[0], 400, 270);
  g.fillStyle = '#2a1f1a'; g.font = '700 100px Prompt'; lines.slice(1).forEach((t, i) => g.fillText(t, 400, 480 + i * 140)); boardTex.needsUpdate = true; };
// poster on a ruined wall
const posterCv = cvs(600, 1000), posterTex = new THREE.CanvasTexture(posterCv); posterTex.colorSpace = THREE.SRGBColorSpace;
const poster = mkProp(); {
  add(tbox(13, 17, 1.2, 2), M.rubble2, 0, 8.5, 0, poster); add(new THREE.PlaneGeometry(9, 15), new THREE.MeshBasicMaterial({ map: posterTex }), 0, 8.8, 0.65, poster, { cast: false });
  for (let i = 0; i < 6; i++) { const m = add(new THREE.DodecahedronGeometry(0.8 + rnd(), 0), M.rubble, (rnd() - 0.5) * 12, 0.5, 1.5 + rnd() * 2, poster); m.scale.y = 0.6; }
}
{ const g = posterCv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 1000); gr.addColorStop(0, '#1b2a6b'); gr.addColorStop(1, '#e8743b'); g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
  g.fillStyle = '#ffd23f'; g.textAlign = 'center'; g.font = '700 74px Prompt'; g.fillText('สุดยอดกองหน้า', 300, 110); g.fillText('แห่งยุค', 300, 195);
  g.save(); g.translate(0, 80); g.scale(0.9, 0.9); g.translate(30, 40); const pen = new T.Pen(g); T.romanFront(pen, 'kitA', { expr: 'grin', bow: 46, L: 'up', R: 'hip', blink: 0 }); g.restore(); posterTex.needsUpdate = true; }

// sky crack (opaque cut-out far behind everything)
const crackCv = cvs(540, 960), crackTex = new THREE.CanvasTexture(crackCv); crackTex.colorSpace = THREE.SRGBColorSpace;
const crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: crackTex, alphaTest: 0.5, fog: false, side: THREE.DoubleSide }));
crack.userData.ndSkip = true; crack.visible = false; scene.add(crack);
let crackKey = -1;
const CR = (() => { const r = P.rng(77), segs = []; const grow = (x, y, a, n, lvl) => { for (let i = 0; i < n; i++) { const nx = x + Math.cos(a) * (30 + r() * 40), ny = y + Math.sin(a) * (30 + r() * 40); segs.push([x, y, nx, ny, lvl, i]); x = nx; y = ny; a += (r() - 0.5) * 1.1; if (r() < 0.22 && lvl < 2) grow(x, y, a + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.6), 6 + Math.floor(r() * 6), lvl + 1); } };
  for (const [x, y, a] of [[270, 40, 1.6], [150, 20, 1.2], [400, 30, 1.9], [270, 10, 1.45]]) grow(x, y, a, 16, 0); return segs; })();
const drawCrack = (k) => { const kq = Math.round(k * 50); if (kq === crackKey) return; crackKey = kq; const g = crackCv.getContext('2d'); g.clearRect(0, 0, 540, 960);
  const n = Math.floor(CR.length * Math.min(1, k)); g.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < n; i++) { const [x0, y0, x1, y1, lvl] = CR[i]; g.strokeStyle = pass === 0 ? '#151018' : pass === 1 ? '#ffd23f' : '#ffffff'; g.lineWidth = (pass === 0 ? 26 : pass === 1 ? 16 : 7) / (1 + lvl * 0.5) * (0.6 + k * 0.5); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  crackTex.needsUpdate = true; };

// ---- per-frame world state ----
const clampN = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const applyRuin = (r) => {
  for (const b of buildings) { const p = clampN((r - b.th * 0.6) / 0.4), e = p * p * (3 - 2 * p); b.g.rotation.set(b.tiltX * e, b.rotY, b.tiltZ * e); b.g.position.y = -e * b.sink; b.g.scale.y = 1 - 0.3 * e * b.th; }
  for (const m of rubble) { const p = clampN((r - m.userData.th * 0.6) / 0.35); m.visible = p > 0; if (m.userData.crater) m.scale.setScalar(Math.max(0.01, p)); else m.scale.set(p, p * 0.6, p); }
};
const applyProps = (Wd) => {
  const t = Wd.tank; tank.visible = !!t; if (t) { tank.position.set(t.x, t.y, t.z); tank.rotation.set(0, t.ry, t.rz || 0); tank.scale.set(t.s * 1.0, t.s * (t.sy ?? 1), t.s); tank.userData.turret.rotation.y = t.tr || 0; tank.userData.barrel.position.x = 1.5 - (t.recoil || 0); }
  const c = Wd.car; car.visible = !!c; if (c) { car.position.set(...c.pos); car.rotation.set(c.rx || 0, c.ry, c.rz || 0); car.scale.setScalar(c.s || 1.5); car.userData.flames.forEach((f, i) => f.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(c.t * 1.7 + i)), 1)); }
  const gn = Wd.gun; gun.visible = !!gn; if (gn) { gun.position.set(gn.x, 0, gn.z); gun.rotation.set(0, gn.ry, gn.pitch || 0); gun.scale.setScalar(1.8); gun.userData.fl.visible = !!gn.flash; gun.userData.fl.scale.setScalar(0.7 + 0.5 * (gn.flash || 0)); }
  tracers.forEach((m, i) => { const tr = Wd.tracers && Wd.tracers[i]; m.visible = !!tr; if (tr) { m.position.set(...tr.pos); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...tr.dir).normalize()); } });
  const rb = Wd.robot; robot.visible = !!rb; if (rb) { robot.position.set(rb.x, rb.y || 0, rb.z); robot.rotation.set(0, rb.ry || 0, rb.rz || 0); robot.scale.setScalar(rb.s || 1);
    const sw = rb.walk || 0; robot.userData.legs.forEach((l, i) => { const s = Math.sin(sw + i * Math.PI); l.hip.rotation.z = s * 0.55; l.knee.rotation.z = Math.max(0, -s) * 0.7 + (rb.knee || 0); });
    robot.userData.arms.forEach((a, i) => { const s = Math.sin(sw + (1 - i) * Math.PI); a.sh.rotation.z = s * 0.5 + (rb.arm || 0); a.el.rotation.z = -0.5 - Math.abs(s) * 0.3; }); }
  const bd = Wd.board; board.visible = !!bd; if (bd) { board.position.set(...bd.pos); board.rotation.y = bd.ry || 0; board.scale.setScalar(bd.s || 1); drawBoard(bd.idx, bd.lines); }
  poster.visible = !!Wd.poster; if (Wd.poster) { poster.position.set(...Wd.poster.pos); poster.rotation.y = Wd.poster.ry || 0; }
};
// ---------- cards (2D characters in the 3D world). hi = close-ups, lo = crowd / fx ----------
const CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(hi) {
    this.CW = hi ? 1200 : 480; this.CH = hi ? 2000 : 800;
    this.c = document.createElement('canvas'); this.c.width = this.CW; this.c.height = this.CH; this.g = this.c.getContext('2d');
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = hi ? 4 : 1;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.CW, this.CH);     g.setTransform(this.CW / 600, 0, 0, this.CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const POOL = { hi: [], lo: [] };
const getCard = (kind, i) => POOL[kind][i] || (POOL[kind][i] = new Card(kind === 'hi'));
// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
// final copy with sRGB handled by the renderer output (we render to screen with linear->sRGB in the shader chunk)
dofScene.children[0].material.toneMapped = false;
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}
const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};
// ---------- clouds ----------
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 650 + r() * 250; m.position.set(Math.cos(a) * d, 120 + r() * 160, Math.sin(a) * d); m.scale.setScalar(160 + r() * 140);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }

function drawActors(list, cam) {
  POOL.hi.forEach((c) => { c.mesh.visible = c.blob.visible = false; }); POOL.lo.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  const n = { hi: 0, lo: 0 };
  list.forEach((a) => {
    const kind = a.hi ? 'hi' : 'lo', c = getCard(kind, n[kind]++);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y + (a.bobY || 0), a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), (a.roll || 0) * Math.PI / 180);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? GROUND) + 0.025, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}
const fwd = new THREE.Vector3();
window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const Wd = worldAt(f); applyRuin(Wd.ruin || 0); applyProps(Wd);
  crack.visible = (Wd.crack || 0) > 0;
  if (crack.visible) { drawCrack(Wd.crack); camera.getWorldDirection(fwd); crack.position.copy(camera.position).addScaledVector(fwd, 900); crack.quaternion.copy(camera.quaternion);
    const h = 2 * 900 * Math.tan(rx(camera.fov / 2)) * 1.05; crack.scale.set(h * (W / H), h, 1); }
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5 * RS; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = (D.cinf || 0) * RS; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
