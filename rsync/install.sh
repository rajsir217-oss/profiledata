#!/bin/zsh
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/launchd/com.rajsiripuram.sync2NAS.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.rajsiripuram.sync2NAS.plist"

if [[ ! -f "$PLIST_SRC" ]]; then
  echo "Missing plist template: $PLIST_SRC"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" >/dev/null 2>&1 || true
launchctl load "$PLIST_DST"

echo "Installed LaunchAgent: $PLIST_DST"
echo "Loaded: com.rajsiripuram.sync2NAS"
