import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readJson, pngSize, p } from '../tools/lib.mjs';

test('client entity spawn egg', () => {
  const d = readJson('resource_pack/entity/gojo.entity.json')['minecraft:client_entity'].description;
  assert.equal(d.spawn_egg.texture, 'jjk_gojo_spawn_egg');
});
test('egg item texture registered 32x32', () => {
  const t = readJson('resource_pack/textures/item_texture.json');
  assert.equal(t.texture_data.jjk_gojo_spawn_egg.textures, 'textures/items/gojo_spawn_egg');
  assert.deepEqual(pngSize('resource_pack/textures/items/gojo_spawn_egg.png'), { w: 32, h: 32 });
});
test('names in en_US and th_TH', () => {
  const want = {
    en_US: ['entity.jjk:gojo.name=Satoru Gojo', 'item.spawn_egg.entity.jjk:gojo.name=Satoru Gojo Spawn Egg'],
    th_TH: ['entity.jjk:gojo.name=Satoru Gojo', 'item.spawn_egg.entity.jjk:gojo.name=ไข่เสก Satoru Gojo'],
  };
  for (const [lang, lines] of Object.entries(want)) {
    const txt = readFileSync(p(`resource_pack/texts/${lang}.lang`), 'utf8').split(/\r?\n/);
    for (const l of lines) assert.ok(txt.includes(l), `${lang} missing ${l}`);
  }
  assert.deepEqual(readJson('resource_pack/texts/languages.json'), ['en_US', 'th_TH']);
});
test('pack icons 256x256', () => {
  for (const pk of ['behavior_pack', 'resource_pack'])
    assert.deepEqual(pngSize(`${pk}/pack_icon.png`), { w: 256, h: 256 });
});
