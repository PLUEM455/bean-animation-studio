// Per-player settings, stored as dynamic properties on the player.
// Kept free of Minecraft imports so the parsing rules can be tested with plain Node.

export const DEFAULTS = Object.freeze({ enabled: true, limit: 64, sneak: false });
export const LIMIT_MIN = 1;
export const LIMIT_MAX = 256;

export function clampLimit(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULTS.limit;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, n));
}

export function readSettings(player) {
  const read = (name, fallback) => {
    try {
      const v = player.getDynamicProperty(`vein:${name}`);
      return v === undefined ? fallback : v;
    } catch {
      return fallback;
    }
  };
  return {
    enabled: read("enabled", DEFAULTS.enabled),
    limit: clampLimit(read("limit", DEFAULTS.limit)),
    sneak: read("sneak", DEFAULTS.sneak),
  };
}

export function writeSetting(player, name, value) {
  player.setDynamicProperty(`vein:${name}`, value);
}
