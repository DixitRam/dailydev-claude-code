#!/usr/bin/env bash
# Renders the README images from the HTML sources in this folder.
# Needs a Chromium-based browser (set BROWSER) and ImageMagick.
set -euo pipefail
cd "$(dirname "$0")"
B=${BROWSER:-brave-browser}
shot() { "$B" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --default-background-color=00000000 --virtual-time-budget=4000 \
  --window-size="$2" --screenshot="$3" "file://$PWD/$1" 2>/dev/null; }

mkdir -p ../logo
shot hero.html 1600,700 ../hero.png
shot logo.html 720,160 ../logo/light.png
shot 'logo.html?dark' 720,160 ../logo/dark.png
magick ../hero.png -strip -define png:compression-level=9 ../hero.png
for f in ../logo/light.png ../logo/dark.png; do magick "$f" -trim +repage -bordercolor none -border 8 "$f"; done
