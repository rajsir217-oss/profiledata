#!/bin/zsh
set -Eeuo pipefail

PLIST_DST="$HOME/Library/LaunchAgents/com.rajsiripuram.sync2NAS.plist"

if [[ -f "$PLIST_DST" ]]; then
  launchctl unload "$PLIST_DST" >/dev/null 2>&1 || true
  rm -f "$PLIST_DST"
  echo "Uninstalled LaunchAgent: $PLIST_DST"
else
  echo "LaunchAgent not found: $PLIST_DST"
fi
