import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readJson, p, exists } from '../tools/lib.mjs';

const defs = () => readJson('resource_pack/sounds/sound_definitions.json').sound_definitions;

test('every definition points at real Vorbis .ogg files', () => {
  for (const [id, d] of Object.entries(defs())) {
    assert.ok(d.sounds.length > 0, id);
    for (const s of d.sounds) {
      const file = `resource_pack/${typeof s === 'string' ? s : s.name}.ogg`;
      assert.ok(exists(file), `${id}: ${file}`);
      const b = readFileSync(p(file));
      assert.equal(b.toString('ascii', 0, 4), 'OggS', file);
      assert.ok(b.includes(Buffer.from('vorbis')), `${file} not vorbis`);
    }
  }
});
for (const name of ['gojo', 'toji']) {
  test(`${name} attack/hurt/death/step sounds wired`, () => {
    const d = defs();
    const attack = readJson(`resource_pack/entity/${name}.entity.json`)['minecraft:client_entity'].description.sound_effects.attack;
    assert.ok(d[attack], attack);
    const ev = readJson('resource_pack/sounds.json').entity_sounds.entities[`jjk:${name}`].events;
    for (const k of ['hurt', 'death', 'step']) {
      const id = typeof ev[k] === 'string' ? ev[k] : ev[k].sound;
      assert.ok(d[id], `${name}.${k} -> ${id}`);
    }
  });
}
