from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VerifyResult:
    passed: bool
    diff_count: int


def verify_dry_run(
    rsync_path: str,
    source: Path,
    destination: Path,
    diff_file: Path,
    delete_extraneous: bool,
    exclude_patterns: list[str],
    relax_metadata: bool,
    modify_window_seconds: int,
) -> VerifyResult:
    cmd = [rsync_path, "-an", "--itemize-changes"]

    if relax_metadata:
        cmd.extend(
            [
                "--no-perms",
                "--no-times",
                "--omit-dir-times",
                "--size-only",
                f"--modify-window={max(modify_window_seconds, 0)}",
            ]
        )

    for pattern in exclude_patterns:
        cmd.extend(["--exclude", pattern])

    if delete_extraneous:
        cmd.append("--delete")
    cmd.extend([f"{source}/", f"{destination}/"])

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"verify rsync failed with exit code {result.returncode}")

    lines = [line for line in result.stdout.splitlines() if line.strip()]
    diff_file.parent.mkdir(parents=True, exist_ok=True)
    diff_file.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    return VerifyResult(passed=len(lines) == 0, diff_count=len(lines))
