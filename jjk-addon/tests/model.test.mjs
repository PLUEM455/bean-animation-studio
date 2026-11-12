import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readPng, boxFaces } from '../tools/lib.mjs';

const BASE = ['root', 'waist', 'body', 'head', 'hair', 'eyes', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'belt'];
const WEAPONS = ['katana', 'playfulCloud', 'spear', 'chain', 'pistol'];
const CHARS = { gojo: { extra: [] }, toji: { extra: ['worm', ...WEAPONS] } };

for (const [name, { extra }] of Object.entries(CHARS)) {
  const geoFile = () => readJson(`resource_pack/models/entity/${name}.geo.json`);
  const geo = () => geoFile()['minecraft:geometry'][0];
  const bone = (n) => geo().bones.find((b) => b.name === n);
  const T = () => geo().description.texture_width;

  test(`${name} geometry header`, () => {
    assert.equal(geoFile().format_version, '1.12.0');
    const d = geo().description;
    assert.equal(d.identifier, `geometry.jjk.${name}`);
    assert.ok([128, 256].includes(d.texture_width));
    assert.equal(d.texture_height, d.texture_width);
  });
  test(`${name} all bones present`, () => {
    for (const n of [...BASE, ...extra]) assert.ok(bone(n), `missing bone ${n}`);
  });
  test(`${name} 2.5D detail cubes`, () => {
    assert.ok(bone('hair').cubes.length >= 6);
    assert.ok(bone('belt').cubes.length >= 2);
  });
  test(`${name} every cube uv inside texture`, () => {
    for (const b of geo().bones) for (const c of b.cubes ?? []) {
      const [u, v] = c.uv, [w, h, d] = c.size;
      assert.ok(u >= 0 && v >= 0 && u + 2 * (w + d) <= T() && v + h + d <= T(), `${b.name} cube uv out of bounds`);
    }
  });
  test(`${name} layered cubes are inflated (no z-fighting)`, () => {
    for (const n of ['hair', 'belt', ...(extra.includes('worm') ? ['worm'] : [])])
      for (const c of bone(n).cubes) assert.ok(c.inflate > 0, `${n} cube not inflated`);
    for (const n of ['body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'head'])
      for (const c of bone(n).cubes.slice(1)) assert.ok(c.inflate > 0, `${n} layer cube not inflated`);
  });
  test(`${name} texture size and base faces opaque`, () => {
    const png = readPng(`resource_pack/textures/entity/${name}.png`);
    assert.equal(png.w, T()); assert.equal(png.h, T());
    for (const n of ['body', 'head', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) {
      const c = bone(n).cubes[0];
      for (const [face, [x, y, w, h]] of Object.entries(boxFaces(c.uv, c.size)))
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
          assert.ok(png.alpha(i, j) > 0, `${n}.${face} transparent at ${i},${j}`);
    }
  });
  test(`${name} client entity wiring`, () => {
    const d = readJson(`resource_pack/entity/${name}.entity.json`)['minecraft:client_entity'].description;
    assert.equal(d.identifier, `jjk:${name}`);
    assert.equal(d.geometry.default, `geometry.jjk.${name}`);
    assert.equal(d.textures.default, `textures/entity/${name}`);
    assert.equal(d.materials.default, 'entity_alphatest');
    assert.deepEqual(d.render_controllers, [`controller.render.jjk.${name}`]);
    const rc = readJson(`resource_pack/render_controllers/${name}.render_controllers.json`);
    assert.ok(rc.render_controllers[`controller.render.jjk.${name}`]);
  });
}

test('toji worm wraps body', () => {
  const b = readJson('resource_pack/models/entity/toji.geo.json')['minecraft:geometry'][0].bones.find((x) => x.name === 'worm');
  assert.ok(b.cubes.length >= 5);
});
test('toji weapons held in right hand, only katana visible', () => {
  const bones = readJson('resource_pack/models/entity/toji.geo.json')['minecraft:geometry'][0].bones;
  for (const w of WEAPONS) assert.equal(bones.find((x) => x.name === w).parent, 'rightArm', w);
  const rc = readJson('resource_pack/render_controllers/toji.render_controllers.json').render_controllers['controller.render.jjk.toji'];
  const vis = Object.assign({}, ...rc.part_visibility);
  assert.equal(vis.katana, true);
  for (const w of WEAPONS.filter((x) => x !== 'katana')) assert.equal(vis[w], false, w);
});
