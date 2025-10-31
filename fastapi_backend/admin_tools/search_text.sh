#!/bin/bash

# Check if keyword is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <keyword> [start_folder]"
  exit 1
fi

KEYWORD="$1"
START_FOLDER="${2:-$(pwd)}"  # Use second argument if provided, else default to current directory

# Validate that the start folder exists and is a directory
if [ ! -d "$START_FOLDER" ]; then
  echo "Error: '$START_FOLDER' is not a valid directory."
  exit 1
fi

# Find all .txt and .md files, search with grep, and format output
find "$START_FOLDER" -type f \( -name "*.txt" -o -name "*.md" \) \
  -exec grep -Hn "$KEYWORD" {} + \
  | awk -F: '{file=$1; line=$2; $1=$2=""; sub(/^::/,""); print file " | " line " | " $0}'

