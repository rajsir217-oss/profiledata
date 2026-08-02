#!/bin/zsh

###############################################################################
# sync2NAS.sh
#
# One-way synchronization:
#
#   Mac:
#       /Users/rajsiripuram02/Desktop/sync2NAS
#
#            |
#            |  rsync
#            V
#
#   SMB:
#       /Volumes/<SHARE>/sync2NAS
#
# Includes:
#   • Automatic SMB mount
#   • Detailed logging
#   • Reconciliation report
#   • Folder-by-folder file counts
#   • Final rsync verification
#
###############################################################################

set -Eeuo pipefail

###############################################
# Configuration
###############################################

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RSYNC="/usr/local/bin/rsync"

SERVER="192.168.1.50"
USER="rajadmin"
SHARE="wdc_home_share"

SOURCE="/Users/rajsiripuram02/Desktop/sync2NAS"
DEST_SUBDIR="sync2NAS"

MOUNT_POINT="/Volumes/${SHARE}"

DEST="${MOUNT_POINT}/${DEST_SUBDIR}"

LOG="${SCRIPT_DIR}/sync2NAS.log"
LOCKDIR="${SCRIPT_DIR}/.sync2NAS.lock"

###############################################
# Logging
###############################################

log() {
    echo "[$(date '+%F %T')] $*" | tee -a "$LOG"
}

cleanup() {
    rm -rf "$LOCKDIR"
}

trap cleanup EXIT

###############################################
# Prevent multiple instances
###############################################

if ! mkdir "$LOCKDIR" 2>/dev/null; then
    log "Another sync is already running."
    exit 1
fi

###############################################
# Header
###############################################

log "=========================================================="
log "sync2NAS Started"

###############################################
# Verify source
###############################################

if [[ ! -d "$SOURCE" ]]; then
    log "ERROR: Source folder missing:"
    log "$SOURCE"
    exit 1
fi

###############################################
# Mount SMB Share
###############################################

if ! mount | grep -q "on ${MOUNT_POINT} "; then

    log "Mounting SMB Share..."

    mkdir -p "$MOUNT_POINT"

    if ! mount_smbfs "//${USER}@${SERVER}/${SHARE}" "$MOUNT_POINT"; then
        log "ERROR mounting SMB share."
        exit 1
    fi

    sleep 2
fi

###############################################
# Verify mount
###############################################

if ! mount | grep -q "on ${MOUNT_POINT} "; then
    log "ERROR: SMB share not mounted."
    exit 1
fi

mkdir -p "$DEST"

###############################################
# rsync mode
###############################################

if [[ -t 1 ]]; then
    INFO="--info=progress2,stats2"
else
    INFO="--stats"
fi

###############################################
# Sync
###############################################

log "Source      : $SOURCE"
log "Destination : $DEST"
log "Running rsync..."

"$RSYNC" \
    -a \
    --partial \
    --append-verify \
    --human-readable \
    --timeout=300 \
    --no-owner \
    --no-group \
    $INFO \
    "$SOURCE/" \
    "$DEST/" \
    >>"$LOG" 2>&1

RC=$?

if [[ $RC -ne 0 ]]; then
    log "FAILED (Exit Code $RC)"
    log "=========================================================="
    exit $RC
fi

###############################################
# Reconciliation
###############################################

log ""
log "=========================================================="
log "RECONCILIATION REPORT"
log "=========================================================="

TMPDIR=$(mktemp -d)

SRC_TREE="$TMPDIR/src_tree.txt"
DST_TREE="$TMPDIR/dst_tree.txt"

###############################################
# Inventory function
###############################################

build_inventory() {

    ROOT="$1"
    OUT="$2"

    (
        cd "$ROOT"

        find . -type d | sort | while read DIR
        do

            COUNT=$(find "$DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')

            echo "${DIR}|${COUNT}"

        done

    ) > "$OUT"

}

###############################################
# Summary function
###############################################

summary() {

    ROOT="$1"
    NAME="$2"

    DIRS=$(find "$ROOT" -type d | wc -l | tr -d ' ')
    FILES=$(find "$ROOT" -type f | wc -l | tr -d ' ')
    SIZE=$(du -sh "$ROOT" | awk '{print $1}')

    log ""
    log "$NAME"
    log "Directories : $DIRS"
    log "Files       : $FILES"
    log "Size        : $SIZE"

}

summary "$SOURCE" "SOURCE"
summary "$DEST" "DESTINATION"

build_inventory "$SOURCE" "$SRC_TREE"
build_inventory "$DEST" "$DST_TREE"

###############################################
# Folder comparison
###############################################

log ""
log "Folder Schema"
log "----------------------------------------------------------"

MISMATCH=0

join -t '|' \
    "$SRC_TREE" \
    "$DST_TREE" | \
while IFS='|' read DIR SRCFILES DSTFILES
do

    STATUS="OK"

    if [[ "$SRCFILES" != "$DSTFILES" ]]; then
        STATUS="MISMATCH"
        ((MISMATCH++))
    fi

    printf "%-60s %6s %6s  %s\n" \
        "$DIR" \
        "$SRCFILES" \
        "$DSTFILES" \
        "$STATUS" \
        | tee -a "$LOG"

done

###############################################
# Dry-run verification
###############################################

VERIFY=$(mktemp)

"$RSYNC" \
    -an \
    --delete \
    "$SOURCE/" \
    "$DEST/" \
    >"$VERIFY"

if [[ -s "$VERIFY" ]]; then

    log ""
    log "Verification FAILED"
    log ""
    log "Differences detected:"
    cat "$VERIFY" >>"$LOG"

else

    log ""
    log "Verification PASSED"
    log "Source and destination are identical."

fi

###############################################
# Overall totals
###############################################

SRC_FILES=$(find "$SOURCE" -type f | wc -l | tr -d ' ')
DST_FILES=$(find "$DEST" -type f | wc -l | tr -d ' ')

SRC_DIRS=$(find "$SOURCE" -type d | wc -l | tr -d ' ')
DST_DIRS=$(find "$DEST" -type d | wc -l | tr -d ' ')

log ""
log "=========================================================="
log "SUMMARY"
log "=========================================================="

log "Directories : $SRC_DIRS / $DST_DIRS"
log "Files       : $SRC_FILES / $DST_FILES"

if [[ "$SRC_FILES" == "$DST_FILES" ]] &&
   [[ "$SRC_DIRS" == "$DST_DIRS" ]] &&
   [[ ! -s "$VERIFY" ]]
then

    log ""
    log "RECONCILIATION PASSED"

else

    log ""
    log "RECONCILIATION FAILED"

fi

rm -rf "$TMPDIR"
rm -f "$VERIFY"

###############################################
# Finish
###############################################

log ""
log "SUCCESS"
log "Finished"
log "=========================================================="

exit 0
