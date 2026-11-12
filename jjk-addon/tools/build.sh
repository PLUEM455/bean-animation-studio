#!/usr/bin/env bash
# Regenerate assets, run tests, package dist/JJK_Addon.mcaddon
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/gen_gojo_model.py
python3 tools/gen_toji_model.py
python3 tools/gen_anims.py
python3 tools/gen_fx.py
python3 tools/gen_sounds.py
python3 tools/gen_icons.py
node --test tests/*.test.mjs
rm -rf dist/stage && mkdir -p dist/stage
cp -r behavior_pack dist/stage/JJK_BP
cp -r resource_pack dist/stage/JJK_RP
rm -f dist/JJK_Addon.mcaddon
(cd dist/stage && zip -qr -X ../JJK_Addon.mcaddon JJK_BP JJK_RP)
rm -rf dist/stage
JJK_CHECK_DIST=1 node --test tests/build.test.mjs
echo "built dist/JJK_Addon.mcaddon"
