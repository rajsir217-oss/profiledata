from __future__ import annotations

import os
from fnmatch import fnmatch
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable


@dataclass
class InventoryEntry:
    relative_folder: str
    files: int
    subdirectories: int
    bytes: int


@dataclass
class InventorySummary:
    directories: int = 0
    files: int = 0
    bytes: int = 0


def _normalize_relative(path: str) -> str:
    if path == ".":
        return "."
    return path.lstrip("./")


def build_inventory(
    root: Path,
    out_file: Path,
    exclude_patterns: list[str],
    progress_cb: Callable[[int, int], None] | None = None,
) -> InventorySummary:
    entries: list[InventoryEntry] = []

    def is_excluded(name: str) -> bool:
        return any(fnmatch(name, pattern) for pattern in exclude_patterns)

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if not is_excluded(name)]
        filenames = [name for name in filenames if not is_excluded(name)]

        rel = os.path.relpath(dirpath, root)
        rel = _normalize_relative(rel)
        file_count = 0
        byte_count = 0

        for name in filenames:
            full_path = Path(dirpath) / name
            try:
                st = full_path.stat()
            except OSError:
                continue
            if full_path.is_file():
                file_count += 1
                byte_count += int(st.st_size)

        entries.append(
            InventoryEntry(
                relative_folder=rel,
                files=file_count,
                subdirectories=len(dirnames),
                bytes=byte_count,
            )
        )

    entries.sort(key=lambda item: item.relative_folder)

    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8") as handle:
        total = len(entries)
        for idx, entry in enumerate(entries, start=1):
            handle.write(
                f"{entry.relative_folder}|{entry.files}|{entry.subdirectories}|{entry.bytes}\n"
            )
            if progress_cb:
                progress_cb(idx, total)

    summary = InventorySummary()
    summary.directories = len(entries)
    summary.files = sum(item.files for item in entries)
    summary.bytes = sum(item.bytes for item in entries)
    return summary


def read_inventory(path: Path) -> dict[str, InventoryEntry]:
    items: dict[str, InventoryEntry] = {}
    if not path.exists():
        return items

    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) != 4:
            continue
        folder, files, subdirs, byte_count = parts
        try:
            items[folder] = InventoryEntry(
                relative_folder=folder,
                files=int(files),
                subdirectories=int(subdirs),
                bytes=int(byte_count),
            )
        except ValueError:
            continue
    return items
