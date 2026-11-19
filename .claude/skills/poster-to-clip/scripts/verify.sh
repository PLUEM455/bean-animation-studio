#!/usr/bin/env bash
# Usage (in a project dir): verify.sh <out.mp4>  — renders a second time and compares decoded-video MD5.
set -euo pipefail
OUT="$1"; node render.mjs .verify.mp4 >/dev/null
A=$(ffmpeg -loglevel error -i "$OUT" -map 0:v -f md5 -); B=$(ffmpeg -loglevel error -i .verify.mp4 -map 0:v -f md5 -); rm -f .verify.mp4
echo "run1 $A"; echo "run2 $B"; [ "$A" = "$B" ] && echo "DETERMINISTIC: yes" || { echo "DETERMINISTIC: NO"; exit 1; }
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of csv=p=0 "$OUT"
