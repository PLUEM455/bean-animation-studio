import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from '../tools/lib.mjs';

const bp = () => readJson('behavior_pack/manifest.json');
const rp = () => readJson('resource_pack/manifest.json');

test('bp/rp manifests parse', () => {
  for (const m of [bp(), rp()]) {
    assert.equal(m.format_version, 2);
    assert.ok(m.header.uuid);
    assert.deepEqual(m.header.min_engine_version, [1, 21, 0]);
  }
});
test('all uuids unique', () => {
  const ids = [bp(), rp()].flatMap((m) => [m.header.uuid, ...m.modules.map((x) => x.uuid)]);
  assert.equal(new Set(ids).size, ids.length);
});
test('bp depends on rp', () => {
  assert.ok(bp().dependencies.some((d) => d.uuid === rp().header.uuid));
});
test('module types', () => {
  assert.equal(bp().modules[0].type, 'data');
  assert.equal(rp().modules[0].type, 'resources');
});
test('bp script module on stable @minecraft/server 2.9.0', () => {
  const m = bp();
  const s = m.modules.find((x) => x.type === 'script');
  assert.equal(s.language, 'javascript');
  assert.equal(s.entry, 'scripts/main.js');
  const dep = m.dependencies.find((d) => d.module_name === '@minecraft/server');
  assert.equal(dep.version, '2.9.0');
});
