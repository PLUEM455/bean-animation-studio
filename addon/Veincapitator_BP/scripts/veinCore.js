// Pure logic: no Minecraft imports, so it can be tested with plain Node.

const ORE_PATTERN = /^minecraft:(.+_ore|ancient_debris)$/;
const LOG_PATTERN = /^minecraft:(.+_log|.+_stem)$/;

// Which tool a block needs for vein mining, or null if the block is not supported.
export function toolKindFor(blockId) {
  if (!blockId) return null;
  if (ORE_PATTERN.test(blockId)) return "pickaxe";
  if (LOG_PATTERN.test(blockId)) return "axe";
  return null;
}

// e.g. "minecraft:iron_pickaxe" matches "pickaxe"
export function toolMatches(itemId, kind) {
  return Boolean(itemId) && Boolean(kind) && itemId.endsWith(`_${kind}`);
}

// How many extra blocks the tool can pay for.
// Each extra block costs 1 durability; the item must stay below max damage.
// remaining = maxDurability - damage (Infinity for non-durable items).
export function extraBudget(limit, remaining) {
  const durabilityCap = remaining === Infinity ? Infinity : remaining - 1;
  return Math.max(0, Math.min(limit, durabilityCap));
}

const OFFSETS = [];
for (let dx = -1; dx <= 1; dx++)
  for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++)
      if (dx || dy || dz) OFFSETS.push([dx, dy, dz]);

const key = (p) => `${p.x},${p.y},${p.z}`;

// Breadth-first search over the 26 neighbours (diagonals included, so
// diagonal branches of a tree and diagonal ore veins are found too).
// `matches(pos)` must return true only for same-type blocks.
// The start position is not included in the result.
export function collectVein(start, matches, maxBlocks) {
  const seen = new Set([key(start)]);
  const queue = [start];
  const out = [];
  for (let i = 0; i < queue.length && out.length < maxBlocks; i++) {
    const p = queue[i];
    for (const [dx, dy, dz] of OFFSETS) {
      if (out.length >= maxBlocks) break;
      const n = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      if (matches(n)) {
        out.push(n);
        queue.push(n);
      }
    }
  }
  return out;
}
