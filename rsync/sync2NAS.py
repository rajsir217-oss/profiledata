#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

from config import load_settings
from lib.common import ensure_dir
from lib.heartbeat import Heartbeat
from lib.inventory import build_inventory, read_inventory
from lib.lock import PidLock
from lib.logging import Logger, rotate_logs
from lib.reconcile import reconcile
from lib.report import build_report, write_report
from lib.rsync import RsyncSummary, run_rsync
from lib.smb import SmbManager
from lib.state import StateWriter, new_run_state
from lib.timer import TimerManager
from lib.verify import VerifyResult, verify_dry_run


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="sync2NAS backup orchestrator",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Run preflight checks only (source/destination access + SMB mount), then exit.",
    )
    return parser.parse_args(argv)


def _assert_dir_access(path: Path, label: str, needs_write: bool) -> None:
    required: list[tuple[int, str]] = [
        (os.R_OK, "read"),
        (os.X_OK, "traverse"),
    ]
    if needs_write:
        required.append((os.W_OK, "write"))

    missing = [name for flag, name in required if not os.access(path, flag)]
    if missing:
        missing_text = ", ".join(missing)
        raise PermissionError(
            f"{label} access check failed for {path}. Missing permissions: {missing_text}. "
            "For launchd jobs on macOS, grant Full Disk Access (or Files & Folders access) "
            "to the launching context, or move source/destination to permitted paths."
        )

    try:
        next(path.iterdir(), None)
    except PermissionError as exc:
        raise PermissionError(
            f"{label} cannot be listed: {path}. This usually indicates macOS privacy (TCC) denial "
            "for launchd/background context."
        ) from exc

    if needs_write:
        probe = path / f".sync2nas_write_probe_{os.getpid()}"
        try:
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
        except OSError as exc:
            raise PermissionError(
                f"{label} is not writable: {path}. macOS launchd context may not have write access."
            ) from exc


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    settings = load_settings(Path(__file__).resolve().parent)

    ensure_dir(settings.cache_dir)
    ensure_dir(settings.archive_dir)
    rotate_logs(settings.log_file, settings.archive_dir, settings.log_retention_days)

    logger = Logger(settings.log_file)
    timers = TimerManager()
    state_writer = StateWriter(settings.state_file)
    state = new_run_state()
    state["mode"] = "check" if args.check else "sync"

    pid_lock = PidLock(settings.pid_file)
    existing = pid_lock.existing()
    if existing is not None:
        logger.warn("Another sync is already running.")
        logger.warn(f"PID: {existing.pid}")
        logger.warn(f"Started: {existing.started_at}")
        logger.warn(f"Running: {existing.elapsed}")
        return 1

    pid_lock.acquire()

    heartbeat = Heartbeat(logger=logger, interval_seconds=settings.heartbeat_interval)
    heartbeat.start()

    smb = SmbManager(
        logger=logger,
        server=settings.server,
        smb_user=settings.smb_user,
        share=settings.share,
        mount_point=settings.mount_point,
        max_retries=settings.max_retries,
        retry_delay_seconds=settings.retry_delay_seconds,
    )

    source_summary = None
    dest_summary = None
    rsync_summary = RsyncSummary()
    reconcile_summary = None
    verify_result: VerifyResult | None = None

    exit_code = 1
    final_status = "failed"

    try:
        logger.header(
            "sync2NAS Preflight Check Started" if args.check else "sync2NAS Started"
        )
        logger.info(f"Source: {settings.source}")
        logger.info(f"Destination: {settings.destination}")
        logger.info(
            "Sync policy: "
            f"relax_metadata={settings.relax_metadata}, "
            f"modify_window_seconds={settings.modify_window_seconds}, "
            f"exclude_patterns={settings.exclude_patterns}"
        )

        if not settings.source.exists() or not settings.source.is_dir():
            raise RuntimeError(f"Source path is missing or invalid: {settings.source}")
        _assert_dir_access(settings.source, label="Source", needs_write=False)

        heartbeat.update_phase("Mount SMB")
        timers.start("mount")
        smb.mount()
        timers.stop("mount")

        ensure_dir(settings.destination)
        _assert_dir_access(settings.destination, label="Destination", needs_write=True)

        if args.check:
            final_status = "success"
            exit_code = 0
            logger.success("Preflight check PASSED")
            logger.info("SMB mount and source/destination permissions are valid.")
            return exit_code

        heartbeat.update_phase("Run rsync")
        timers.start("sync")
        rsync_summary = run_rsync(
            logger=logger,
            rsync_path=settings.rsync_path,
            source=settings.source,
            destination=settings.destination,
            timeout_seconds=settings.rsync_timeout,
            delete_extraneous=settings.delete_extraneous,
            exclude_patterns=settings.exclude_patterns,
            relax_metadata=settings.relax_metadata,
            modify_window_seconds=settings.modify_window_seconds,
            log_file=settings.log_file,
        )
        timers.stop("sync")

        heartbeat.update_phase("Build source inventory")
        timers.start("inventory_source")
        source_summary = build_inventory(
            root=settings.source,
            out_file=settings.source_inventory,
            exclude_patterns=settings.exclude_patterns,
            progress_cb=heartbeat.update_progress,
        )
        timers.stop("inventory_source")

        heartbeat.update_phase("Build destination inventory")
        timers.start("inventory_dest")
        dest_summary = build_inventory(
            root=settings.destination,
            out_file=settings.dest_inventory,
            exclude_patterns=settings.exclude_patterns,
            progress_cb=heartbeat.update_progress,
        )
        timers.stop("inventory_dest")

        heartbeat.update_phase("Reconcile")
        timers.start("reconcile")
        source_items = read_inventory(settings.source_inventory)
        dest_items = read_inventory(settings.dest_inventory)
        reconcile_summary = reconcile(
            source_items=source_items,
            dest_items=dest_items,
            out_file=settings.reconciliation_file,
        )
        timers.stop("reconcile")

        if settings.verify:
            heartbeat.update_phase("Verify")
            timers.start("verify")
            verify_result = verify_dry_run(
                rsync_path=settings.rsync_path,
                source=settings.source,
                destination=settings.destination,
                diff_file=settings.verify_diff_file,
                delete_extraneous=settings.delete_extraneous,
                exclude_patterns=settings.exclude_patterns,
                relax_metadata=settings.relax_metadata,
                modify_window_seconds=settings.modify_window_seconds,
            )
            timers.stop("verify")
            if verify_result.passed:
                logger.success("Verification PASSED")
            else:
                logger.error(
                    f"Verification FAILED with {verify_result.diff_count} differences"
                )

        reconcile_ok = (
            reconcile_summary.source_missing_folders == 0
            and reconcile_summary.source_missing_files == 0
        )
        destination_has_extras = (
            reconcile_summary.destination_extra_folders > 0
            or reconcile_summary.destination_extra_files > 0
        )
        verify_ok = verify_result.passed if verify_result is not None else True

        if reconcile_ok and verify_ok:
            final_status = "success"
            exit_code = 0
            if destination_has_extras:
                logger.warn(
                    "RECONCILIATION PASSED with destination extras "
                    "(allowed for one-way sync policy)"
                )
            else:
                logger.success("RECONCILIATION PASSED")
        else:
            final_status = "failed"
            exit_code = 2
            logger.error(
                "RECONCILIATION FAILED "
                f"(missing_folders={reconcile_summary.source_missing_folders}, "
                f"missing_files={reconcile_summary.source_missing_files})"
            )

        report = build_report(
            source_summary=source_summary,
            dest_summary=dest_summary,
            rsync_summary=rsync_summary,
            reconcile_summary=reconcile_summary,
            verify_result=verify_result,
            timers=timers,
        )
        write_report(report, settings.report_file)
        for line in report.splitlines():
            if line.startswith("Destination Extra Folders:") or line.startswith(
                "Destination Extra Files:"
            ):
                logger.success(line)
            else:
                logger.info(line)

    except Exception as exc:
        logger.error(f"sync2NAS failed: {exc}")
        final_status = "failed"
        exit_code = 1
    finally:
        heartbeat.stop()
        if settings.unmount_after_run and smb.mounted_by_script:
            try:
                smb.unmount()
            except Exception as exc:
                logger.warn(f"Unmount failed: {exc}")

        pid_lock.release()

        finished = dt.datetime.now()
        started = dt.datetime.fromisoformat(state["started_at"])
        duration = (finished - started).total_seconds()

        state["finished_at"] = finished.isoformat()
        state["status"] = final_status
        state["exit_code"] = exit_code
        state["duration_seconds"] = round(duration, 3)
        state["verification"] = (
            "skipped"
            if verify_result is None
            else ("passed" if verify_result.passed else "failed")
        )
        state["summary"] = {
            "source_directories": getattr(source_summary, "directories", 0),
            "destination_directories": getattr(dest_summary, "directories", 0),
            "source_files": getattr(source_summary, "files", 0),
            "destination_files": getattr(dest_summary, "files", 0),
            "source_bytes": getattr(source_summary, "bytes", 0),
            "destination_bytes": getattr(dest_summary, "bytes", 0),
            "folders_checked": getattr(reconcile_summary, "folders_checked", 0),
            "folder_mismatches": getattr(reconcile_summary, "folder_mismatches", 0),
            "file_count_mismatches": getattr(
                reconcile_summary, "file_count_mismatches", 0
            ),
            "source_missing_folders": getattr(
                reconcile_summary, "source_missing_folders", 0
            ),
            "source_missing_files": getattr(
                reconcile_summary, "source_missing_files", 0
            ),
            "destination_extra_folders": getattr(
                reconcile_summary, "destination_extra_folders", 0
            ),
            "destination_extra_files": getattr(
                reconcile_summary, "destination_extra_files", 0
            ),
            "files_transferred": rsync_summary.files_transferred,
            "files_deleted": rsync_summary.files_deleted,
            "bytes_sent": rsync_summary.bytes_sent,
            "bytes_received": rsync_summary.bytes_received,
        }
        state["timings"] = timers.durations
        state_writer.write(state)

        logger.header("sync2NAS Finished")
        logger.info(f"Status: {final_status.upper()}")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())



# TODO:
# For your setup, the safest practical unattended option is:

# Keep it as a user LaunchAgent (not daemon/root).
# Run it under a dedicated non-admin macOS account just for backups.
# Keep that account logged in with screen locked during backup windows.
# Keep source/destination permissions minimal (read source, write NAS only).
# Store SMB creds in the user keychain (avoid plain-text secrets if possible).
# Why this is safest:

# Avoids running backup as root/system daemon.
# Avoids macOS TCC/privacy breakage you get with Desktop paths in daemon mode.
# Limits blast radius if that account is compromised.
# What to avoid:

# LaunchDaemon as root against Desktop/Documents
# Auto-login of your main daily account
# If you want true “runs even after reboot with nobody logged in,” I can help you design a hardened daemon setup, but it requires moving source out of protected folders and using a service-account model.



# Feedback submitted