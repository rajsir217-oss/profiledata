#!/bin/bash
# Quick run script for web crawler

# Check if arguments provided
if [ $# -lt 2 ]; then
    echo "Usage: ./run_crawler.sh <URL> <KEYWORD> [MAX_DEPTH]"
    echo ""
    echo "Example:"
    echo '  ./run_crawler.sh https://example.com "Rancho Cordova" 5'
    exit 1
fi

URL="$1"
KEYWORD="$2"
MAX_DEPTH="${3:-5}"

echo "Starting crawler..."
echo "URL: $URL"
echo "Keyword: $KEYWORD"
echo "Max Depth: $MAX_DEPTH"
echo ""

python3 web_crawler.py "$URL" "$KEYWORD" "$MAX_DEPTH"
