#!/bin/bash

# Quick git commit script - shorter version
# Usage: ./git_quick.sh "commit message"

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"commit message\""
    exit 1
fi

COMMIT_MSG="$1"

echo "🚀 Quick git commit: $COMMIT_MSG"

# Add all, commit, and push
git add . && \
git commit -m "$COMMIT_MSG" && \
git push origin $(git branch --show-current)

echo "✅ Done!"
