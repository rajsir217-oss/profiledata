#!/bin/bash
# Resize a 512x512 source PNG into all Android mipmap densities

SRC="${1:-play-store-icon-512.png}"
BASE_DIR="android/app/src/main/res"

if [[ ! -f "$SRC" ]]; then
  echo "Usage: $0 <source-512x512.png>"
  echo "File not found: $SRC"
  exit 1
fi

declare -A SIZES=(
  [mipmap-mdpi]=48
  [mipmap-hdpi]=72
  [mipmap-xhdpi]=96
  [mipmap-xxhdpi]=144
  [mipmap-xxxhdpi]=192
)

echo "Generating Android launcher icons from $SRC..."

for dir in "${!SIZES[@]}"; do
  size=${SIZES[$dir]}
  out_dir="$BASE_DIR/$dir"
  mkdir -p "$out_dir"
  
  for file in ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png; do
    target="$out_dir/$file"
    sips -z "$size" "$size" "$SRC" --out "$target" >/dev/null 2>&1
    echo "  $target (${size}x${size})"
  done
done

echo "Done."
