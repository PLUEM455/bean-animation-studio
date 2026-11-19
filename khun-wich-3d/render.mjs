// Usage (in a project dir): node render.mjs [out.mp4] [frame,list for PNG stills]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'clip.mp4';
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const root = path.resolve('.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' }); r.end(d); } });
}).listen(0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 4000, height: 4000 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[page error]', e.message));
await page.goto(`http://localhost:${srv.address().port}/index.html?render`);
await page.waitForFunction(() => window.CLIP && window.READY, null, { timeout: 60000 });
const { fps, duration, width, height } = await page.evaluate(() => window.CLIP);
await page.setViewportSize({ width, height });
const N = Math.round(fps * duration);
let ff = null;
if (!only) {
  const audio = fs.existsSync('soundtrack.wav') ? ['-i', 'soundtrack.wav'] : [];
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ...(audio.length ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an']), out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
for (const i of only || [...Array(N).keys()]) {
  await page.evaluate(t => window.renderFrame(t), i / fps);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
  if (only) fs.writeFileSync(`still_${String(i).padStart(3, '0')}.png`, png); else ff.stdin.write(png);
  if (i % 60 === 0) console.log(`frame ${i}/${N}`);
}
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`${out}: ${width}x${height}, ${N} frames @ ${fps}fps`); }
await browser.close(); srv.close();
