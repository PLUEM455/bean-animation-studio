import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNatural } from '../behavior_pack/scripts/core/blockRules.js';
import { chooseGojo, chooseToji, COOLDOWN, GOJO_SKILLS, TOJI_SKILLS, GLOBAL_GAP } from '../behavior_pack/scripts/core/brain.js';
import { createRope, stepRope, launchVelocity } from '../behavior_pack/scripts/core/rope.js';
import { dist } from '../behavior_pack/scripts/core/vec.js';

test('natural blocks are protected', () => {
  for (const b of ['dirt', 'grass_block', 'stone', 'deepslate', 'sand', 'gravel', 'clay', 'iron_ore', 'deepslate_diamond_ore',
    'water', 'lava', 'bedrock', 'snow', 'ice', 'netherrack', 'end_stone', 'oak_log', 'spruce_leaves', 'poppy',
    'short_grass', 'tall_grass', 'vine', 'crimson_stem', 'cactus', 'red_flower', 'tallgrass', 'leaves2', 'log2'])
    assert.equal(isNatural(`minecraft:${b}`), true, b);
});
test('man-made blocks are breakable', () => {
  for (const b of ['oak_planks', 'glass', 'bricks', 'chest', 'cobblestone', 'stone_bricks', 'white_wool', 'oak_door',
    'crafting_table', 'torch', 'glass_pane', 'oak_wood', 'polished_andesite'])
    assert.equal(isNatural(`minecraft:${b}`), false, b);
});
test('air and unknown modded blocks', () => {
  assert.equal(isNatural('minecraft:air'), true); // nothing to break
  assert.equal(isNatural('other:thing'), false);
});

const ready = {};
const base = { now: 1000, cd: ready, rand: 0.5 };
const draw = (fn, extra = {}) => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(fn({ ...base, ...extra, rand: i / 400 }));
  return seen;
};
test('gojo picks any ready skill at random, at any range, including the domain', () => {
  assert.deepEqual([...draw(chooseGojo)].sort(), [...GOJO_SKILLS].sort());
  for (const dist of [1, 8, 40]) assert.ok(GOJO_SKILLS.includes(chooseGojo({ ...base, dist, rand: 0.99 })));
});
test('toji picks any ready skill at random', () => {
  assert.deepEqual([...draw(chooseToji)].sort(), [...TOJI_SKILLS].sort());
});
test('cooldowns are the only limit', () => {
  const cd = Object.fromEntries(GOJO_SKILLS.filter((k) => k !== 'red').map((k) => [k, 5000]));
  assert.deepEqual([...draw(chooseGojo, { cd })], ['red']);
  const all = Object.fromEntries(GOJO_SKILLS.map((k) => [k, 5000]));
  assert.equal(chooseGojo({ ...base, cd: all }), null);
});
test('global gap between skills', () => {
  assert.equal(chooseGojo({ ...base, gcdUntil: 1010 }), null);
  assert.ok(GLOBAL_GAP > 0);
});
test('sorcerer killer mode is not re-rolled once active', () => {
  assert.ok(!draw(chooseToji, { skm: true }).has('skm'));
});
test('every chosen skill has a cooldown', () => {
  for (const k of ['purple200', 'domain', 'combo', 'blue', 'blueMax', 'red', 'pullPunch', 'blink', 'purple',
    'spear', 'blitz', 'backstab', 'chainSweep', 'chainAim', 'gun', 'katana', 'cloud', 'slam', 'fists', 'skm'])
    assert.ok(COOLDOWN[k] > 0, k);
});

test('rope keeps segment lengths and sags under gravity', () => {
  const anchor = { x: 0, y: 10, z: 0 };
  const r = createRope(anchor, { x: 5, y: 10, z: 0 }, 10);
  for (let i = 0; i < 400; i++) stepRope(r, anchor, 0.05);
  for (let i = 1; i < r.points.length; i++) {
    const d = dist(r.points[i].p, r.points[i - 1].p);
    assert.ok(d <= r.seg * 1.03, `segment ${i} stretched ${d}`);
  }
  const tip = r.points.at(-1).p;
  assert.ok(tip.y < anchor.y - 4, 'tip hangs below anchor');
});
test('aimed tip reaches target and longer throws take longer', () => {
  const time = (D) => {
    const anchor = { x: 0, y: 2, z: 0 }, target = { x: D, y: 2, z: 0 };
    const r = createRope(anchor, anchor, Math.max(4, Math.ceil(D + 1)), D + 1, true);
    r.points.at(-1).v = launchVelocity(anchor, target);
    for (let t = 0; t < 200; t++) {
      stepRope(r, anchor, 0.05);
      if (dist(r.points.at(-1).p, target) < 1.3) return t;
    }
    return Infinity;
  };
  const t6 = time(6), t18 = time(18);
  assert.ok(Number.isFinite(t6) && Number.isFinite(t18), `t6=${t6} t18=${t18}`);
  assert.ok(t18 > t6, 'farther target takes longer');
});
