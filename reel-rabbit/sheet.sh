#!/usr/bin/env bash
# sheet.sh <name> <cols>x<rows> t1,t2,... — ورقة لقطات مرتبة زمنيًا
set -e; cd "$(dirname "$0")"; rm -rf previews/stills; node src/render.js previews/stills 30 --stills "$3" >/dev/null
cd previews/stills; i=0; for f in $(ls still_*.png | sort -t_ -k2 -g); do mv $f s$(printf %03d $i).png; i=$((i+1)); done
ffmpeg -loglevel error -y -i 's%03d.png' -vf "scale=270:480,tile=$2" -frames:v 1 ../$1.png
