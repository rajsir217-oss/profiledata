from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any


class StateWriter:
    def __init__(self, state_file: Path) -> None:
        self.state_file = state_file

    def write(self, payload: dict[str, Any]) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with self.state_file.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")


def new_run_state() -> dict[str, Any]:
    now = dt.datetime.now()
    return {
        "started_at": now.isoformat(),
        "finished_at": None,
        "status": "running",
        "exit_code": None,
        "duration_seconds": None,
        "verification": "unknown",
        "summary": {},
        "timings": {},
    }
