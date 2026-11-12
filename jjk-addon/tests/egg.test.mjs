import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readJson, pngSize, p } from '../tools/lib.mjs';

for (const name of ['gojo', 'toji']) {
  test(`${name} client entity spawn egg`, () => {
    const d = readJson(`resource_pack/entity/${name}.entity.json`)['minecraft:client_entity'].description;
    assert.equal(d.spawn_egg.texture, `jjk_${name}_spawn_egg`);
  });
  test(`${name} egg item texture registered 32x32`, () => {
    const t = readJson('resource_pack/textures/item_texture.json');
    assert.equal(t.texture_data[`jjk_${name}_spawn_egg`].textures, `textures/items/${name}_spawn_egg`);
    assert.deepEqual(pngSize(`resource_pack/textures/items/${name}_spawn_egg.png`), { w: 32, h: 32 });
  });
}
test('names in en_US and th_TH', () => {
  const want = {
    en_US: ['entity.jjk:gojo.name=Satoru Gojo', 'item.spawn_egg.entity.jjk:gojo.name=Satoru Gojo Spawn Egg',
      'entity.jjk:toji.name=Toji Fushiguro', 'item.spawn_egg.entity.jjk:toji.name=Toji Fushiguro Spawn Egg'],
    th_TH: ['entity.jjk:gojo.name=Satoru Gojo', 'item.spawn_egg.entity.jjk:gojo.name=ไข่เสก Satoru Gojo',
      'entity.jjk:toji.name=Toji Fushiguro', 'item.spawn_egg.entity.jjk:toji.name=ไข่เสก Toji Fushiguro'],
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
