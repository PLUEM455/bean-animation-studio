import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { exists, p } from '../tools/lib.mjs';

// Run tools/build.sh first; this checks the produced archive.
test('mcaddon contains both packs', { skip: !process.env.JJK_CHECK_DIST && 'set JJK_CHECK_DIST=1 (build.sh does)' }, () => {
  assert.ok(exists('dist/JJK_Addon.mcaddon'));
  const list = execFileSync('unzip', ['-Z1', p('dist/JJK_Addon.mcaddon')], { encoding: 'utf8' }).split('\n');
  for (const f of ['JJK_BP/manifest.json', 'JJK_RP/manifest.json', 'JJK_BP/entities/gojo.json',
    'JJK_RP/models/entity/gojo.geo.json', 'JJK_RP/textures/entity/gojo.png', 'JJK_RP/textures/items/gojo_spawn_egg.png',
    'JJK_BP/entities/toji.json', 'JJK_RP/entity/toji.entity.json', 'JJK_RP/models/entity/toji.geo.json',
    'JJK_RP/textures/entity/toji.png', 'JJK_RP/textures/items/toji_spawn_egg.png',
    'JJK_RP/render_controllers/toji.render_controllers.json'])
    assert.ok(list.includes(f), `missing ${f}`);
  assert.ok(!list.some((f) => f.includes('preview/') || f.includes('tools/')), 'dev files leaked into archive');
});
