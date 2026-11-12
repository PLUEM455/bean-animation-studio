import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../tools/lib.mjs';

const MOVES = ['idle', 'walk', 'run', 'attack', 'hurt', 'death'];
const CTRLS = { gojo: ['move_ctrl', 'attack_ctrl', 'hurt_ctrl', 'fx_ctrl'], toji: ['move_ctrl', 'attack_ctrl', 'hurt_ctrl'] };
const ctrlFile = () => readJson('resource_pack/animation_controllers/jjk.animation_controllers.json').animation_controllers;

for (const name of ['gojo', 'toji']) {
  const desc = () => readJson(`resource_pack/entity/${name}.entity.json`)['minecraft:client_entity'].description;
  const anims = () => readJson(`resource_pack/animations/${name}.animation.json`).animations;
  const bones = () => new Set(readJson(`resource_pack/models/entity/${name}.geo.json`)['minecraft:geometry'][0].bones.map((b) => b.name));

  test(`${name} client entity maps every move and controller`, () => {
    const a = desc().animations;
    for (const k of [...MOVES, 'look_at', ...CTRLS[name]]) assert.ok(a[k], `missing ${k}`);
    const animate = desc().scripts.animate.map((x) => (typeof x === 'string' ? x : Object.keys(x)[0]));
    for (const k of ['look_at', ...CTRLS[name]]) assert.ok(animate.includes(k), `not animated: ${k}`);
  });
  test(`${name} referenced animations and controllers exist`, () => {
    for (const [k, id] of Object.entries(desc().animations)) {
      if (id.startsWith('controller.')) assert.ok(ctrlFile()[id], `${k} -> ${id}`);
      else if (id.startsWith('animation.jjk.')) assert.ok(anims()[id], `${k} -> ${id}`);
    }
  });
  test(`${name} animations only touch existing bones`, () => {
    for (const [id, a] of Object.entries(anims()))
      for (const b of Object.keys(a.bones ?? {})) assert.ok(bones().has(b), `${id} uses unknown bone ${b}`);
  });
  test(`${name} loop modes`, () => {
    const a = anims();
    for (const m of ['idle', 'walk', 'run']) assert.equal(a[`animation.jjk.${name}.${m}`].loop, true, m);
    assert.equal(a[`animation.jjk.${name}.death`].loop, 'hold_on_last_frame');
    for (const m of ['attack', 'hurt']) assert.ok(a[`animation.jjk.${name}.${m}`].animation_length > 0, m);
  });
  test(`${name} controller states use mapped animations and declared fx/sounds`, () => {
    const d = desc();
    const used = { p: new Set(), s: new Set() };
    for (const k of CTRLS[name]) {
      for (const [sn, st] of Object.entries(ctrlFile()[d.animations[k]].states)) {
        for (const x of st.animations ?? []) {
          const short = typeof x === 'string' ? x : Object.keys(x)[0];
          assert.ok(d.animations[short], `${k}.${sn} uses unmapped ${short}`);
        }
        for (const pe of st.particle_effects ?? []) used.p.add(pe.effect);
      }
    }
    for (const a of Object.values(anims())) {
      for (const v of Object.values(a.particle_effects ?? {})) for (const pe of [].concat(v)) used.p.add(pe.effect);
      for (const v of Object.values(a.sound_effects ?? {})) for (const se of [].concat(v)) used.s.add(se.effect);
    }
    for (const e of used.p) assert.ok(d.particle_effects?.[e], `particle ${e} not declared`);
    for (const e of used.s) assert.ok(d.sound_effects?.[e], `sound ${e} not declared`);
    assert.ok(used.s.has('attack'), 'attack has no sound');
  });
}
