import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const FPS = 30, DUR = 6, N = FPS * DUR, W = 1440, H = 1080;
const out = process.argv[2] || 'coffee-sold-per-year.mp4';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null; // debug stills
const root = path.resolve('.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`http://localhost:${port}/index.html?render`);
await page.evaluate(() => window.READY);
let ff = null;
if (!only) ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
let minPx = 1e9;
const frames = only || [...Array(N).keys()];
for (const i of frames) {
  const r = await page.evaluate(t => window.renderFrame(t), i / FPS);
  minPx = Math.min(minPx, r.minTopPx);
  const png = await page.screenshot({ type: 'png' });
  if (only) fs.writeFileSync(`still_${String(i).padStart(3, '0')}.png`, png); else ff.stdin.write(png);
  if (i % 30 === 0) console.log('frame', i);
}
console.log('min falling-cup top (screen px from top):', minPx.toFixed(1));
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
await browser.close(); srv.close();
