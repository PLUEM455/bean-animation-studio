#!/usr/bin/env bash
cd /home/user/wish
for r in "0-487" "488-975" "976-1462" "1463-1949"; do
  RESUME=1 node render.mjs frames "$r" 1 0.95 > logs/render_$r.log 2>&1 &
done
wait
echo ALLDONE > logs/render_done.txt
