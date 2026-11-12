import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readJson, exists, p } from '../tools/lib.mjs';

const e = () => readJson('behavior_pack/entities/gojo.json')['minecraft:entity'];

test('gojo description', () => {
  const d = e().description;
  assert.equal(d.identifier, 'jjk:gojo');
  assert.equal(d.is_spawnable, true);
  assert.equal(d.is_summonable, true);
  assert.equal(d.is_experimental, false);
});
test('gojo health 500', () => {
  const h = e().components['minecraft:health'];
  assert.equal(h.value, 500);
  assert.equal(h.max, 500);
});
test('gojo collision box', () => {
  assert.deepEqual(e().components['minecraft:collision_box'], { width: 0.6, height: 1.8 });
});
test('no natural spawn rules', () => {
  if (!exists('behavior_pack/spawn_rules')) return;
  const files = readdirSync(p('behavior_pack/spawn_rules'));
  assert.ok(!files.some((f) => f.includes('gojo')));
});
