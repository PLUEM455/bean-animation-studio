import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNatural } from '../behavior_pack/scripts/core/blockRules.js';
import { chooseGojo, chooseToji, COOLDOWN } from '../behavior_pack/scripts/core/brain.js';
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
const base = { dist: 5, enemies: 1, hp: 1, now: 1000, cd: ready, rand: 0.5 };
test('gojo: low hp -> purple 200%, crowd -> domain, close -> combo', () => {
  assert.equal(chooseGojo({ ...base, hp: 0.1 }), 'purple200');
  assert.equal(chooseGojo({ ...base, enemies: 3 }), 'domain');
  assert.equal(chooseGojo({ ...base, dist: 2 }), 'combo');
  assert.ok(['blue', 'red', 'pullPunch'].includes(chooseGojo({ ...base, dist: 7 })));
  assert.ok(['purple', 'blink'].includes(chooseGojo({ ...base, dist: 18 })));
});
test('gojo: cooldown respected', () => {
  const cd = { combo: 2000 };
  assert.equal(chooseGojo({ ...base, dist: 2, cd }), null);
});
test('toji: cursed target -> spear first; crowd -> chain sweep; mid -> chain aim/gun', () => {
  assert.equal(chooseToji({ ...base, dist: 3, targetCursed: true }), 'spear');
  assert.equal(chooseToji({ ...base, dist: 9, targetCursed: true }), 'blitz');
  assert.equal(chooseToji({ ...base, enemies: 3, dist: 6 }), 'chainSweep');
  assert.ok(['chainAim', 'gun', 'blitz'].includes(chooseToji({ ...base, dist: 12 })));
  assert.equal(chooseToji({ ...base, hp: 0.3 }), 'skm');
  assert.equal(chooseToji({ ...base, hp: 0.3, skm: true, dist: 2 }) !== 'skm', true);
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
