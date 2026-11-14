#!/usr/bin/env bash
# build.sh — يبني الفيديو كاملًا: إطارات → صوت → MP4
# الاستخدام: ./build.sh <version> [narration.wav]
set -euo pipefail
cd "$(dirname "$0")"
V=${1:-v1}; NARR=${2:-}
FR=previews/frames_$V
rm -rf "$FR"
node src/render.js "$FR" 30 0 "" 4
if [ -n "$NARR" ]; then python3 src/audio.py "$FR/info.json" "previews/mix_$V.wav" "$NARR" timing.json
else python3 src/audio.py "$FR/info.json" "previews/mix_$V.wav"; fi
OUT=exports/stickman_$V.mp4
ffmpeg -loglevel error -y -framerate 30 -i "$FR/f%05d.png" -i "previews/mix_$V.wav" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 30 -g 60 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,duration -of compact "$OUT"
echo "OUT=$OUT"
