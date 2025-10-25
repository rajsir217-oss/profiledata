#!/bin/bash

# Search for a word in all files, excluding specified folders
# Usage: ./search_for_word.sh -word:"localhost" -exclude:"venv,__pycache__,.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SEARCH_WORD=""
EXCLUDE_LIST=()
START_PATH="."

# Parse arguments
for arg in "$@"; do
  case $arg in
    -word:*)
      SEARCH_WORD="${arg#-word:}"
      # Remove surrounding quotes if present
      SEARCH_WORD="${SEARCH_WORD%\"}"
      SEARCH_WORD="${SEARCH_WORD#\"}"
      ;;
    -exclude:*)
      EXCLUDE_RAW="${arg#-exclude:}"
      # Remove surrounding quotes and brackets
      EXCLUDE_RAW="${EXCLUDE_RAW%\"}"
      EXCLUDE_RAW="${EXCLUDE_RAW#\"}"
      EXCLUDE_RAW="${EXCLUDE_RAW#[}"
      EXCLUDE_RAW="${EXCLUDE_RAW%]}"
      IFS=',' read -r -a EXCLUDE_LIST <<< "$EXCLUDE_RAW"
      # Trim whitespace from each item
      for i in "${!EXCLUDE_LIST[@]}"; do
        EXCLUDE_LIST[$i]=$(echo "${EXCLUDE_LIST[$i]}" | xargs)
      done
      ;;
    -path:*)
      START_PATH="${arg#-path:}"
      START_PATH="${START_PATH%\"}"
      START_PATH="${START_PATH#\"}"
      ;;
    -h|--help)
      echo -e "${GREEN}Search for a word in all files${NC}"
      echo ""
      echo "Usage:"
      echo "  ./search_for_word.sh -word:\"search_term\" -exclude:\"folder1,folder2\""
      echo ""
      echo "Options:"
      echo "  -word:\"term\"        Word or phrase to search for (required)"
      echo "  -exclude:\"a,b,c\"    Comma-separated list of folders to exclude"
      echo "  -path:\"/some/path\"  Starting path (default: current directory)"
      echo "  -h, --help          Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./search_for_word.sh -word:\"localhost\" -exclude:\"venv,node_modules\""
      echo "  ./search_for_word.sh -word:\"TODO\" -exclude:\".git,dist,build\""
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown argument: $arg${NC}"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

# Validate input
if [ -z "$SEARCH_WORD" ]; then
  echo -e "${RED}⚠️  Missing search word${NC}"
  echo "Usage: ./search_for_word.sh -word:\"search_term\" -exclude:\"folder1,folder2\""
  echo "Use -h or --help for more information"
  exit 1
fi

# Display search parameters
echo -e "${BLUE}🔍 Searching for: ${YELLOW}\"$SEARCH_WORD\"${NC}"
echo -e "${BLUE}📂 Starting path: ${NC}$START_PATH"
if [ ${#EXCLUDE_LIST[@]} -gt 0 ]; then
  echo -e "${BLUE}🚫 Excluding folders: ${NC}${EXCLUDE_LIST[*]}"
fi
echo ""

# Build grep exclude arguments
GREP_EXCLUDE_ARGS=()
for EX in "${EXCLUDE_LIST[@]}"; do
  GREP_EXCLUDE_ARGS+=(--exclude-dir="$EX")
done

# Count matches
MATCH_COUNT=0

# Run the search using grep with exclude directories
if grep -r -n -H --color=always "${GREP_EXCLUDE_ARGS[@]}" "$SEARCH_WORD" "$START_PATH" 2>/dev/null; then
  MATCH_COUNT=$(grep -r -n "${GREP_EXCLUDE_ARGS[@]}" "$SEARCH_WORD" "$START_PATH" 2>/dev/null | wc -l)
  echo ""
  echo -e "${GREEN}✅ Found $MATCH_COUNT match(es)${NC}"
else
  echo -e "${YELLOW}⚠️  No matches found${NC}"
  exit 0
fi
