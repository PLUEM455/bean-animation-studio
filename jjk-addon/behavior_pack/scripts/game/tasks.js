// Multi-tick skill scripts as generators: `yield n` waits n ticks. A task stops by itself
// when its owner dies/unloads, and every task has a hard tick limit.
import { system } from '@minecraft/server';

const tasks = [];
const MAX_TASKS = 96;

/**
 * @param {import('@minecraft/server').Entity} owner
 * @param {Generator<number|undefined>} gen
 * @param {{maxTicks?: number, onEnd?: () => void}} [opt]
 */
export function spawnTask(owner, gen, opt = {}) {
  if (tasks.length >= MAX_TASKS) { opt.onEnd?.(); return; }
  tasks.push({ owner, gen, wait: 0, age: 0, maxTicks: opt.maxTicks ?? 400, onEnd: opt.onEnd });
}

function finish(i) {
  const t = tasks[i];
  tasks.splice(i, 1);
  try { t.gen.return(undefined); } catch { /* ignore */ }
  try { t.onEnd?.(); } catch { /* ignore */ }
}

system.runInterval(() => {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i];
    t.age++;
    if (!t.owner.isValid || t.age > t.maxTicks) { finish(i); continue; }
    if (t.wait > 0) { t.wait--; continue; }
    let r;
    try { r = t.gen.next(); } catch (e) { console.warn(`[jjk] task error: ${e}`); finish(i); continue; }
    if (r.done) finish(i);
    else t.wait = Math.max(0, (r.value ?? 1) - 1);
  }
}, 1);
