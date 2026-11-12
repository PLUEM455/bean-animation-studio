import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../tools/lib.mjs';

const MOBS = { gojo: 8, toji: 14 };
for (const [name, dmg] of Object.entries(MOBS)) {
  const ent = () => readJson(`behavior_pack/entities/${name}.json`)['minecraft:entity'];
  test(`${name} melee attack wired`, () => {
    const c = ent().components;
    assert.equal(c['minecraft:attack'].damage, dmg);
    assert.ok(c['minecraft:behavior.melee_attack']);
    assert.equal(ent().description.runtime_identifier, undefined);
  });
  test(`${name} is neutral (retaliates, hunts monsters only)`, () => {
    const c = ent().components;
    assert.ok(c['minecraft:behavior.hurt_by_target']);
    const nat = c['minecraft:behavior.nearest_attackable_target'];
    const f = JSON.stringify(nat.entity_types);
    assert.ok(f.includes('"monster"'));
    assert.ok(!f.includes('player'));
  });
  test(`${name} boss bar only in combat`, () => {
    const e = ent();
    assert.equal(e.components['minecraft:boss'], undefined);
    const g = e.component_groups['jjk:combat'];
    assert.ok(g['minecraft:boss']);
    assert.equal(g['minecraft:timer'].time_down_event.event, 'jjk:combat_end');
    const ds = JSON.stringify(e.components['minecraft:damage_sensor']);
    assert.ok(ds.includes('jjk:combat_start'));
    // remove-then-add in order so the 20 s timer restarts on every hit
    assert.deepEqual(e.events['jjk:combat_start'].sequence.map((x) => Object.keys(x)[0]), ['remove', 'add']);
    assert.deepEqual(e.events['jjk:combat_end'].remove.component_groups, ['jjk:combat']);
  });
}

for (const name of ['gojo', 'toji']) {
  test(`${name} syncs fighting state to client`, () => {
    const e = readJson(`behavior_pack/entities/${name}.json`)['minecraft:entity'];
    const prop = e.description.properties['jjk:fighting'];
    assert.equal(prop.type, 'bool'); assert.equal(prop.client_sync, true);
    const trig = JSON.stringify(e.components['minecraft:environment_sensor']);
    assert.ok(trig.includes('has_target') && trig.includes('jjk:fight_on') && trig.includes('jjk:fight_off'));
    assert.ok(e.events['jjk:fight_on'].set_property['jjk:fighting'] === true);
    assert.ok(e.events['jjk:fight_off'].set_property['jjk:fighting'] === false);
  });
}
