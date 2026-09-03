#!/bin/bash
#
# Install/remove weekly cron for Cloud Run revision/image cleanup.
# Default schedule: Sunday 03:30 local time.
#
# Usage:
#   ./setup-weekly-cleanup-cron.sh
#   ./setup-weekly-cleanup-cron.sh --schedule "30 3 * * 0"
#   ./setup-weekly-cleanup-cron.sh --remove
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEANUP_SCRIPT="$SCRIPT_DIR/cleanup-old-revisions.sh"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/cleanup-old-revisions.log"
DEFAULT_SCHEDULE="30 3 * * 0"
SCHEDULE="$DEFAULT_SCHEDULE"
REMOVE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --schedule)
      shift
      if [[ $# -eq 0 ]]; then
        echo "❌ Missing value for --schedule"
        exit 1
      fi
      SCHEDULE="$1"
      ;;
    --remove)
      REMOVE_ONLY=true
      ;;
    --help|-h)
      echo "Usage: $0 [--schedule \"M H DOM MON DOW\"] [--remove]"
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      echo "Use --help for usage."
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f "$CLEANUP_SCRIPT" ]]; then
  echo "❌ Cleanup script not found: $CLEANUP_SCRIPT"
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "❌ crontab command not found"
  exit 1
fi

mkdir -p "$LOG_DIR"
touch "$LOG_FILE"

CRON_MARKER="# profiledata-cleanup-old-revisions"
CRON_COMMAND="/bin/bash \"$CLEANUP_SCRIPT\" --all >> \"$LOG_FILE\" 2>&1"
CRON_LINE="$SCHEDULE PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin $CRON_COMMAND $CRON_MARKER"

EXISTING_CRON="$(crontab -l 2>/dev/null || true)"
CLEANED_CRON="$(echo "$EXISTING_CRON" | grep -v "$CRON_MARKER" || true)"

if [[ "$REMOVE_ONLY" == true ]]; then
  if [[ -z "$(echo "$EXISTING_CRON" | grep "$CRON_MARKER" || true)" ]]; then
    echo "ℹ️ No cleanup cron entry found."
    exit 0
  fi
  if [[ -n "$CLEANED_CRON" ]]; then
    echo "$CLEANED_CRON" | crontab -
  else
    crontab -r
  fi
  echo "✅ Removed weekly cleanup cron entry."
  exit 0
fi

{
  if [[ -n "$CLEANED_CRON" ]]; then
    echo "$CLEANED_CRON"
  fi
  echo "$CRON_LINE"
} | crontab -

echo "✅ Weekly cleanup cron installed."
echo "Schedule: $SCHEDULE"
echo "Command: $CRON_COMMAND"
echo "Log file: $LOG_FILE"
echo ""
echo "Current matching cron entries:"
crontab -l | grep "$CRON_MARKER" || true
