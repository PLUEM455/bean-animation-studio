import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readJson, p } from '../tools/lib.mjs';
import { PX, SFX, ANIM, WEAPON } from '../behavior_pack/scripts/game/ids.js';

test('every script particle exists', () => {
  const have = new Set(readdirSync(p('resource_pack/particles'))
    .map((f) => readJson(`resource_pack/particles/${f}`).particle_effect.description.identifier));
  for (const [k, id] of Object.entries(PX)) assert.ok(have.has(id), `${k}: ${id}`);
});
test('every script sound exists', () => {
  const defs = readJson('resource_pack/sounds/sound_definitions.json').sound_definitions;
  for (const [k, id] of Object.entries(SFX)) assert.ok(defs[id], `${k}: ${id}`);
});
test('every script animation exists', () => {
  for (const [mob, list] of Object.entries(ANIM)) {
    const a = readJson(`resource_pack/animations/${mob}.animation.json`).animations;
    for (const [k, id] of Object.entries(list)) assert.ok(a[id], `${mob}.${k}: ${id}`);
  }
});
test('toji weapon/chain properties declared and drive part visibility', () => {
  const e = readJson('behavior_pack/entities/toji.json')['minecraft:entity'];
  const w = e.description.properties['jjk:weapon'];
  assert.equal(w.type, 'int'); assert.equal(w.client_sync, true);
  assert.deepEqual(w.range, [0, Math.max(...Object.values(WEAPON))]);
  assert.equal(w.default, WEAPON.katana);
  const c = e.description.properties['jjk:chain_len'];
  assert.deepEqual(c.range, [0, 20]); assert.equal(c.client_sync, true);
  const vis = Object.assign({}, ...readJson('resource_pack/render_controllers/toji.render_controllers.json')
    .render_controllers['controller.render.jjk.toji'].part_visibility);
  for (const b of ['katana', 'playfulCloud', 'spear', 'chain', 'pistol'])
    assert.match(String(vis[b]), /q\.property\('jjk:weapon'\)/, b);
});
