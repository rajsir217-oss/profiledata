from __future__ import annotations

import datetime as dt
from pathlib import Path

from .common import ensure_dir


class Logger:
    def __init__(self, log_file: Path) -> None:
        self.log_file = log_file
        ensure_dir(log_file.parent)
        self.log_file.touch(exist_ok=True)

    def _write(self, level: str, message: str) -> None:
        ts = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"{ts} [{level}] {message}"
        print(line, flush=True)
        with self.log_file.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")

    def info(self, message: str) -> None:
        self._write("INFO", message)

    def warn(self, message: str) -> None:
        self._write("WARN", message)

    def error(self, message: str) -> None:
        self._write("ERROR", message)

    def success(self, message: str) -> None:
        self._write("SUCCESS", message)

    def header(self, message: str) -> None:
        border = "=" * 56
        self.info(border)
        self.info(message)
        self.info(border)


def rotate_logs(log_file: Path, archive_dir: Path, retention_days: int) -> None:
    ensure_dir(archive_dir)
    if log_file.exists() and log_file.stat().st_size > 0:
        ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        archived = archive_dir / f"sync2NAS_{ts}.log"
        log_file.replace(archived)

    cutoff = dt.datetime.now() - dt.timedelta(days=retention_days)
    for entry in archive_dir.glob("sync2NAS_*.log"):
        modified = dt.datetime.fromtimestamp(entry.stat().st_mtime)
        if modified < cutoff:
            entry.unlink(missing_ok=True)

    ensure_dir(log_file.parent)
    log_file.touch(exist_ok=True)
