// Poster-to-clip renderer. Everything is a pure function of t (seconds) and config.json.
import * as THREE from 'three';
const C = await (await fetch('config.json')).json();
const MAXL = 8, MAXW = 4;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

const loader = new THREE.TextureLoader();
const load = u => new Promise((r, j) => loader.load(u, tx => {
  tx.colorSpace = THREE.NoColorSpace; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = 8;
  tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; r(tx);
}, undefined, j));
const [src, clean, ink, depth] = await Promise.all([C.image, 'clean.png', 'ink.png', 'depth.png'].map(load));
const W = src.image.width, H = src.image.height;
const OUT_W = C.outWidth || 1080, OUT_H = Math.round(OUT_W * H / W / 2) * 2;
const DURATION = C.duration;

const canvas = document.getElementById('c'); canvas.width = OUT_W; canvas.height = OUT_H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OUT_W, OUT_H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // raw texture values: no colour shift vs. the source

function cameraAt(t) {
  const K = C.camera; let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], k = ease((t - a[0]) / (b[0] - a[0]));
  let [cx, cy, z] = [1, 2, 3].map(j => a[j] + (b[j] - a[j]) * k);
  const hw = W / z / 2, hh = H / z / 2;
  return [clamp(cx, hw, W - hw), clamp(cy, hh, H - hh), z];
}

function sealTexture(text) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#a3241c'; x.beginPath(); x.roundRect(14, 14, 228, 228, 26); x.fill();
  x.strokeStyle = '#f3e3cf'; x.lineWidth = 10; x.beginPath(); x.roundRect(36, 36, 184, 184, 14); x.stroke();
  x.fillStyle = '#f3e3cf'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = text.length > 3 ? 230 / text.length * 1.6 : 118;
  x.font = `bold ${fs}px Loma, 'Noto Sans Thai', FreeSerif, serif`; x.fillText(text, 128, 122, 180);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    const h = n => { const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
    x.globalAlpha = 0.25 + 0.6 * h(3); x.beginPath(); x.arc(h(1) * 256, h(2) * 256, 1 + h(4) * 4, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

const pad = (arr, n, f) => { const o = arr.slice(0, n); while (o.length < n) o.push(f()); return o; };
const v4 = r => new THREE.Vector4(...r);
const lines = C.text.lines;
const seal = C.seal || null;
const mistBands = pad((C.mist?.bands || []).map(b => new THREE.Vector2(...b)), MAXW, () => new THREE.Vector2(-1, -1));
const textBoxes = pad(lines.map(l => v4(l.box)), MAXL, () => v4([-9, -9, -9, -9]));

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc, uClean, uInk, uDepth, uSeal;
uniform vec3 uCam; uniform vec2 uShift; uniform float uT, uFade, uSealA, uSealS;
uniform float uProg[${MAXL}]; uniform vec4 uBox[${MAXL}];
uniform vec4 uFalls[${MAXW}], uRivers[${MAXW}]; uniform vec2 uMist[${MAXW}];
uniform float uMistAmt, uMistMinX; uniform vec3 uSealPos; uniform float uLeaves;
const vec2 IMG = vec2(${W}.0, ${H}.0);
vec2 uvOf(vec2 p){ return vec2(p.x / IMG.x, 1.0 - p.y / IMG.y); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
float box(vec2 p, vec4 r, float f){ return smoothstep(r.x-f, r.x+f, p.x)*(1.0-smoothstep(r.z-f, r.z+f, p.x))*smoothstep(r.y-f, r.y+f, p.y)*(1.0-smoothstep(r.w-f, r.w+f, p.y)); }

void main(){
  vec2 p = uCam.xy + (vUv - 0.5) * vec2(IMG.x, -IMG.y) / uCam.z;
  float d = texture2D(uDepth, uvOf(p)).r;  vec2 q = p - (d - 0.4) * uShift;
  d = texture2D(uDepth, uvOf(q)).r;        q = p - (d - 0.4) * uShift;
  vec2 uv = uvOf(q);
  vec3 src = texture2D(uSrc, uv).rgb, cln = texture2D(uClean, uv).rgb, ink = texture2D(uInk, uv).rgb;

  // ink write-on, left to right per line
  int id = int(floor(ink.g * 255.0 / 30.0 + 0.5));
  float prog = 1.0; vec4 bx = vec4(0.0, 0.0, IMG.x, 0.0);
  for (int i = 0; i < ${MAXL}; i++) if (i + 1 == id) { prog = uProg[i]; bx = uBox[i]; }
  float front = mix(bx.x - 40.0, bx.z + 40.0, prog);
  float rev = id == 0 ? 1.0 : 1.0 - smoothstep(front - 34.0, front, q.x);
  vec3 col = mix(cln, src, rev * ink.b);
  float writing = step(0.001, prog) * step(prog, 0.999);
  col *= 1.0 - 0.28 * rev * ink.r * (1.0 - smoothstep(0.0, 140.0, front - q.x)) * writing;
  col *= 1.0 - 0.35 * ink.r * (1.0 - smoothstep(0.0, 26.0, abs(q.x - front))) * writing;
  col += (hash(floor(q * 1.3)) - 0.5) * 0.06 * ink.b * (1.0 - rev);

  // water
  for (int i = 0; i < ${MAXW}; i++) {
    vec4 r = uFalls[i]; if (r.z <= r.x) continue;
    float wf = box(q, r, 10.0);
    float st = noise(vec2(q.x * 0.22, q.y * 0.035 - uT * 5.5)) * noise(vec2(q.x * 0.5 + 7.0, q.y * 0.02 - uT * 7.0));
    col = mix(col, vec3(0.93, 0.92, 0.88), wf * smoothstep(0.18, 0.55, st) * 0.55);
    float w = r.z - r.x;
    float spray = box(q, vec4(r.x - w*0.4, r.w - 30.0, r.z + w*0.5, r.w + 55.0), 30.0) * fbm(q * 0.02 + vec2(uT * 0.25, -uT * 0.6));
    col = mix(col, vec3(0.9, 0.88, 0.83), spray * 0.35);
  }
  for (int i = 0; i < ${MAXW}; i++) {
    vec4 r = uRivers[i]; if (r.z <= r.x) continue;
    float sh = noise(vec2(q.x * 0.03 - uT * 0.9, q.y * 0.25 + q.x * 0.02));
    col += box(q, r, 40.0) * smoothstep(0.62, 0.9, sh) * 0.07;
  }

  // mist, kept off the calligraphy
  float keepText = 1.0;
  for (int i = 0; i < ${MAXL}; i++) keepText -= box(q, uBox[i] + vec4(-5.0, -5.0, 5.0, 5.0), 28.0);
  float band = 0.0;
  for (int i = 0; i < ${MAXW}; i++) { vec2 b = uMist[i]; if (b.y > b.x) band = max(band, smoothstep(b.x, b.x + 120.0, q.y) * (1.0 - smoothstep(b.y - 150.0, b.y, q.y))); }
  float m = smoothstep(0.45, 0.85, fbm(q * 0.0045 + vec2(uT * 0.05, 0.0)) * 0.6 + fbm(q * 0.009 + vec2(-uT * 0.08, 3.0)) * 0.5);
  col = mix(col, vec3(0.88, 0.85, 0.78), m * band * clamp(keepText, 0.0, 1.0) * smoothstep(uMistMinX, uMistMinX + 140.0, q.x) * uMistAmt);

  // seal
  if (uSealPos.z > 0.0) {
    vec2 sl = (q - uSealPos.xy) / (uSealPos.z * uSealS) + 0.5;
    if (all(greaterThan(sl, vec2(0.0))) && all(lessThan(sl, vec2(1.0)))) {
      vec4 s = texture2D(uSeal, vec2(sl.x, 1.0 - sl.y));
      col = mix(col, s.rgb * (0.75 + 0.25 * col), s.a * uSealA * (0.85 + 0.15 * noise(q * 0.4)));
    }
  }

  // leaves (screen space)
  vec2 sp = vUv * vec2(${OUT_W}.0, ${OUT_H}.0);
  for (int i = 0; i < 16; i++) {
    float fi = float(i); if (fi >= uLeaves) break;
    float life = 5.5 + 2.0 * hash(vec2(fi, 2.0));
    float tt = mod(uT + hash(vec2(fi, 1.0)) * life, life) / life;
    vec2 lp = vec2(-60.0 + ${OUT_W * 1.1}.0 * hash(vec2(fi, 3.0)) + 260.0 * tt + 40.0 * sin(tt * 9.0 + fi), ${OUT_H + 60}.0 - ${OUT_H + 210}.0 * tt);
    float ang = tt * 10.0 + fi; vec2 r = sp - lp; r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * r;
    float sz = 5.0 + 4.0 * hash(vec2(fi, 4.0));
    float leaf = 1.0 - smoothstep(0.8, 1.0, length(r / vec2(sz * 1.8, sz * (0.35 + 0.65 * abs(sin(ang * 0.7))))));
    col = mix(col, vec3(0.33, 0.31, 0.2), leaf * 0.75);
  }

  col += (hash(sp + floor(uT * 24.0) * 13.7) - 0.5) * 0.035;
  col *= 1.0 + 0.012 * sin(uT * 41.0) * sin(uT * 7.3);
  vec2 v = vUv - 0.5; col *= 1.0 - 0.55 * pow(dot(v, v) * 1.6, 1.4);
  gl_FragColor = vec4(clamp(mix(vec3(0.05, 0.035, 0.02), col, uFade), 0.0, 1.0), 1.0);
}`;

if (seal) await document.fonts.load('bold 118px Loma').catch(() => {});
ink.minFilter = THREE.LinearFilter; ink.generateMipmaps = false; ink.magFilter = THREE.NearestFilter;
const rects = a => pad((a || []).map(v4), MAXW, () => v4([0, 0, 0, 0]));
const U = {
  uSrc: { value: src }, uClean: { value: clean }, uInk: { value: ink }, uDepth: { value: depth },
  uSeal: { value: seal ? sealTexture(seal.text) : null },
  uCam: { value: new THREE.Vector3() }, uShift: { value: new THREE.Vector2() }, uT: { value: 0 }, uFade: { value: 1 },
  uSealA: { value: 0 }, uSealS: { value: 1 }, uSealPos: { value: new THREE.Vector3(seal?.x || 0, seal?.y || 0, seal ? seal.size : 0) },
  uProg: { value: new Array(MAXL).fill(1) }, uBox: { value: textBoxes },
  uFalls: { value: rects(C.waterfalls) }, uRivers: { value: rects(C.rivers) }, uMist: { value: mistBands },
  uMistAmt: { value: C.mist?.amount ?? 0 }, uMistMinX: { value: C.mist?.minX ?? 0 }, uLeaves: { value: C.leaves ?? 0 },
};
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: U, fragmentShader: frag,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }' })));
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const P = C.parallax || { follow: [0.08, 0.05], sway: [9, 5] };

function frame(t) {
  const [cx, cy, z] = cameraAt(t), [rx, ry] = cameraAt(Math.max(0, t - 0.6));
  const amt = clamp((z - 1.0) / 0.25);
  U.uCam.value.set(cx, cy, z);
  U.uShift.value.set(((cx - rx) * P.follow[0] + P.sway[0] * Math.sin(t * 0.7)) * amt,
                     ((cy - ry) * P.follow[1] + P.sway[1] * Math.sin(t * 0.53 + 1)) * amt);
  U.uT.value = t;
  U.uProg.value = pad(lines.map(l => clamp((t - l.start) / (l.end - l.start))), MAXL, () => 1);
  if (seal) { const s = (t - seal.time) / 0.22; U.uSealA.value = clamp(s * 1.5); U.uSealS.value = s < 1 ? 1 + 0.6 * (1 - ease(clamp(s))) : 1; }
  U.uFade.value = clamp(t / (C.fadeIn ?? 0.8)) * clamp((DURATION - t) / (C.fadeOut ?? 0.45));
  renderer.render(scene, cam);
}
window.CLIP = { fps: C.fps || 30, duration: DURATION, width: OUT_W, height: OUT_H };
window.renderFrame = frame;
window.READY = Promise.resolve(true);
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
}
