#!/bin/bash

# Move '*toberemoved*' files into a centralized toberemoved/ folder.
# Preserves original relative paths under the destination root.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_err() { echo -e "${RED}[ERR]${NC} $1"; }

show_help() {
  cat <<'EOF'
move_toberemoved.sh - move '*toberemoved*' files into ./toberemoved

Usage:
  ./move_toberemoved.sh [options]

Options:
  -n, --dry-run            Preview moves only (no changes)
  -y, --yes                Skip confirmation prompt
  -d, --days <N>           Only move files older than N days
  --no-git-mv              Use mv even for git-tracked files
  -h, --help               Show help

Note:
  • The script automatically excludes itself from moves.

Examples:
  ./move_toberemoved.sh
  ./move_toberemoved.sh -n
  ./move_toberemoved.sh -d 14
  ./move_toberemoved.sh -y -d 30
EOF
}

DRY_RUN=false
AUTO_YES=false
USE_GIT_MV=true
OLDER_THAN_DAYS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -y|--yes|--assume-yes)
      AUTO_YES=true
      shift
      ;;
    -d|--days)
      shift
      if [[ $# -eq 0 ]]; then
        print_err "--days requires a numeric value"
        exit 1
      fi
      OLDER_THAN_DAYS="$1"
      if ! [[ "$OLDER_THAN_DAYS" =~ ^[0-9]+$ ]]; then
        print_err "--days must be a non-negative integer"
        exit 1
      fi
      shift
      ;;
    --no-git-mv)
      USE_GIT_MV=false
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      print_err "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_ROOT="$ROOT_DIR/toberemoved"
PATTERN='*toberemoved*'
SCRIPT_PATH="$ROOT_DIR/$(basename "${BASH_SOURCE[0]}")"

if ! command -v find >/dev/null 2>&1; then
  print_err "find command not found"
  exit 1
fi

if [[ -n "$OLDER_THAN_DAYS" ]]; then
  print_info "Scanning for files matching ${PATTERN} older than ${OLDER_THAN_DAYS} day(s)..."
else
  print_info "Scanning for files matching ${PATTERN}..."
fi

files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(
  if [[ -n "$OLDER_THAN_DAYS" ]]; then
    find "$ROOT_DIR" \
      -path "$DEST_ROOT" -prune -o \
      -type f -name "$PATTERN" -not -path "$SCRIPT_PATH" -mtime +"$OLDER_THAN_DAYS" -print0
  else
    find "$ROOT_DIR" \
      -path "$DEST_ROOT" -prune -o \
      -type f -name "$PATTERN" -not -path "$SCRIPT_PATH" -print0
  fi
)

if [[ ${#files[@]} -eq 0 ]]; then
  print_ok "No matching files found."
  exit 0
fi

print_info "Found ${#files[@]} file(s)."
for f in "${files[@]}"; do
  rel="${f#$ROOT_DIR/}"
  echo "  $rel"
done

if [[ "$DRY_RUN" == true ]]; then
  print_warn "Dry-run mode: no files will be moved."
  exit 0
fi

if [[ "$AUTO_YES" != true ]]; then
  echo -n "Proceed moving these files to ./toberemoved ? (y/N): "
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    print_info "Aborted by user."
    exit 0
  fi
fi

mkdir -p "$DEST_ROOT"

HAS_GIT=false
if git -C "$ROOT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  HAS_GIT=true
fi

moved=0
for f in "${files[@]}"; do
  rel="${f#$ROOT_DIR/}"
  dest="$DEST_ROOT/$rel"
  dest_rel="${dest#$ROOT_DIR/}"

  mkdir -p "$(dirname "$dest")"

  if [[ -e "$dest" ]]; then
    stamp="$(date +%Y%m%d-%H%M%S)"
    dest="${dest}.${stamp}"
    dest_rel="${dest#$ROOT_DIR/}"
    print_warn "Destination exists, appending timestamp: $dest_rel"
  fi

  if [[ "$USE_GIT_MV" == true && "$HAS_GIT" == true ]]; then
    if git -C "$ROOT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
      git -C "$ROOT_DIR" mv "$rel" "$dest_rel"
      print_ok "git mv: $rel -> $dest_rel"
      moved=$((moved + 1))
      continue
    fi
  fi

  mv "$f" "$dest"
  print_ok "mv: $rel -> $dest_rel"
  moved=$((moved + 1))
done

print_ok "Done. Moved ${moved} file(s) into toberemoved/."
if [[ "$HAS_GIT" == true ]]; then
  print_info "Tip: run 'git status --short' to review tracked renames/moves."
fi
