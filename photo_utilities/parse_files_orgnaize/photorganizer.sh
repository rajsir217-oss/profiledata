#!/bin/bash
set -euo pipefail

# Default archive location; override with first argument
ARCHIVE="${1:-/Volumes/Extreme SSD/archived-zip}"
MERGE_TARGET="${2:-/Volumes/Extreme SSD/google photos}"
WORK_DIR="$ARCHIVE/_working_"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Unzipping and first-pass organization: $ARCHIVE"
python3 "$SCRIPT_DIR/googlephotos/organize_google_media.py" --folder "$ARCHIVE" --unzip

echo "==> Renaming leftover files in $WORK_DIR/_fldr_"
python3 "$SCRIPT_DIR/googlephotos/rename_files.py" --folder "$WORK_DIR/_fldr_"

echo "==> Moving renamed leftovers back to $WORK_DIR"
shopt -s nullglob
for f in "$WORK_DIR/_fldr_"/*; do
    [ -e "$f" ] || continue
    mv -n "$f" "$WORK_DIR/" || true
done
shopt -u nullglob

echo "==> Final organization: $WORK_DIR"
python3 "$SCRIPT_DIR/googlephotos/organize_google_media.py" --folder "$ARCHIVE"

echo ""
response=""
read -r -p "Do you want to merge (from $WORK_DIR to $MERGE_TARGET)? y/N " response </dev/tty || true
response=$(printf '%s' "$response" | tr '[:upper:]' '[:lower:]')

if [[ "$response" == "y" || "$response" == "yes" ]]; then
    echo "==> Merging $WORK_DIR into $MERGE_TARGET"
    python3 "$SCRIPT_DIR/googlephotos/organize_google_media.py" --folder "$ARCHIVE" --merge "$MERGE_TARGET"
else
    echo "Skipping merge."
fi
