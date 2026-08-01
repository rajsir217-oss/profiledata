#!/bin/bash

# Count files in each folder within the specified directory
# Usage: ./count_files.sh [directory]

DIR="${1:-.}"

echo "File counts in each folder under: $DIR"
echo "========================================"

find "$DIR" -maxdepth 1 -type d | while read -r folder; do
    # Remove leading ./ for cleaner output
    clean_name="${folder#./}"
    if [ -z "$clean_name" ]; then
        clean_name="$DIR"
    fi
    count=$(find "$folder" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo "$clean_name: $count"
done

echo "========================================"
