#!/bin/bash

# Delete non-media files, keeping only media files
# Usage: ./delete_extensions.sh [--dry-run] [directory]

DRY_RUN=false
DIR="."

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      DIR="$1"
      shift
      ;;
  esac
done

# Media file extensions to KEEP
MEDIA_EXTENSIONS=(
  "avi" "AVI"
  "mov" "MOV"
  "mp4" "MP4"
  "mpeg" "mpg" "MPG"
  "vcd" "VCD"
  "vob" "VOB"
  "wmv"
  "mp3"
  "wma" "WMA"
  "bmp"
  "gif" "GIF"
  "jpg" "JPG"
  "mpo" "MPO"
  "png" "PNG"
  "tif" "TIF"
  "wmf"
)

# Build find pattern for media files
MEDIA_PATTERN=""
for ext in "${MEDIA_EXTENSIONS[@]}"; do
  if [ -z "$MEDIA_PATTERN" ]; then
    MEDIA_PATTERN="-iname \"*.$ext\""
  else
    MEDIA_PATTERN="$MEDIA_PATTERN -o -iname \"*.$ext\""
  fi
done

echo "Scanning directory: $DIR"
echo "========================================"

if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN MODE - No files will be deleted"
  echo "========================================"
fi

# Count total files
TOTAL_FILES=$(find "$DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Total files: $TOTAL_FILES"

# Count media files (to keep)
MEDIA_COUNT=$(eval "find \"$DIR\" -type f \\( $MEDIA_PATTERN \\)" 2>/dev/null | wc -l | tr -d ' ')
echo "Media files (will be kept): $MEDIA_COUNT"

# Count non-media files (to delete)
NON_MEDIA_COUNT=$((TOTAL_FILES - MEDIA_COUNT))
echo "Non-media files (will be deleted): $NON_MEDIA_COUNT"
echo "========================================"

if [ "$DRY_RUN" = true ]; then
  echo "Non-media files by extension:"
  echo "========================================"
  eval "find \"$DIR\" -type f ! \\( $MEDIA_PATTERN \\)" 2>/dev/null | while read -r file; do
    if [[ "$file" == *.* ]]; then
      echo "${file##*.}"
    else
      echo "(no extension)"
    fi
  done | sort | uniq -c | sort -rn | head -30
  echo "========================================"
  echo "Sample of non-media files to be deleted:"
  eval "find \"$DIR\" -type f ! \\( $MEDIA_PATTERN \\)" 2>/dev/null | head -20
  echo "..."
  echo "========================================"
  echo "Dry run complete. Run without --dry-run to actually delete files."
else
  # Delete non-media files
  DELETED_COUNT=$(eval "find \"$DIR\" -type f ! \\( $MEDIA_PATTERN \\) -print -delete" 2>/dev/null | wc -l | tr -d ' ')
  echo "Deleted $DELETED_COUNT non-media files from: $DIR"
fi
