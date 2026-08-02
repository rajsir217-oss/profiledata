from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .inventory import InventoryEntry


@dataclass
class ReconcileSummary:
    folders_checked: int = 0
    folder_mismatches: int = 0
    file_count_mismatches: int = 0
    source_missing_folders: int = 0
    source_missing_files: int = 0
    destination_extra_folders: int = 0
    destination_extra_files: int = 0


def reconcile(
    source_items: dict[str, InventoryEntry],
    dest_items: dict[str, InventoryEntry],
    out_file: Path,
) -> ReconcileSummary:
    rows: list[str] = []
    summary = ReconcileSummary()

    all_folders = sorted(set(source_items.keys()) | set(dest_items.keys()))

    for folder in all_folders:
        src = source_items.get(folder)
        dst = dest_items.get(folder)

        src_files = src.files if src else 0
        dst_files = dst.files if dst else 0

        if src and dst:
            if src_files == dst_files:
                status = "OK"
            elif src_files > dst_files:
                status = "MISSING_DEST_FILES"
                summary.source_missing_files += src_files - dst_files
            else:
                status = "EXTRA_DEST_FILES"
                summary.destination_extra_files += dst_files - src_files
        elif src and not dst:
            status = "MISSING_DEST_FOLDER"
            summary.source_missing_folders += 1
            summary.source_missing_files += src_files
        else:
            status = "EXTRA_DEST_FOLDER"
            summary.destination_extra_folders += 1
            summary.destination_extra_files += dst_files

        if status != "OK":
            summary.folder_mismatches += 1
        if src_files != dst_files:
            summary.file_count_mismatches += 1

        summary.folders_checked += 1
        rows.append(f"{folder}|{src_files}|{dst_files}|{status}")

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")
    return summary
