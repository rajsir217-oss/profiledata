from __future__ import annotations

from pathlib import Path

from .common import format_bytes, format_duration
from .inventory import InventorySummary
from .reconcile import ReconcileSummary
from .rsync import RsyncSummary
from .timer import TimerManager
from .verify import VerifyResult


def build_report(
    source_summary: InventorySummary,
    dest_summary: InventorySummary,
    rsync_summary: RsyncSummary,
    reconcile_summary: ReconcileSummary,
    verify_result: VerifyResult | None,
    timers: TimerManager,
) -> str:
    verify_text = "SKIPPED"
    if verify_result is not None:
        verify_text = "PASSED" if verify_result.passed else "FAILED"

    lines = [
        "====================================================",
        "SUMMARY",
        "====================================================",
        f"Source Directories: {source_summary.directories}",
        f"Destination Directories: {dest_summary.directories}",
        f"Source Files: {source_summary.files}",
        f"Destination Files: {dest_summary.files}",
        f"Source Size: {format_bytes(source_summary.bytes)}",
        f"Destination Size: {format_bytes(dest_summary.bytes)}",
        f"Transferred Files: {rsync_summary.files_transferred}",
        f"Deleted Files: {rsync_summary.files_deleted}",
        f"Bytes Sent: {format_bytes(rsync_summary.bytes_sent)}",
        f"Bytes Received: {format_bytes(rsync_summary.bytes_received)}",
        f"Folder Mismatches: {reconcile_summary.folder_mismatches}",
        f"File Count Mismatches: {reconcile_summary.file_count_mismatches}",
        f"Missing Destination Folders: {reconcile_summary.source_missing_folders}",
        f"Missing Destination Files: {reconcile_summary.source_missing_files}",
        f"Destination Extra Folders: {reconcile_summary.destination_extra_folders}",
        f"Destination Extra Files: {reconcile_summary.destination_extra_files}",
        f"Verification: {verify_text}",
        "",
        f"Mount Time: {format_duration(timers.durations.get('mount', 0))}",
        f"Sync Time: {format_duration(timers.durations.get('sync', 0))}",
        f"Source Inventory Time: {format_duration(timers.durations.get('inventory_source', 0))}",
        f"Destination Inventory Time: {format_duration(timers.durations.get('inventory_dest', 0))}",
        f"Reconciliation Time: {format_duration(timers.durations.get('reconcile', 0))}",
        f"Verification Time: {format_duration(timers.durations.get('verify', 0))}",
        f"Total Runtime: {format_duration(timers.total_runtime())}",
        "====================================================",
    ]
    return "\n".join(lines)


def write_report(report_text: str, report_file: Path) -> None:
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text(report_text + "\n", encoding="utf-8")
