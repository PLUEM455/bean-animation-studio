import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1440, H = 1080, DURATION = 6;
const YEARS = [2022, 2023, 2024, 2025, 2026];
const VALUES = ['120K', '180K', '260K', '310K', '440K'];
const COUNTS = [12, 18, 26, 31, 44];            // 1 cup = 10,000
const ACCENTS = [0xff8a5c, 0xffc247, 0x6ee0b0, 0x62b8ff, 0xc08bff];
const SPACING = 2.25, PITCH = 0.125, CUP_H = 1.3, RT = 0.55, RB = 0.39;
const CUP_GAP = 0.075, FALL = 0.45, FALL_H = 1.9, START0 = 0.2, START_STEP = 0.12;
const TITLE_BOTTOM_PX = 190;                       // cups must stay below this screen y

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(27, W / H, 1, 100);

// lights: soft key + cool fill
const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
key.position.set(-7, 14, 8); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 7; key.shadow.blurSamples = 20;
Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
key.target.position.set(0, 2, 0); scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x9bb4ff, 0x1a2350, 0.7));
const rim = new THREE.DirectionalLight(0x7fa8ff, 0.8); rim.position.set(8, 6, -8); scene.add(rim);

// floor with radial fade
const fc = document.createElement('canvas'); fc.width = fc.height = 256;
const fx = fc.getContext('2d'); const g = fx.createRadialGradient(128, 128, 10, 128, 128, 128);
g.addColorStop(0, '#fff'); g.addColorStop(0.55, '#aaa'); g.addColorStop(1, '#000');
fx.fillStyle = g; fx.fillRect(0, 0, 256, 256);
const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 96).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x24366e, roughness: 0.55, metalness: 0.0, transparent: true, alphaMap: new THREE.CanvasTexture(fc) }));
floor.receiveShadow = true; scene.add(floor);

// cup geometry (closed profile, open top) + accent rim
const prof = [[0, 0], [RB, 0], [RT, CUP_H], [RT - 0.03, CUP_H], [RB - 0.03, 0.03], [0, 0.03]]
  .map(([r, y]) => new THREE.Vector2(r, y));
const cupGeo = new THREE.LatheGeometry(prof, 40);
const rimGeo = new THREE.TorusGeometry(RT - 0.012, 0.03, 10, 40).rotateX(Math.PI / 2);
const bandGeo = new THREE.CylinderGeometry(RT - 0.12 * 0 + 0.002, RT - 0.1, 0.1, 40, 1, true);
const cupMat = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.7, metalness: 0 });
const rimMats = ACCENTS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));

// label sprites
function textSprite(text, { size, color, h }) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${size}px Inter, sans-serif`;
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 18; x.shadowOffsetY = 4;
  x.fillStyle = color; x.fillText(text, 256, 132);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
  s.scale.set(h * 2, h, 1); return s;
}

const cols = YEARS.map((yr, i) => {
  const x = (i - 2) * SPACING, n = COUNTS[i];
  const start = START0 + i * START_STEP;
  const cups = [];
  for (let k = 0; k < n; k++) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(cupGeo, cupMat); body.castShadow = body.receiveShadow = true;
    const rm = new THREE.Mesh(rimGeo, rimMats[i]); rm.position.y = CUP_H; rm.castShadow = true;
    grp.add(body, rm); scene.add(grp);
    cups.push({ grp, land: start + k * CUP_GAP + FALL, y: k * PITCH,
      tilt: (hash(i * 100 + k) - 0.5) * 0.7, spin: (hash(i * 100 + k + .5) - 0.5) * 3, dx: (hash(i * 100 + k + .25) - 0.5) * 0.3 });
  }
  const done = cups[n - 1].land;
  const topY = (n - 1) * PITCH + CUP_H;
  const yearS = textSprite(String(yr), { size: 150, color: '#ffffff', h: 1.1 });
  const valS = textSprite(VALUES[i], { size: 150, color: '#ffd994', h: 1.15 });
  scene.add(yearS, valS);
  return { x, n, cups, done, topY, yearS, valS };
});

function frame(t) {
  // camera orbit (slow, linear in t)
  const az = THREE.MathUtils.degToRad(-20 + 6.5 * t), el = THREE.MathUtils.degToRad(13), R = 28;
  const tgt = new THREE.Vector3(0, 4.3, 0);
  camera.position.set(tgt.x + R * Math.cos(el) * Math.sin(az), tgt.y + R * Math.sin(el), tgt.z + R * Math.cos(el) * Math.cos(az));
  camera.lookAt(tgt); camera.updateMatrixWorld();
  const toCam = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));

  let minTopPx = 1e9;
  const v = new THREE.Vector3();
  for (const c of cols) {
    for (const cp of c.cups) {
      const tau = t - (cp.land - FALL);          // time since spawn
      if (tau < 0) { cp.grp.visible = false; continue; }
      cp.grp.visible = true;
      let y = cp.y, u = 1, ox = 0, tilt = 0, spin = 0, sc = 1;
      if (tau < FALL) {
        u = tau / FALL;
        y = cp.y + FALL_H * (1 - u * u);
        const r = 1 - u;
        ox = cp.dx * r; tilt = cp.tilt * r; spin = cp.spin * r;
        sc = smooth(tau / 0.1);
      } else {
        const s = tau - FALL;                    // settle wobble
        y = cp.y - 0.05 * Math.exp(-14 * s) * Math.abs(Math.sin(26 * s));
      }
      cp.grp.position.set(c.x + ox, y, 0);
      cp.grp.rotation.set(0, spin, tilt);
      cp.grp.scale.setScalar(Math.max(sc, 1e-4));
      if (tau < FALL) {                          // title-clearance check (cup rim top)
        v.set(c.x + ox, y + CUP_H, 0).project(camera);
        minTopPx = Math.min(minTopPx, (1 - v.y) / 2 * H - 0);
      }
    }
    // year label: always on the floor directly in front of column (toward camera)
    c.yearS.position.set(c.x + toCam.x * 2.4, 0.55, toCam.z * 2.4);
    const a = smooth((t - 0.1) / 0.5);
    c.yearS.material.opacity = a; c.yearS.visible = a > 0;
    // value label after the stack completes
    const p = (t - c.done) / 0.4;
    c.valS.visible = p > 0;
    if (p > 0) {
      const s = p < 1 ? 1 + 0.25 * Math.sin(Math.PI * smooth(p)) * (1 - p) * 2 : 1;
      const k = smooth(p);
      c.valS.material.opacity = k;
      c.valS.position.set(c.x, c.topY + 0.95 + 0.25 * (1 - k), 0);
      c.valS.scale.set(2.3 * s * (0.6 + 0.4 * k), 1.15 * s * (0.6 + 0.4 * k), 1);
    }
  }
  // title fade-in (pure function of t)
  const ti = document.getElementById('title');
  ti.style.opacity = smooth(t / 0.5);
  renderer.render(scene, camera);
  return { minTopPx };
}

window.renderFrame = t => frame(t);
window.READY = document.fonts.load('800 150px Inter').then(() => document.fonts.ready).then(() => true);
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  window.READY.then(loop);
}
