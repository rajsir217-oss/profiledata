# sync2NAS Python v2

Production-oriented backup workflow orchestrated in Python, using `rsync` as transfer engine.

## Files

- `sync2NAS.py`: Main orchestrator
- `config.py`: Settings loader
- `config.local.json`: Optional local overrides
- `lib/`: Modular components (`logging`, `lock`, `heartbeat`, `smb`, `rsync`, `inventory`, `reconcile`, `verify`, `report`, `timer`, `state`)
- `cache/`: Inventories, reconciliation output, verification diff, `last_run.json`
- `logs/`: Main log and archives
- `launchd/com.rajsiripuram.sync2NAS.plist`: LaunchAgent template
- `install.sh`, `uninstall.sh`: LaunchAgent management

## Quick Start

1. Create local overrides:

```json
{
  "server": "192.168.1.50",
  "smb_user": "rajadmin",
  "share": "wdc_home_share",
  "source": "/Users/rajsiripuram02/Desktop/sync2NAS",
  "dest_subdir": "sync2NAS",
  "heartbeat_interval": 60,
  "verify": true,
  "delete_extraneous": false,
  "exclude_patterns": [".DS_Store", "._*", ".Spotlight-V100", ".Trashes", ".fseventsd", "Thumbs.db"],
  "relax_metadata": true,
  "modify_window_seconds": 2,
  "max_retries": 3,
  "retry_delay_seconds": 5,
  "log_retention_days": 90
}
```

Save as `config.local.json` in this folder.

2. Run manually:

```bash
python3 sync2NAS.py
```

Preflight checks only (no rsync, no inventory/reconcile):

```bash
python3 sync2NAS.py --check
```

3. Install schedule with launchd:

```bash
./install.sh
```

## Notes

- For launchd to access Desktop/Documents, grant Full Disk Access (or move source outside protected folders).
- `cache/last_run.json` keeps the latest run metadata for status/history features.
- Default excludes remove macOS noise files (`.DS_Store`, `._*`, `.Spotlight-V100`, `.Trashes`, `.fseventsd`).
- `relax_metadata=true` reduces SMB false mismatches by ignoring strict perms/times and using `size-only` comparison semantics.
- Reconciliation uses one-way policy: destination extras are allowed; run fails only when destination is missing source folders/files.
- Pipe-delimited inventory format:

```text
relative_folder|files|subdirectories|bytes
```
