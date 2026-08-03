#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from fnmatch import fnmatch
from hashlib import blake2b
from pathlib import Path

from config import load_settings
from lib.common import ensure_dir
from lib.heartbeat import Heartbeat
from lib.inventory import InventorySummary, build_inventory, read_inventory
from lib.lock import PidLock
from lib.logging import Logger, rotate_logs
from lib.reconcile import ReconcileSummary, reconcile
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
    parser.add_argument(
        "--force",
        action="store_true",
        help="Run sync even if source fingerprint indicates no changes.",
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


def _is_excluded(name: str, exclude_patterns: list[str]) -> bool:
    return any(fnmatch(name, pattern) for pattern in exclude_patterns)


def _build_source_fingerprint(
    root: Path,
    exclude_patterns: list[str],
) -> dict[str, int | str]:
    hasher = blake2b(digest_size=16)
    hasher.update(
        f"EXCLUDE|{','.join(sorted(exclude_patterns))}\n".encode("utf-8")
    )

    directories = 0
    files = 0
    total_bytes = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(
            name for name in dirnames if not _is_excluded(name, exclude_patterns)
        )
        filenames = sorted(
            name for name in filenames if not _is_excluded(name, exclude_patterns)
        )

        rel_dir = os.path.relpath(dirpath, root)
        rel_dir = "." if rel_dir == "." else rel_dir.lstrip("./")

        directories += 1
        hasher.update(f"D|{rel_dir}\n".encode("utf-8"))

        for name in filenames:
            full_path = Path(dirpath) / name
            try:
                st = full_path.stat()
            except OSError:
                continue
            if not full_path.is_file():
                continue

            rel_file = name if rel_dir == "." else f"{rel_dir}/{name}"
            size = int(st.st_size)
            mtime_ns = int(st.st_mtime_ns)

            files += 1
            total_bytes += size
            hasher.update(f"F|{rel_file}|{size}|{mtime_ns}\n".encode("utf-8"))

    return {
        "signature": hasher.hexdigest(),
        "directories": directories,
        "files": files,
        "bytes": total_bytes,
        "scanned_at": dt.datetime.now().isoformat(),
    }


def _read_source_fingerprint(path: Path) -> dict[str, int | str] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    signature = payload.get("signature")
    if not isinstance(signature, str) or not signature:
        return None
    return payload


def _write_source_fingerprint(path: Path, payload: dict[str, int | str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


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
    source_fingerprint: dict[str, int | str] | None = None

    exit_code = 1
    final_status = "failed"
    user_status = "ACTION_REQUIRED"

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

        source_fingerprint_path = settings.cache_dir / "source_fingerprint.json"
        logger.info(f"Source fingerprint cache: {source_fingerprint_path}")

        if not settings.source.exists() or not settings.source.is_dir():
            raise RuntimeError(f"Source path is missing or invalid: {settings.source}")
        _assert_dir_access(settings.source, label="Source", needs_write=False)

        if not args.check:
            heartbeat.update_phase("Scan source changes")
            timers.start("source_scan")
            source_fingerprint = _build_source_fingerprint(
                root=settings.source,
                exclude_patterns=settings.exclude_patterns,
            )
            timers.stop("source_scan")

            current_signature = str(source_fingerprint.get("signature", ""))
            logger.info(
                "Current source fingerprint: "
                f"{current_signature[:12]} "
                f"(dirs={source_fingerprint.get('directories', 0)}, "
                f"files={source_fingerprint.get('files', 0)}, "
                f"bytes={source_fingerprint.get('bytes', 0)})"
            )

            if args.force:
                logger.info(
                    "Force mode enabled: running sync regardless of source fingerprint."
                )
            else:
                previous_fingerprint = _read_source_fingerprint(source_fingerprint_path)
                if previous_fingerprint is None:
                    logger.info(
                        "No previous source fingerprint found; running full sync."
                    )
                else:
                    previous_signature = str(previous_fingerprint.get("signature", ""))
                    logger.info(
                        "Previous source fingerprint: " f"{previous_signature[:12]}"
                    )
                if (
                    previous_fingerprint is not None
                    and previous_fingerprint.get("signature")
                    == source_fingerprint.get("signature")
                ):
                    source_summary = InventorySummary(
                        directories=int(source_fingerprint.get("directories", 0)),
                        files=int(source_fingerprint.get("files", 0)),
                        bytes=int(source_fingerprint.get("bytes", 0)),
                    )
                    dest_summary = InventorySummary()
                    reconcile_summary = ReconcileSummary()
                    final_status = "success"
                    exit_code = 0
                    user_status = "SUCCESS_SKIPPED_NO_CHANGES"
                    logger.success(
                        "No source changes detected since last successful run; skipping sync."
                    )
                    logger.info("Use --force to run sync anyway.")
                    report = build_report(
                        source_summary=source_summary,
                        dest_summary=dest_summary,
                        rsync_summary=rsync_summary,
                        reconcile_summary=reconcile_summary,
                        verify_result=None,
                        timers=timers,
                        user_status=user_status,
                        process_status=final_status.upper(),
                    )
                    write_report(report, settings.report_file)
                    for line in report.splitlines():
                        logger.info(line)
                    return exit_code

                if previous_fingerprint is not None:
                    logger.info(
                        "Source changes detected; fingerprints differ. Proceeding with sync."
                    )

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

        if not reconcile_ok:
            user_status = "ACTION_REQUIRED"
        elif destination_has_extras or not verify_ok:
            user_status = "SUCCESS_WITH_WARNINGS"
        else:
            user_status = "SUCCESS"

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
            if not reconcile_ok:
                logger.error(
                    "RECONCILIATION FAILED "
                    f"(missing_folders={reconcile_summary.source_missing_folders}, "
                    f"missing_files={reconcile_summary.source_missing_files})"
                )
            else:
                logger.error("PROCESS FAILED due verification differences")

        report = build_report(
            source_summary=source_summary,
            dest_summary=dest_summary,
            rsync_summary=rsync_summary,
            reconcile_summary=reconcile_summary,
            verify_result=verify_result,
            timers=timers,
            user_status=user_status,
            process_status=final_status.upper(),
        )
        write_report(report, settings.report_file)
        for line in report.splitlines():
            if line.startswith("Destination Extra Folders:") or line.startswith(
                "Destination Extra Files:"
            ):
                logger.success(line)
            else:
                logger.info(line)

        if final_status == "success" and source_fingerprint is not None:
            _write_source_fingerprint(source_fingerprint_path, source_fingerprint)
            logger.info(
                "Updated source fingerprint cache: "
                f"{source_fingerprint_path} "
                f"({str(source_fingerprint.get('signature', ''))[:12]})"
            )

    except Exception as exc:
        logger.error(f"sync2NAS failed: {exc}")
        final_status = "failed"
        exit_code = 1
        user_status = "ACTION_REQUIRED"
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
        state["user_status"] = user_status
        state["process_status"] = final_status.upper()
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
        if user_status.startswith("SUCCESS"):
            logger.success(f"User Status: {user_status}")
        else:
            logger.error(f"User Status: {user_status}")
        logger.info(f"Process Status: {final_status.upper()} (exit_code={exit_code})")
        logger.info(f"Status: {user_status}")

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