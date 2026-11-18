import * as THREE from 'three';

// ---- timeline (seconds) — shared with audio.py ----
export const DURATION = 12;
const LINES = [ // [start, end] of the ink write-on per line id 1..5
  [1.7, 3.0], [3.0, 4.3], [4.3, 5.7], [5.4, 6.0], [6.6, 7.6]];
const SEAL_T = 7.75;
// camera keys: t, centre x, centre y (source px), zoom
const KEYS = [
  [0.0, 560, 930, 1.30], [1.3, 600, 780, 1.34], [2.0, 724, 483, 1.5], [5.7, 704, 483, 1.5],
  [6.45, 724, 965, 1.5], [8.0, 724, 965, 1.54], [9.0, 318, 520, 1.75], [9.9, 318, 505, 1.85],
  [11.1, 543, 724, 1.02], [12.0, 543, 724, 1.0]];

const W = 1086, H = 1448, OUT_W = 1080, OUT_H = 1440;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

function cameraAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = ease((t - a[0]) / (b[0] - a[0]));
  let [cx, cy, z] = [1, 2, 3].map(j => a[j] + (b[j] - a[j]) * k);
  const hw = W / z / 2, hh = H / z / 2;                 // keep the view inside the poster
  cx = clamp(cx, hw, W - hw); cy = clamp(cy, hh, H - hh);
  return [cx, cy, z];
}

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OUT_W, OUT_H, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // textures are used raw: no colour shift vs. the source

const loader = new THREE.TextureLoader();
const load = u => new Promise(r => loader.load(u, tx => {
  tx.colorSpace = THREE.NoColorSpace; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = 8;
  tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; r(tx);
}));

// red seal stamp drawn once in canvas (Chromium shapes Thai correctly)
function sealTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#a3241c'; x.beginPath(); x.roundRect(14, 14, 228, 228, 26); x.fill();
  x.strokeStyle = '#f3e3cf'; x.lineWidth = 10; x.beginPath(); x.roundRect(36, 36, 184, 184, 14); x.stroke();
  x.fillStyle = '#f3e3cf'; x.font = 'bold 118px Loma, FreeSerif, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ขุน', 128, 122);
  // worn ink: knock out speckles deterministically
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    const h = n => { const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
    x.globalAlpha = 0.25 + 0.6 * h(3); x.beginPath(); x.arc(h(1) * 256, h(2) * 256, 1 + h(4) * 4, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc, uClean, uInk, uDepth, uSeal;
uniform vec3 uCam; uniform vec2 uShift; uniform float uT; uniform float uProg[6];
uniform float uSeal_a, uSeal_s, uFade;
const vec2 IMG = vec2(${W}.0, ${H}.0);
vec2 uvOf(vec2 p){ return vec2(p.x / IMG.x, 1.0 - p.y / IMG.y); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
float box(vec2 p, vec4 r, float f){ return smoothstep(r.x-f, r.x+f, p.x)*(1.0-smoothstep(r.z-f, r.z+f, p.x))*smoothstep(r.y-f, r.y+f, p.y)*(1.0-smoothstep(r.w-f, r.w+f, p.y)); }

void main(){
  vec2 p = uCam.xy + (vUv - 0.5) * vec2(IMG.x, -IMG.y) / uCam.z;
  // 2.5D parallax: displace by depth (two refinement steps)
  float d = texture2D(uDepth, uvOf(p)).r;
  vec2 q = p - (d - 0.4) * uShift;
  d = texture2D(uDepth, uvOf(q)).r;
  q = p - (d - 0.4) * uShift;

  vec2 uv = uvOf(q);
  vec3 src = texture2D(uSrc, uv).rgb, cln = texture2D(uClean, uv).rgb;
  vec3 ink = texture2D(uInk, uv).rgb;
  int id = int(floor(ink.g * 255.0 / 40.0 + 0.5));
  float prog = 1.0, x0 = 385.0, x1 = 1090.0;
  if (id == 5) { x0 = 640.0; x1 = 1000.0; }
  for (int i = 1; i < 6; i++) if (i == id) prog = uProg[i];
  float front = mix(x0 - 40.0, x1 + 40.0, prog);
  float rev = 1.0 - smoothstep(front - 34.0, front, q.x);
  if (id == 0) rev = 1.0;
  vec3 col = mix(cln, src, rev * ink.b);
  // wet ink just behind the brush: a little darker and glossy
  float wet = rev * ink.r * (1.0 - smoothstep(0.0, 140.0, front - q.x)) * step(0.001, prog) * step(prog, 0.999);
  col *= 1.0 - 0.28 * wet;
  // brush-tip ink halo at the writing front
  float tip = ink.r * (1.0 - smoothstep(0.0, 26.0, abs(q.x - front))) * step(0.001, prog) * step(prog, 0.999);
  col *= 1.0 - 0.35 * tip;
  // paper tooth on the patched (not yet written) area so it matches the surrounding sheet
  col += (hash(floor(q * 1.3)) - 0.5) * 0.06 * ink.b * (1.0 - rev);

  // waterfall flow + spray
  float wf = box(q, vec4(722.0, 738.0, 798.0, 880.0), 10.0);
  float streak = noise(vec2(q.x * 0.22, q.y * 0.035 - uT * 5.5)) * noise(vec2(q.x * 0.5 + 7.0, q.y * 0.02 - uT * 7.0));
  col = mix(col, vec3(0.93, 0.92, 0.88), wf * smoothstep(0.18, 0.55, streak) * 0.55);
  float spray = box(q, vec4(690.0, 850.0, 840.0, 935.0), 30.0) * fbm(q * 0.02 + vec2(uT * 0.25, -uT * 0.6));
  col = mix(col, vec3(0.9, 0.88, 0.83), spray * 0.35);
  // river shimmer
  float rv = box(q, vec4(560.0, 1010.0, 1010.0, 1190.0), 40.0);
  float sh = noise(vec2(q.x * 0.03 - uT * 0.9, q.y * 0.25 + q.x * 0.02));
  col += rv * (smoothstep(0.62, 0.9, sh)) * 0.07;

  // drifting mist (avoid the calligraphy)
  float keepText = 1.0 - box(q, vec4(380.0, 215.0, 1086.0, 625.0), 30.0) - box(q, vec4(630.0, 1255.0, 1000.0, 1400.0), 25.0);
  float m1 = fbm(q * 0.0045 + vec2(uT * 0.05, 0.0));
  float m2 = fbm(q * 0.009 + vec2(-uT * 0.08, 3.0));
  float band = smoothstep(560.0, 700.0, q.y) * (1.0 - smoothstep(980.0, 1150.0, q.y)) + (1.0 - smoothstep(120.0, 260.0, q.y)) * 0.8;
  float mist = smoothstep(0.45, 0.85, m1 * 0.6 + m2 * 0.5) * band * clamp(keepText, 0.0, 1.0) * smoothstep(380.0, 520.0, q.x);
  col = mix(col, vec3(0.88, 0.85, 0.78), mist * 0.38);

  // seal stamp
  vec2 sc = vec2(1012.0, 1322.0); float ss = 66.0 * uSeal_s;
  vec2 sl = (q - sc) / ss + 0.5;
  if (all(greaterThan(sl, vec2(0.0))) && all(lessThan(sl, vec2(1.0)))) {
    vec4 s = texture2D(uSeal, vec2(sl.x, 1.0 - sl.y));
    float paper = 0.85 + 0.15 * noise(q * 0.4);          // stamp picks up paper texture
    col = mix(col, s.rgb * (0.75 + 0.25 * col), s.a * uSeal_a * paper);
  }

  // falling leaves (screen space, deterministic)
  vec2 sp = vUv * vec2(${OUT_W}.0, ${OUT_H}.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float life = 5.5 + 2.0 * hash(vec2(fi, 2.0));
    float tt = mod(uT + hash(vec2(fi, 1.0)) * life, life) / life;
    vec2 lp = vec2(-60.0 + 1200.0 * hash(vec2(fi, 3.0)) + 260.0 * tt + 40.0 * sin(tt * 9.0 + fi),
                   1500.0 - 1650.0 * tt);
    float ang = tt * 10.0 + fi;
    vec2 r = sp - lp; r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * r;
    float sz = 5.0 + 4.0 * hash(vec2(fi, 4.0));
    float leaf = 1.0 - smoothstep(0.8, 1.0, length(r / vec2(sz * 1.8, sz * (0.35 + 0.65 * abs(sin(ang * 0.7))))));
    col = mix(col, vec3(0.33, 0.31, 0.2), leaf * 0.75);
  }

  // film finish: grain, flicker, vignette, fade
  float g = hash(sp + floor(uT * 24.0) * 13.7) - 0.5;
  col += g * 0.035;
  col *= 1.0 + 0.012 * sin(uT * 41.0) * sin(uT * 7.3);
  vec2 v = vUv - 0.5; col *= 1.0 - 0.55 * pow(dot(v, v) * 1.6, 1.4);
  col = mix(vec3(0.05, 0.035, 0.02), col, uFade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const [src, clean, ink, depth] = await Promise.all(['source.png', 'clean.png', 'ink.png', 'depth.png'].map(load));
await document.fonts.load('bold 118px Loma');
const uniforms = {
  uSrc: { value: src }, uClean: { value: clean }, uInk: { value: ink }, uDepth: { value: depth }, uSeal: { value: sealTexture() },
  uCam: { value: new THREE.Vector3() }, uShift: { value: new THREE.Vector2() }, uT: { value: 0 },
  uProg: { value: [1, 0, 0, 0, 0, 0] }, uSeal_a: { value: 0 }, uSeal_s: { value: 1 }, uFade: { value: 1 },
};
ink.minFilter = depth.minFilter = THREE.LinearFilter; ink.generateMipmaps = false;
ink.magFilter = THREE.NearestFilter; // keep line ids exact
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ uniforms, fragmentShader: frag,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }' })));
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function frame(t) {
  const [cx, cy, z] = cameraAt(t);
  uniforms.uCam.value.set(cx, cy, z);
  // parallax follows camera travel plus a slow handheld sway; fades out at full-poster zoom
  const amt = clamp((z - 1.0) / 0.25);
  const [rx, ry] = cameraAt(Math.max(0, t - 0.6));
  uniforms.uShift.value.set(((cx - rx) * 0.08 + 9 * Math.sin(t * 0.7)) * amt, ((cy - ry) * 0.05 + 5 * Math.sin(t * 0.53 + 1)) * amt);
  uniforms.uT.value = t;
  uniforms.uProg.value = [1, ...LINES.map(([a, b]) => clamp((t - a) / (b - a)))];
  const s = (t - SEAL_T) / 0.22;
  uniforms.uSeal_a.value = clamp(s * 1.5);
  uniforms.uSeal_s.value = s < 1 ? 1 + 0.6 * (1 - ease(clamp(s))) : 1;
  uniforms.uFade.value = clamp(t / 0.8) * clamp((DURATION - t) / 0.45);
  renderer.render(scene, cam);
  return {};
}
window.renderFrame = frame;
window.READY = Promise.resolve(true);
if (!new URLSearchParams(location.search).has('render')) {
  const t0 = performance.now();
  const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
}
