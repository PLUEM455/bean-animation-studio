// Pure skill selection. state: { now (tick), cd: {skill: readyTick}, rand (0..1), gcdUntil?, skm? }
/** cooldowns in ticks (20 = 1 s) */
export const COOLDOWN = {
  // gojo
  combo: 40, blue: 160, blueMax: 300, red: 140, pullPunch: 120, blink: 80, purple: 600, purple200: 1800, domain: 1400,
  // toji
  katana: 30, cloud: 60, slam: 160, fists: 30, spear: 200, chainAim: 140, chainSweep: 300, gun: 120, blitz: 100,
  backstab: 160, skm: 1e9,
};
export const GOJO_SKILLS = ['combo', 'blue', 'blueMax', 'red', 'pullPunch', 'blink', 'purple', 'purple200', 'domain'];
export const TOJI_SKILLS = ['katana', 'cloud', 'slam', 'fists', 'spear', 'chainAim', 'chainSweep', 'gun', 'blitz',
  'backstab', 'skm'];
/** ticks between two skills of the same mob, so casts read clearly */
export const GLOBAL_GAP = 24;

const ready = (s, k) => !(s.cd[k] > s.now);

/** uniform random pick among ready skills; range and HP no longer matter — cooldowns do */
function pick(s, list) {
  if (s.gcdUntil > s.now) return null;
  const r = list.filter((k) => ready(s, k));
  return r.length ? r[Math.min(r.length - 1, Math.floor(s.rand * r.length))] : null;
}

export const chooseGojo = (s) => pick(s, GOJO_SKILLS);
export const chooseToji = (s) => pick(s, s.skm ? TOJI_SKILLS.filter((k) => k !== 'skm') : TOJI_SKILLS);
