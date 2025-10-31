#!/bin/bash

# Check if keyword is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <keyword>"
  exit 1
fi

KEYWORD="$1"

# Find all .txt and .md files, search with grep, and format output
find "$(pwd)" -type f \( -name "*.txt" -o -name "*.md" \) \
  -exec grep -Hn "$KEYWORD" {} + \
  | awk -F: '{file=$1; line=$2; $1=$2=""; sub(/^::/,""); print file " | " line " | " $0}'

