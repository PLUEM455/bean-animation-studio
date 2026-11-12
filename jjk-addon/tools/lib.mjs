import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const p = (rel) => join(ROOT, rel);
export const exists = (rel) => existsSync(p(rel));

// Strip // line comments (Bedrock JSON allows them) without touching strings.
export function readJson(rel) {
  const src = readFileSync(p(rel), 'utf8').replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*/g, (m, s) => s ?? '');
  return JSON.parse(src);
}

export function pngSize(rel) {
  const b = readFileSync(p(rel));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// Minimal PNG decoder (8-bit RGBA, non-interlaced) for tests.
import { inflateSync } from 'node:zlib';
export function readPng(rel) {
  const b = readFileSync(p(rel));
  let off = 8, w, h, ct, idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (ct !== 6) throw new Error('expected RGBA png');
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, alpha: (x, y) => px[(y * w + x) * 4 + 3] };
}

// Box-UV face rectangles: [x, y, w, h] in texture pixels.
export function boxFaces([u, v], [w, h, d]) {
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    east: [u, v + d, d, h], north: [u + d, v + d, w, h],
    west: [u + d + w, v + d, d, h], south: [u + 2 * d + w, v + d, w, h],
  };
}
