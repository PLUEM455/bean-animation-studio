#!/usr/bin/env bash
# Usage: new_project.sh <image> <project-dir>
# Creates a project dir with the image, template, scripts and node deps (three + the preinstalled Playwright).
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$1"; DIR="$2"; mkdir -p "$DIR"
ext="${IMG##*.}"; cp "$IMG" "$DIR/source.$ext"
cp "$SKILL"/template/index.html "$SKILL"/template/main.js "$DIR"/
[ -f "$DIR/config.json" ] || sed "s/\"source.png\"/\"source.$ext\"/" "$SKILL/template/config.json" > "$DIR/config.json"
cp "$SKILL"/scripts/{prep.py,audio.py,render.mjs,find_text.py} "$DIR"/
cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null
PW=$(node -e "try{console.log(require('playwright/package.json').version)}catch(e){console.log('')}" 2>/dev/null || true)
npm i three ${PW:+playwright@$PW} --silent 2>&1 | tail -1 || true
printf 'node_modules/\nstill_*.png\n' > .gitignore
python3 -c "from PIL import Image; im=Image.open('source.$ext'); print('image', im.size[0], 'x', im.size[1])"
echo "project ready: $DIR (edit config.json, then: python3 prep.py && python3 audio.py && node render.mjs out.mp4)"
