// Pure skill selection. state: { dist, enemies, hp (0..1), now (tick), cd: {skill: readyTick},
// rand (0..1), targetCursed?, targetBehind?, skm? }
/** cooldowns in ticks (20 = 1 s) */
export const COOLDOWN = {
  // gojo
  combo: 40, blue: 160, blueMax: 300, red: 140, pullPunch: 120, blink: 80, purple: 600, purple200: 1800, domain: 1400,
  // toji
  katana: 30, cloud: 60, slam: 160, fists: 30, spear: 200, chainAim: 140, chainSweep: 300, gun: 120, blitz: 100,
  backstab: 160, skm: 1e9,
};
const ready = (s, k) => !(s.cd[k] > s.now);
const pick = (s, list) => {
  const r = list.filter((k) => ready(s, k));
  return r.length ? r[Math.min(r.length - 1, Math.floor(s.rand * r.length))] : null;
};

export function chooseGojo(s) {
  if (s.hp < 0.15 && ready(s, 'purple200')) return 'purple200';
  if ((s.enemies >= 3 || s.hp < 0.4) && s.dist <= 12 && ready(s, 'domain')) return 'domain';
  if (s.dist <= 3.5) return ready(s, 'combo') ? 'combo' : null;
  if (s.dist <= 12) return pick(s, s.enemies >= 2 ? ['blueMax', 'blue', 'red', 'pullPunch'] : ['blue', 'red', 'pullPunch']);
  if (ready(s, 'purple') && s.rand < 0.5) return 'purple';
  return pick(s, ['blink', 'purple']);
}

export function chooseToji(s) {
  if (s.hp < 0.4 && !s.skm && ready(s, 'skm')) return 'skm';
  if (s.targetCursed) {
    if (s.dist <= 4 && ready(s, 'spear')) return 'spear';
    if (s.dist > 4 && s.dist <= 20 && ready(s, 'blitz')) return 'blitz';
  }
  if (s.targetBehind && s.dist <= 10 && ready(s, 'backstab')) return 'backstab';
  if (s.enemies >= 3 && ready(s, 'chainSweep')) return 'chainSweep';
  if (s.dist <= 3.5) return pick(s, s.enemies >= 2 ? ['slam', 'cloud', 'katana'] : ['katana', 'cloud', 'fists']);
  if (s.dist <= 20) {
    if (ready(s, 'chainAim') && s.rand < 0.6) return 'chainAim';
    return pick(s, s.dist > 8 ? ['gun', 'blitz', 'chainAim'] : ['blitz', 'chainAim']);
  }
  return pick(s, ['blitz', 'gun']);
}
