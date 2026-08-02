from __future__ import annotations

import datetime as dt
import json
import os
import signal
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ExistingLockInfo:
    pid: int
    started_at: str
    elapsed: str


def _format_elapsed(seconds: float) -> str:
    total = int(max(seconds, 0))
    hrs, rem = divmod(total, 3600)
    mins, secs = divmod(rem, 60)
    if hrs > 0:
        return f"{hrs}h {mins}m {secs}s"
    if mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"


def _is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


class PidLock:
    def __init__(self, path: Path) -> None:
        self.path = path

    def existing(self) -> ExistingLockInfo | None:
        if not self.path.exists():
            return None

        try:
            raw = self.path.read_text(encoding="utf-8").strip()
            payload = json.loads(raw)
            pid = int(payload.get("pid"))
            started_ts = float(payload.get("started_ts"))
            started_at = payload.get("started_at", "unknown")
        except Exception:
            self.path.unlink(missing_ok=True)
            return None

        if not _is_alive(pid):
            self.path.unlink(missing_ok=True)
            return None

        elapsed = _format_elapsed(dt.datetime.now().timestamp() - started_ts)
        return ExistingLockInfo(pid=pid, started_at=started_at, elapsed=elapsed)

    def acquire(self) -> None:
        now = dt.datetime.now()
        payload = {
            "pid": os.getpid(),
            "started_at": now.strftime("%Y-%m-%d %H:%M:%S"),
            "started_ts": now.timestamp(),
        }
        self.path.write_text(json.dumps(payload), encoding="utf-8")

    def release(self) -> None:
        self.path.unlink(missing_ok=True)
