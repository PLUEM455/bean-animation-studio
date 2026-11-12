import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shake, impact, bolts } from '../behavior_pack/scripts/game/fx.js';

const fakeDim = () => {
  const d = { cmds: [], parts: [] };
  d.runCommand = (c) => d.cmds.push(c);
  d.spawnParticle = (id, loc) => d.parts.push([id, loc]);
  return d;
};
test('camera shake uses the vanilla /camerashake syntax with clamped intensity', () => {
  const d = fakeDim();
  shake(d, { x: 1.234, y: 64, z: -5 }, 16, 9, 0.5);
  assert.equal(d.cmds[0], 'camerashake add @a[x=1.2,y=64.0,z=-5.0,r=16] 4.00 0.50 positional');
});
test('impact layers every requested particle and shakes', () => {
  const d = fakeDim();
  impact(d, { x: 0, y: 70, z: 0 }, { flash: 'a', ring: 'b', sparks: 'c', smoke: 'd', extra: ['e', 'f'], shake: 1 });
  assert.deepEqual(d.parts.map((p) => p[0]), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(d.parts[1][1].y, 69.4); // shockwave sits at ground level
  assert.equal(d.cmds.length, 1);
});
test('bolts draw jagged lines', () => {
  const d = fakeDim();
  bolts(d, ['x'], { x: 0, y: 0, z: 0 }, 4, 3);
  assert.ok(d.parts.length > 20);
});
