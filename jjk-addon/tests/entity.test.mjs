import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readJson, exists, p } from '../tools/lib.mjs';

const MOBS = { gojo: 500, toji: 400 };
for (const [name, hp] of Object.entries(MOBS)) {
const e = () => readJson(`behavior_pack/entities/${name}.json`)['minecraft:entity'];

test(`${name} description`, () => {
  const d = e().description;
  assert.equal(d.identifier, `jjk:${name}`);
  assert.equal(d.is_spawnable, true);
  assert.equal(d.is_summonable, true);
  assert.equal(d.is_experimental, false);
});
test(`${name} health`, () => {
  const h = e().components['minecraft:health'];
  assert.equal(h.value, hp);
  assert.equal(h.max, hp);
});
test(`${name} collision box`, () => {
  assert.deepEqual(e().components['minecraft:collision_box'], { width: 0.6, height: 1.8 });
});
test(`${name} no natural spawn rules`, () => {
  if (!exists('behavior_pack/spawn_rules')) return;
  const files = readdirSync(p('behavior_pack/spawn_rules'));
  assert.ok(!files.some((f) => f.includes(name)));
});
}
