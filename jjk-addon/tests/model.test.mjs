import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readPng, boxFaces } from '../tools/lib.mjs';

const BONES = ['root', 'waist', 'body', 'head', 'hair', 'eyes', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'belt'];
const geoFile = () => readJson('resource_pack/models/entity/gojo.geo.json');
const geo = () => geoFile()['minecraft:geometry'][0];
const bone = (n) => geo().bones.find((b) => b.name === n);

test('geometry header', () => {
  assert.equal(geoFile().format_version, '1.12.0');
  const d = geo().description;
  assert.equal(d.identifier, 'geometry.jjk.gojo');
  assert.equal(d.texture_width, 128);
  assert.equal(d.texture_height, 128);
});
test('all bones present', () => {
  for (const n of BONES) assert.ok(bone(n), `missing bone ${n}`);
});
test('2.5D detail cubes', () => {
  assert.ok(bone('hair').cubes.length >= 6);
  assert.ok(bone('belt').cubes.length >= 2);
});
test('every cube uv inside texture', () => {
  for (const b of geo().bones) for (const c of b.cubes ?? []) {
    const [u, v] = c.uv, [w, h, d] = c.size;
    assert.ok(u >= 0 && v >= 0 && u + 2 * (w + d) <= 128 && v + h + d <= 128, `${b.name} cube uv out of bounds`);
  }
});
test('layered cubes are inflated (no z-fighting)', () => {
  for (const n of ['hair', 'belt']) for (const c of bone(n).cubes) assert.ok(c.inflate > 0, `${n} cube not inflated`);
  for (const n of ['body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'head']) {
    const layers = bone(n).cubes.slice(1);
    for (const c of layers) assert.ok(c.inflate > 0, `${n} layer cube not inflated`);
  }
});
test('texture 128x128 and base faces opaque', () => {
  const png = readPng('resource_pack/textures/entity/gojo.png');
  assert.equal(png.w, 128); assert.equal(png.h, 128);
  for (const n of ['body', 'head', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']) {
    const c = bone(n).cubes[0];
    for (const [face, [x, y, w, h]] of Object.entries(boxFaces(c.uv, c.size)))
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
        assert.ok(png.alpha(i, j) > 0, `${n}.${face} transparent at ${i},${j}`);
  }
});
test('client entity wiring', () => {
  const d = readJson('resource_pack/entity/gojo.entity.json')['minecraft:client_entity'].description;
  assert.equal(d.identifier, 'jjk:gojo');
  assert.equal(d.geometry.default, 'geometry.jjk.gojo');
  assert.equal(d.textures.default, 'textures/entity/gojo');
  assert.equal(d.materials.default, 'entity_alphatest');
  assert.deepEqual(d.render_controllers, ['controller.render.jjk.gojo']);
  const rc = readJson('resource_pack/render_controllers/gojo.render_controllers.json');
  assert.ok(rc.render_controllers['controller.render.jjk.gojo']);
});
