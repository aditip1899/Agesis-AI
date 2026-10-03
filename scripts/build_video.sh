#!/bin/bash
set -e
D=/app/demo_frames
cd "$D"
: > concat.txt
for f in 01_login 02_personal 03_cost 04_policies 05_governance 06_audit 07_alerts 08_assistant; do
  ffmpeg -y -loop 1 -i "${f}.png" -i "${f}.mp3" \
    -c:v libx264 -tune stillimage -c:a aac -b:a 192k \
    -pix_fmt yuv420p -vf "scale=1280:720,format=yuv420p" -r 25 -shortest \
    "scene_${f}.mp4" >/dev/null 2>&1
  echo "file '$D/scene_${f}.mp4'" >> concat.txt
done
mkdir -p /app/frontend/public
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy /app/frontend/public/aegisai-demo.mp4 >/dev/null 2>&1
ls -lh /app/frontend/public/aegisai-demo.mp4
echo "BUILD_OK"
