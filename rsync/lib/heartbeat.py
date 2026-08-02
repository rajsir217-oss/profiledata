from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from .logging import Logger


@dataclass
class HeartbeatState:
    phase: str = "Initialize"
    folders_processed: int = 0
    folders_total: int = 0


class Heartbeat:
    def __init__(self, logger: Logger, interval_seconds: int) -> None:
        self.logger = logger
        self.interval_seconds = max(interval_seconds, 5)
        self.state = HeartbeatState()
        self.started_at = time.monotonic()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return

        def _run() -> None:
            while not self._stop_event.wait(self.interval_seconds):
                elapsed = int(time.monotonic() - self.started_at)
                mins, secs = divmod(elapsed, 60)
                msg = (
                    f"Heartbeat... phase={self.state.phase}; elapsed={mins}m {secs}s"
                )
                if self.state.folders_total > 0:
                    msg += (
                        f"; folders={self.state.folders_processed}/"
                        f"{self.state.folders_total}"
                    )
                self.logger.info(msg)

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()

    def update_phase(self, phase: str) -> None:
        self.state.phase = phase

    def update_progress(self, processed: int, total: int) -> None:
        self.state.folders_processed = max(processed, 0)
        self.state.folders_total = max(total, 0)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
