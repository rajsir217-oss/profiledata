#!/bin/bash

# Move duplicate files with count suffixes to _duplicate_ folder
# Keeps the base file or lowest count, moves higher counts
# Usage: ./move_duplicates.sh [--dry-run] [directory]

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

DUPLICATE_DIR="$DIR/_duplicate_"
TOTAL_MOVED=0

echo "Scanning directory: $DIR"
echo "Duplicate folder: $DUPLICATE_DIR"
echo "========================================"

if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN MODE - No files will be moved"
  echo "========================================"
fi

# Create duplicate directory if not dry run
if [ "$DRY_RUN" = false ]; then
  mkdir -p "$DUPLICATE_DIR"
fi

# Find all files with count suffixes (e.g., filename(1).jpg, filename(2).jpg)
# Process by base name
find "$DIR" -type f | while read -r filepath; do
  # Skip files already in duplicate folder
  if [[ "$filepath" == "$DUPLICATE_DIR"* ]]; then
    continue
  fi

  filename=$(basename "$filepath")
  dirname=$(dirname "$filepath")

  # Check if filename has count suffix pattern: name(number).ext
  if [[ "$filename" =~ ^(.*)\(([0-9]+)\)(\.[^.]+)$ ]]; then
    base_name="${BASH_REMATCH[1]}"
    count="${BASH_REMATCH[2]}"
    ext="${BASH_REMATCH[3]}"
    
    # Build pattern to find all variants
    # Pattern matches: base_name.ext, base_name(1).ext, base_name(2).ext, etc.
    variants=()
    
    # Check for base file without count
    base_file="$dirname/$base_name$ext"
    if [ -f "$base_file" ]; then
      variants+=("$base_file")
    fi
    
    # Find all count-suffixed variants using find
    while IFS= read -r -d '' variant; do
      variants+=("$variant")
    done < <(find "$dirname" -maxdepth 1 -type f -name "${base_name}(*)${ext}" -print0 2>/dev/null)
    
    # If we have multiple variants, determine which to keep
    if [ ${#variants[@]} -gt 1 ]; then
      # Sort to find the one to keep
      # Priority: base file > lowest count
      to_keep=""
      to_move=()
      
      for variant in "${variants[@]}"; do
        variant_name=$(basename "$variant")
        if [[ "$variant_name" == "$base_name$ext" ]]; then
          # Base file - highest priority to keep
          to_keep="$variant"
        elif [[ "$variant_name" =~ ^(.*)\(([0-9]+)\)(\.[^.]+)$ ]]; then
          variant_count="${BASH_REMATCH[2]}"
          if [ -z "$to_keep" ]; then
            # No base file, keep lowest count
            to_keep="$variant"
          elif [[ "$to_keep" =~ ^(.*)\(([0-9]+)\)(\.[^.]+)$ ]]; then
            keep_count="${BASH_REMATCH[2]}"
            if [ "$variant_count" -lt "$keep_count" ]; then
              # Found lower count, this becomes the new keep
              to_move+=("$to_keep")
              to_keep="$variant"
            else
              to_move+=("$variant")
            fi
          else
            # Current keep is base file, move this one
            to_move+=("$variant")
          fi
        fi
      done
      
      # Move duplicates
      for move_file in "${to_move[@]}"; do
        move_name=$(basename "$move_file")
        move_dir=$(dirname "$move_file")
        
        # Create corresponding directory in duplicate folder
        rel_path="${move_dir#$DIR/}"
        dup_dir="$DUPLICATE_DIR/$rel_path"
        
        if [ "$DRY_RUN" = true ]; then
          echo "Would move: $move_file -> $dup_dir/$move_name"
        else
          mkdir -p "$dup_dir"
          mv "$move_file" "$dup_dir/$move_name"
          echo "Moved: $move_file -> $dup_dir/$move_name"
          ((TOTAL_MOVED++))
        fi
      done
    fi
  fi
done

echo "========================================"
if [ "$DRY_RUN" = true ]; then
  echo "Dry run complete. Run without --dry-run to actually move files."
else
  echo "Total files moved to duplicates: $TOTAL_MOVED"
fi
