from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .logging import Logger


@dataclass
class RsyncSummary:
    bytes_sent: int = 0
    bytes_received: int = 0
    files_transferred: int = 0
    files_deleted: int = 0
    elapsed_line: str = ""


def _extract_int(line: str) -> int:
    digits = re.sub(r"[^0-9]", "", line)
    if not digits:
        return 0
    return int(digits)


def _supports_append_verify(rsync_path: str) -> bool:
    result = subprocess.run(
        [rsync_path, "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return False

    first_line = (result.stdout or "").splitlines()
    if not first_line:
        return False

    match = re.search(r"version\s+(\d+)\.(\d+)\.(\d+)", first_line[0])
    if not match:
        return False

    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3))
    return (major, minor, patch) >= (3, 0, 0)


def run_rsync(
    logger: Logger,
    rsync_path: str,
    source: Path,
    destination: Path,
    timeout_seconds: int,
    delete_extraneous: bool,
    exclude_patterns: list[str],
    relax_metadata: bool,
    modify_window_seconds: int,
    log_file: Path,
) -> RsyncSummary:
    supports_append_verify = _supports_append_verify(rsync_path)

    cmd = [
        rsync_path,
        "-a",
        "--partial",
        "--human-readable",
        f"--timeout={timeout_seconds}",
        "--no-owner",
        "--no-group",
        "--stats",
    ]

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

    if supports_append_verify:
        cmd.append("--append-verify")
        logger.info("Using rsync append mode: --append-verify")
    else:
        cmd.append("--append")
        logger.info("Using rsync append mode: --append (compat mode)")

    if delete_extraneous:
        cmd.append("--delete")

    cmd.extend([f"{source}/", f"{destination}/"])

    logger.info("Running rsync...")
    with log_file.open("a", encoding="utf-8") as handle:
        process = subprocess.run(
            cmd,
            stdout=handle,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
    if process.returncode != 0:
        raise RuntimeError(f"rsync failed with exit code {process.returncode}")

    text = log_file.read_text(encoding="utf-8", errors="replace")
    summary = RsyncSummary()
    for line in text.splitlines()[-200:]:
        if "Number of regular files transferred:" in line:
            summary.files_transferred = _extract_int(line)
        elif "Number of deleted files:" in line:
            summary.files_deleted = _extract_int(line)
        elif "Total bytes sent:" in line:
            summary.bytes_sent = _extract_int(line)
        elif "Total bytes received:" in line:
            summary.bytes_received = _extract_int(line)
        elif line.strip().startswith("sent ") and " bytes/sec" in line:
            summary.elapsed_line = line.strip()

    logger.info(
        "rsync complete: "
        f"files_transferred={summary.files_transferred}, "
        f"files_deleted={summary.files_deleted}, "
        f"bytes_sent={summary.bytes_sent}, "
        f"bytes_received={summary.bytes_received}"
    )
    return summary
