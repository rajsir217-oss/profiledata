#!/bin/bash
# Resize a 512x512 source PNG into Android mipmap densities.
# Note: ic_launcher_foreground is now an XML vector drawable,
# so we only generate ic_launcher.png and ic_launcher_round.png.

SRC="${1:-play-store-icon-512.png}"
BASE_DIR="android/app/src/main/res"

if [[ ! -f "$SRC" ]]; then
  echo "Usage: $0 <source-512x512.png>"
  echo "File not found: $SRC"
  exit 1
fi

# Use indexed arrays (bash 3 compatible) instead of associative arrays
DIRS=(mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi)
SIZES=(48 72 96 144 192)

echo "Generating Android launcher icons from $SRC..."

for i in "${!DIRS[@]}"; do
  dir=${DIRS[$i]}
  size=${SIZES[$i]}
  out_dir="$BASE_DIR/$dir"
  mkdir -p "$out_dir"

  for file in ic_launcher.png ic_launcher_round.png; do
    target="$out_dir/$file"
    sips -z "$size" "$size" "$SRC" --out "$target" >/dev/null 2>&1
    echo "  $target (${size}x${size})"
  done
done

echo "Done."
