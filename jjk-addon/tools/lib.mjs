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
