from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class TimerManager:
    start_ts: float = field(default_factory=time.monotonic)
    marks: dict[str, float] = field(default_factory=dict)
    durations: dict[str, float] = field(default_factory=dict)

    def start(self, name: str) -> None:
        self.marks[name] = time.monotonic()

    def stop(self, name: str) -> float:
        started = self.marks.get(name)
        if started is None:
            return 0.0
        duration = time.monotonic() - started
        self.durations[name] = duration
        return duration

    def total_runtime(self) -> float:
        return time.monotonic() - self.start_ts
