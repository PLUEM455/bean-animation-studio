// Khun Wich paper diorama: real 3D layers, real shadows. Every frame is a pure function of t.
import * as THREE from 'three';
const M = await (await fetch('layers.json')).json();
const DURATION = 12, FPS = 30, OUT_W = 1080, OUT_H = 1440;
const [IW, IH] = M.size;
const LINES = [[1.7, 3.0], [3.0, 4.3], [4.3, 5.7], [5.4, 6.0], [6.6, 7.6]];
const SEAL_T = 7.75;
const TEXT_Z = [1.0, 1.0, 1.0, 1.0, 1.95];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const wx = px => (px - IW / 2) / 100, wy = py => (IH / 2 - py) / 100;   // 100 px = 1 unit

const canvas = document.getElementById('c'); canvas.width = OUT_W; canvas.height = OUT_H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OUT_W, OUT_H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x17110b);
const camera = new THREE.PerspectiveCamera(30, OUT_W / OUT_H, 0.5, 200);

// light: warm key with soft shadows, low fill
const key = new THREE.DirectionalLight(0xfff0dc, 0.9);
key.position.set(-5, 9, 20); key.target.position.set(0, 0, 0); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); key.shadow.radius = 5; key.shadow.blurSamples = 16;
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
key.shadow.bias = -0.0005; key.shadow.intensity = 0.6; key.shadow.normalBias = 0.01;
scene.add(key, key.target, new THREE.HemisphereLight(0xfff4e6, 0xbfa88a, 0.55));

const loader = new THREE.TextureLoader();
const tex = u => new Promise(r => loader.load(u, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; r(t); }));
const plane = (box, z, map, extra = {}) => {
  const [x0, y0, x1, y1] = box;
  const mat = new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, ...extra });
  const m = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) / 100, (y1 - y0) / 100), mat);
  m.position.set(wx((x0 + x1) / 2), wy((y0 + y1) / 2), z);
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: extra.alphaMap ? null : map, alphaMap: extra.alphaMap || null, alphaTest: 0.5 });
  m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
};

// back plate + diorama box
const back = plane([0, 0, IW, IH], 0, await tex('back.png'), { transparent: false, alphaTest: 0 });
back.castShadow = false;
const paperCol = new THREE.Color().setRGB(...M.paper, THREE.SRGBColorSpace);
const DEPTH = 3.4, wallMat = new THREE.MeshLambertMaterial({ color: paperCol.clone().multiplyScalar(0.72) });
const pw = IW / 100, ph = IH / 100;
for (const [w, h, x, y, ry, rx] of [[DEPTH, ph, -pw / 2, 0, Math.PI / 2, 0], [DEPTH, ph, pw / 2, 0, -Math.PI / 2, 0],
                                     [pw, DEPTH, 0, ph / 2, 0, Math.PI / 2], [pw, DEPTH, 0, -ph / 2, 0, -Math.PI / 2]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  m.position.set(x, y, DEPTH / 2); m.rotation.set(rx, ry, 0); m.receiveShadow = true; scene.add(m);
}
// front lip of the box
const lipMat = new THREE.MeshLambertMaterial({ color: 0x3b2a1c });
for (const [w, h, x, y] of [[pw + 0.5, 0.25, 0, ph / 2 + 0.125], [pw + 0.5, 0.25, 0, -ph / 2 - 0.125], [0.25, ph, -pw / 2 - 0.125, 0], [0.25, ph, pw / 2 + 0.125, 0]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), lipMat); m.position.set(x, y, DEPTH); m.castShadow = true; scene.add(m);
}

// cut-paper layers
for (const L of M.layers) plane(L.box, L.z, await tex(`layer_${L.name}.png`));

// calligraphy: one floating layer per line, written on by updating its alpha canvas each frame
const ink = new THREE.Color(0x2a2119);
const textLayers = [];
for (const T of M.text) {
  const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = `text_${T.id}.png`; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ct = new THREE.CanvasTexture(c); ct.colorSpace = THREE.NoColorSpace;
  const m = plane(T.box, TEXT_Z[T.id - 1], null, { color: ink, alphaMap: ct, alphaTest: 0.3 });
  m.receiveShadow = false;
  textLayers.push({ c, x: c.getContext('2d'), img, ct, T });
}
function writeText(t) {
  textLayers.forEach(({ c, x, img, ct }, i) => {
    const p = clamp((t - LINES[i][0]) / (LINES[i][1] - LINES[i][0]));
    const front = -40 + (c.width + 80) * p;
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height);
    if (p <= 0) { ct.needsUpdate = true; return; }
    x.drawImage(img, 0, 0);
    if (p < 1) {
      const g = x.createLinearGradient(front - 34, 0, front, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    }
    ct.needsUpdate = true;
  });
}

// seal: a real stamp block that drops in and presses onto the signature
const sc = document.createElement('canvas'); sc.width = sc.height = 256; { const x = sc.getContext('2d');
  x.fillStyle = '#a3241c'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#f3e3cf'; x.lineWidth = 12; x.strokeRect(30, 30, 196, 196);
  x.fillStyle = '#f3e3cf'; x.font = 'bold 118px Loma, FreeSerif, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ขุน', 128, 122); }
await document.fonts.load('bold 118px Loma').catch(() => {});
const sealTex = new THREE.CanvasTexture(sc); sealTex.colorSpace = THREE.SRGBColorSpace;
const sealRed = new THREE.MeshLambertMaterial({ color: 0x8e1f18 });
const seal = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.34),
  [sealRed, sealRed, sealRed, sealRed, new THREE.MeshLambertMaterial({ map: sealTex }), sealRed]);
seal.castShadow = true; scene.add(seal);
const SEAL_POS = new THREE.Vector3(wx(1012), wy(1322), 1.95 + 0.17);

// waterfall: scrolling streak texture on the mid-mountain layer
const wc = document.createElement('canvas'); wc.width = 64; wc.height = 256; { const x = wc.getContext('2d');
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,250,${0.15 + 0.5 * hash(i)})`; x.fillRect(hash(i + 9) * 64, hash(i + 3) * 256, 1 + hash(i + 5) * 3, 20 + hash(i + 7) * 70); } }
const wTex = new THREE.CanvasTexture(wc); wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping; wTex.repeat.set(1, 1.4);
const fa = document.createElement('canvas'); fa.width = 64; fa.height = 128; { const x = fa.getContext('2d');
  const gx = x.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, '#000'); gx.addColorStop(0.3, '#fff'); gx.addColorStop(0.7, '#fff'); gx.addColorStop(1, '#000');
  x.fillStyle = gx; x.fillRect(0, 0, 64, 128);
  const gy = x.createLinearGradient(0, 0, 0, 128); gy.addColorStop(0, 'rgba(0,0,0,1)'); gy.addColorStop(0.15, 'rgba(0,0,0,0)'); gy.addColorStop(0.8, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = gy; x.fillRect(0, 0, 64, 128); }
const falls = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.4), new THREE.MeshBasicMaterial({ map: wTex, alphaMap: new THREE.CanvasTexture(fa), transparent: true, opacity: 0.6, depthWrite: false }));
falls.position.set(wx(760), wy(808), 0.83); scene.add(falls);

// drifting mist sheets between layers
const mc = document.createElement('canvas'); mc.width = 512; mc.height = 256; { const x = mc.getContext('2d');
  for (let i = 0; i < 70; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(246,238,224,0.13)'); g.addColorStop(1, 'rgba(246,238,224,0)');
    x.save(); x.translate(hash(i) * 512, 70 + hash(i + 1) * 120); x.scale(80 + hash(i + 2) * 140, 30 + hash(i + 3) * 40); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); } }
const mistTex = new THREE.CanvasTexture(mc); mistTex.colorSpace = THREE.SRGBColorSpace; mistTex.wrapS = THREE.RepeatWrapping;
const mists = [[0.62, -1.4, 0.6], [1.35, -2.8, 0.45], [2.1, -4.6, 0.35]].map(([z, y, o], i) => {
  const t = mistTex.clone(); t.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, 3.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: o, depthWrite: false }));
  m.position.set(0, y, z); m.renderOrder = 5; scene.add(m); return { m, t, speed: 0.012 + 0.008 * i, dir: i % 2 ? 1 : -1 };
});

// falling leaves (real geometry, cast shadows) and dust motes in the light
const leafGeo = new THREE.CircleGeometry(0.09, 10); leafGeo.scale(1.8, 0.7, 1);
const leafMat = new THREE.MeshLambertMaterial({ color: 0x5b5a35, side: THREE.DoubleSide });
const leaves = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(leafGeo, leafMat); m.castShadow = true; scene.add(m); return m; });
const DUST = 90, dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xfff3dc, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false })));

// camera keys: t, yaw°, pitch°, distance, target x, y, z (world units)
const KEYS = [
  [0.0, 28, 5, 22, 1.6, -1.6, 1.0], [1.8, 13, 3, 18.5, 1.9, 3.0, 1.0], [6.2, 4, 2, 18.5, 1.9, 3.0, 1.0],
  [7.1, -7, 5, 13, 3.1, -5.0, 1.6], [8.4, -10, 5, 13.5, 3.1, -5.0, 1.6], [9.6, -40, 6, 15, -2.4, 2.2, 2.2],
  [10.5, -33, 5, 15.5, -2.4, 2.2, 2.2], [11.4, -14, 3, 34, 0, 0, 1.2], [12.0, -11, 3, 35, 0, 0, 1.2]];
function cameraAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = ease((t - a[0]) / (b[0] - a[0]));
  const v = a.map((x, j) => x + (b[j] - x) * k);
  const yaw = THREE.MathUtils.degToRad(v[1]), pitch = THREE.MathUtils.degToRad(v[2]);
  const tg = new THREE.Vector3(v[4], v[5], v[6]);
  camera.position.set(tg.x + v[3] * Math.cos(pitch) * Math.sin(yaw), tg.y + v[3] * Math.sin(pitch), tg.z + v[3] * Math.cos(pitch) * Math.cos(yaw));
  camera.lookAt(tg);
}

const fadeEl = document.createElement('div');
Object.assign(fadeEl.style, { position: 'fixed', left: 0, top: 0, width: OUT_W + 'px', height: OUT_H + 'px', background: '#120d08', pointerEvents: 'none' });
document.body.appendChild(fadeEl);

function frame(t) {
  cameraAt(t);
  writeText(t);
  // seal drop: falls from z+3, presses with a small squash, settles
  const s = (t - (SEAL_T - 0.35)) / 0.35;
  seal.visible = s > 0;
  if (s > 0) {
    const fall = clamp(s); const bounce = t > SEAL_T ? Math.exp(-(t - SEAL_T) * 14) * Math.sin((t - SEAL_T) * 40) * 0.05 : 0;
    seal.position.copy(SEAL_POS).add(new THREE.Vector3(0, 0, 3 * (1 - fall * fall) + Math.abs(bounce)));
    seal.rotation.set(0, 0, 0.25 * (1 - fall));
    const sq = t > SEAL_T ? 1 - 0.18 * Math.exp(-(t - SEAL_T) * 12) : 1;
    seal.scale.set(1 / Math.sqrt(sq), 1 / Math.sqrt(sq), sq);
  }
  wTex.offset.y = (t * 0.9) % 1;
  mists.forEach(({ t: mt, speed, dir }) => { mt.offset.x = (dir * t * speed) % 1; });
  leaves.forEach((m, i) => {
    const life = 6 + 2 * hash(i + 40), u = ((t + hash(i + 20) * life) % life) / life;
    m.position.set(-5 + 10 * hash(i + 30) + 2.2 * u + 0.3 * Math.sin(u * 11 + i), 7.8 - 15.5 * u, 0.8 + 2.4 * hash(i + 50));
    m.rotation.set(u * 9 + i, u * 6, u * 13);
  });
  const pos = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST; i++) {
    pos[i * 3] = -5.4 + 10.8 * hash(i) + 0.25 * Math.sin(t * 0.4 + i);
    pos[i * 3 + 1] = -7 + ((14 * hash(i + 100) + t * 0.12 * (0.5 + hash(i + 200))) % 14);
    pos[i * 3 + 2] = 0.3 + 3.0 * hash(i + 300);
  }
  dustGeo.attributes.position.needsUpdate = true;
  fadeEl.style.opacity = String(1 - clamp(t / 0.8) * clamp((DURATION - t) / 0.45));
  renderer.render(scene, camera);
}
window.CLIP = { fps: FPS, duration: DURATION, width: OUT_W, height: OUT_H };
window.renderFrame = frame;
window.READY = Promise.resolve(true);
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop();
}
