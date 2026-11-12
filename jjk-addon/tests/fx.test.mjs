import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readJson, pngSize, p, exists } from '../tools/lib.mjs';

const particles = () => Object.fromEntries(readdirSync(p('resource_pack/particles')).map((f) => {
  const j = readJson(`resource_pack/particles/${f}`)['particle_effect'];
  return [j.description.identifier, j];
}));

test('every declared particle has a file', () => {
  const have = particles();
  for (const n of ['gojo', 'toji']) {
    const d = readJson(`resource_pack/entity/${n}.entity.json`)['minecraft:client_entity'].description;
    for (const id of Object.values(d.particle_effects)) assert.ok(have[id], `${n}: no particle file for ${id}`);
  }
});
test('particles use the jjk texture and a valid material', () => {
  assert.deepEqual(pngSize('resource_pack/textures/particle/jjk_particles.png'), { w: 64, h: 16 });
  for (const [id, j] of Object.entries(particles())) {
    const r = j.description.basic_render_parameters;
    assert.equal(r.texture, 'textures/particle/jjk_particles', id);
    assert.ok(['particles_alpha', 'particles_blend', 'particles_add'].includes(r.material), id);
    const c = j.components;
    assert.ok(c['minecraft:particle_lifetime_expression'], `${id} lifetime`);
    assert.ok(c['minecraft:particle_appearance_billboard'], `${id} billboard`);
    const uv = c['minecraft:particle_appearance_billboard'].uv;
    assert.equal(uv.texture_width, 64); assert.equal(uv.texture_height, 16);
  }
});
test('looping emitters are bounded (no runaway particle count)', () => {
  for (const [id, j] of Object.entries(particles())) {
    const steady = j.components['minecraft:emitter_rate_steady'];
    if (steady) assert.ok(Number(steady.max_particles) <= 40, `${id} max_particles`);
  }
});
