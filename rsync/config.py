#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Settings:
    script_dir: Path
    server: str
    smb_user: str
    share: str
    source: Path
    dest_subdir: str
    mount_point: Path
    destination: Path
    rsync_path: str
    rsync_timeout: int
    heartbeat_interval: int
    verify: bool
    delete_extraneous: bool
    exclude_patterns: list[str]
    relax_metadata: bool
    modify_window_seconds: int
    log_retention_days: int
    max_retries: int
    retry_delay_seconds: int
    unmount_after_run: bool
    log_file: Path
    archive_dir: Path
    pid_file: Path
    cache_dir: Path
    source_inventory: Path
    dest_inventory: Path
    verify_diff_file: Path
    reconciliation_file: Path
    state_file: Path
    report_file: Path


def _as_bool(value: Any, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _discover_rsync() -> str:
    for candidate in (
        shutil.which("rsync"),
        "/opt/homebrew/bin/rsync",
        "/usr/local/bin/rsync",
        "/usr/bin/rsync",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    raise FileNotFoundError("Unable to find rsync in PATH or common locations")


def load_settings(script_dir: Path | None = None) -> Settings:
    base = Path(script_dir) if script_dir else Path(__file__).resolve().parent

    defaults: dict[str, Any] = {
        "server": "192.168.1.50",
        "smb_user": "rajadmin",
        "share": "wdc_home_share",
        "source": "/Users/rajsiripuram02/Desktop/sync2NAS",
        "dest_subdir": "sync2NAS",
        "heartbeat_interval": 60,
        "verify": True,
        "delete_extraneous": False,
        "exclude_patterns": [
            ".DS_Store",
            "._*",
            ".Spotlight-V100",
            ".Trashes",
            ".fseventsd",
            "Thumbs.db",
        ],
        "relax_metadata": True,
        "modify_window_seconds": 2,
        "log_retention_days": 90,
        "max_retries": 3,
        "retry_delay_seconds": 5,
        "rsync_timeout": 300,
        "unmount_after_run": False,
    }

    config_path = base / "config.local.json"
    if config_path.exists():
        with config_path.open("r", encoding="utf-8") as handle:
            overrides = json.load(handle)
        defaults.update(overrides)

    share = str(defaults["share"])
    mount_point = Path(defaults.get("mount_point") or f"/Volumes/{share}")
    destination = mount_point / str(defaults["dest_subdir"])
    patterns_raw = defaults.get("exclude_patterns")
    if isinstance(patterns_raw, str):
        exclude_patterns = [patterns_raw]
    elif isinstance(patterns_raw, (list, tuple)):
        exclude_patterns = [str(item).strip() for item in patterns_raw if str(item).strip()]
    else:
        exclude_patterns = []

    return Settings(
        script_dir=base,
        server=str(defaults["server"]),
        smb_user=str(defaults["smb_user"]),
        share=share,
        source=Path(str(defaults["source"])),
        dest_subdir=str(defaults["dest_subdir"]),
        mount_point=mount_point,
        destination=destination,
        rsync_path=str(defaults.get("rsync_path") or _discover_rsync()),
        rsync_timeout=int(defaults["rsync_timeout"]),
        heartbeat_interval=int(defaults["heartbeat_interval"]),
        verify=_as_bool(defaults.get("verify"), True),
        delete_extraneous=_as_bool(defaults.get("delete_extraneous"), False),
        exclude_patterns=exclude_patterns,
        relax_metadata=_as_bool(defaults.get("relax_metadata"), True),
        modify_window_seconds=int(defaults.get("modify_window_seconds", 2)),
        log_retention_days=int(defaults["log_retention_days"]),
        max_retries=int(defaults["max_retries"]),
        retry_delay_seconds=int(defaults["retry_delay_seconds"]),
        unmount_after_run=_as_bool(defaults.get("unmount_after_run"), False),
        log_file=base / "logs" / "sync2NAS.log",
        archive_dir=base / "logs" / "archive",
        pid_file=base / "sync2NAS.pid",
        cache_dir=base / "cache",
        source_inventory=base / "cache" / "source.inventory",
        dest_inventory=base / "cache" / "dest.inventory",
        verify_diff_file=base / "cache" / "verify.diff",
        reconciliation_file=base / "cache" / "reconciliation.txt",
        state_file=base / "cache" / "last_run.json",
        report_file=base / "cache" / "last_report.txt",
    )
