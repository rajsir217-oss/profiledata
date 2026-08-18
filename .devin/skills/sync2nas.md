---
description: Run and troubleshoot the sync2NAS backup job.
---

# Skill: Run sync2NAS Backup

## Configuration

- Main orchestrator: `rsync/sync2NAS.py`
- Settings: `rsync/config.py` with optional `rsync/config.local.json` overrides.
- Library modules: `rsync/lib/{common,logging,lock,heartbeat,smb,rsync,inventory,reconcile,verify,report,timer,state}`.
- Launchd: `rsync/launchd/com.rajsiripuram.sync2NAS.plist`, plus `install.sh` / `uninstall.sh`.

## Run a backup

From the repo root:

```bash
python3 rsync/sync2NAS.py
```

Force a full run even when the source fingerprint is unchanged:

```bash
python3 rsync/sync2NAS.py --force
```

## Source fingerprint skip

- Before mount/rsync, the orchestrator compares the current source metadata fingerprint to `cache/source_fingerprint.json`.
- If unchanged, it exits early with `SUCCESS_SKIPPED_NO_CHANGES` and writes summary/state.
- On successful full runs, it persists the updated fingerprint.

## Reconciliation policy

This is a one-way sync/backup. Destination extra files/folders are acceptable. Reconciliation should fail only when the destination is missing source content (missing folders/files), not when the destination has additional content.

## Preflight checks

- `_assert_dir_access` verifies source (read/traverse/list) and destination (read/traverse/write/list + write probe).
- Failures include explicit macOS TCC/privacy guidance.

## Dual status model

- `last_run.json` contains both `user_status` and `process_status`.
- User statuses: `SUCCESS`, `SUCCESS_WITH_WARNINGS`, `ACTION_REQUIRED`.
- Process status: `SUCCESS` or `FAILED`, driving the exit code.
- A run can end with `user_status=SUCCESS_WITH_WARNINGS` and `process_status=FAILED` when destination extras exist.

## Verification and troubleshooting

- Inspect `rsync/cache/last_run.json` for run metadata.
- Review logs and `verify.diff` for itemized differences.
- Common false positives: `.DS_Store` entries and SMB timestamp drift; `relax_metadata=True` filters metadata-only rsync lines (prefix `.`) from verification differences.
