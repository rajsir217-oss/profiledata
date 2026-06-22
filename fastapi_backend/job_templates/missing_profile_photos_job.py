"""
Missing Profile Photos Job
===========================
Checks for users with no profile pictures whose accounts were activated
more than 30 days ago.

- Day 30+:  Sends warning email #1 — "upload at least one picture or your
            account will be suspended within 7 days."
- Day 37+:  If still no photos, suspends the account and sends email #2 —
            "your account has been suspended due to missing profile photos."

Runs daily. Tracks state via user document fields:
  missingPhotoWarningSentAt  — datetime of first warning
  missingPhotoSuspendedAt    — datetime of suspension
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from config import Settings

logger = logging.getLogger(__name__)


class MissingProfilePhotosJob(JobTemplate):
    """Job for warning and suspending users with no profile pictures"""

    template_type = "missing_profile_photos"
    template_name = "Missing Profile Data [Profile Pics]"
    template_description = (
        "Warn users with no profile pictures after 30 days, "
        "then suspend after 7 more days if still missing"
    )
    category = "engagement"
    icon = "📸"
    estimated_duration = "2-5 minutes"
    resource_usage = "low"
    risk_level = "medium"

    # ── configurable defaults ──────────────────────────────────────────
    DEFAULT_WARNING_DAYS = 30   # days after createdAt before first warning
    DEFAULT_GRACE_DAYS = 7      # days after warning before suspension

    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        warning_days = params.get("warningDays", self.DEFAULT_WARNING_DAYS)
        grace_days = params.get("graceDays", self.DEFAULT_GRACE_DAYS)
        batch_size = params.get("batchSize", 100)

        if not isinstance(warning_days, int) or warning_days < 1:
            return False, "warningDays must be a positive integer"
        if not isinstance(grace_days, int) or grace_days < 1:
            return False, "graceDays must be a positive integer"
        if not isinstance(batch_size, int) or batch_size < 1 or batch_size > 500:
            return False, "batchSize must be between 1 and 500"

        return True, None

    def get_default_params(self) -> Dict[str, Any]:
        return {
            "warningDays": self.DEFAULT_WARNING_DAYS,
            "graceDays": self.DEFAULT_GRACE_DAYS,
            "batchSize": 100,
            "dryRun": False,
        }

    def get_schema(self) -> Dict[str, Any]:
        return {
            "warningDays": {
                "type": "integer",
                "label": "Warning After (Days)",
                "description": "Days after account creation before sending first warning",
                "default": self.DEFAULT_WARNING_DAYS,
                "min": 1,
                "max": 365,
            },
            "graceDays": {
                "type": "integer",
                "label": "Grace Period (Days)",
                "description": "Days after warning before account is suspended",
                "default": self.DEFAULT_GRACE_DAYS,
                "min": 1,
                "max": 90,
            },
            "batchSize": {
                "type": "integer",
                "label": "Batch Size",
                "description": "Number of users to process per run",
                "default": 100,
                "min": 1,
                "max": 500,
            },
            "dryRun": {
                "type": "boolean",
                "label": "Dry Run",
                "description": "Log actions without sending emails or suspending",
                "default": False,
            },
        }

    # ── main entry point ───────────────────────────────────────────────

    async def execute(self, context: JobExecutionContext) -> JobResult:
        start_time = datetime.utcnow()
        params = context.parameters
        db = context.db

        warning_days = params.get("warningDays", self.DEFAULT_WARNING_DAYS)
        grace_days = params.get("graceDays", self.DEFAULT_GRACE_DAYS)
        batch_size = params.get("batchSize", 100)
        dry_run = params.get("dryRun", False)

        now = datetime.utcnow()
        warning_cutoff = now - timedelta(days=warning_days)
        suspension_cutoff = now - timedelta(days=warning_days + grace_days)

        context.log(
            "info",
            f"Scanning for users with no profile pictures "
            f"(warning={warning_days}d, grace={grace_days}d, batch={batch_size}, dry_run={dry_run})",
        )

        warnings_sent = 0
        suspensions = 0
        errors = []

        settings = Settings()
        frontend_base = (settings.frontend_url or "").rstrip("/")
        if not frontend_base:
            frontend_base = "https://l3v3lmatches.com"
        profile_edit_url = f"{frontend_base}/profile/edit"

        notification_service = NotificationService(db) if not dry_run else None

        updated_by = context.job_name or context.triggered_by or "missing_profile_photos_job"

        no_photo_filter = {
            "$or": [
                {"images": {"$exists": False}},
                {"images": None},
                {"images": {"$size": 0}},
            ]
        }

        warning_not_sent_filter = {
            "$or": [
                {"missingPhotoWarningSentAt": {"$exists": False}},
                {"missingPhotoWarningSentAt": None},
            ]
        }

        warning_deadline = now - timedelta(days=grace_days)

        try:
            # ── Phase 1: Send warnings (account ≥ warning_days old, no prior warning) ──
            warn_query = {
                "$and": [
                    {"accountStatus": "active"},
                    no_photo_filter,
                    {"createdAt": {"$lte": warning_cutoff}},
                    warning_not_sent_filter,
                ]
            }
            warn_candidates = await db.users.find(warn_query).limit(batch_size).to_list(batch_size)

            context.log("info", f"Phase 1 — {len(warn_candidates)} users to warn")

            if len(warn_candidates) == batch_size:
                total_warn = await db.users.count_documents(warn_query)
                remainder = max(0, total_warn - len(warn_candidates))
                if remainder:
                    context.log("info", f"Warning backlog: {remainder} additional user(s) waiting (rerun job to process the remainder)")

            for user in warn_candidates:
                try:
                    username = user["username"]
                    first_name = user.get("firstName", username)

                    warn_time = datetime.utcnow()

                    if not dry_run:
                        await notification_service.queue_notification(
                            username=username,
                            trigger="missing_photo_warning",
                            channels=["email"],
                            template_data={
                                "recipient": {
                                    "firstName": first_name,
                                    "username": username,
                                },
                                "recipient_firstName": first_name,
                                "graceDays": grace_days,
                                "profile_url": profile_edit_url,
                            },
                            priority="medium",
                        )

                        await db.users.update_one(
                            {"username": username},
                            {"$set": {"missingPhotoWarningSentAt": warn_time, "updated_at": warn_time}},
                        )

                    warnings_sent += 1
                    context.log(
                        "info",
                        f"{'[DRY RUN] ' if dry_run else ''}"
                        f"Sent missing-photo warning to {username}",
                    )

                except Exception as e:
                    err_msg = f"Failed to warn {user.get('username')}: {e}"
                    errors.append(err_msg)
                    context.log("error", err_msg)

            # ── Phase 2: Suspend (warning sent ≥ grace_days ago, still no photos) ──
            suspend_query = {
                "$and": [
                    {"accountStatus": "active"},
                    no_photo_filter,
                    {"createdAt": {"$lte": suspension_cutoff}},
                    {"missingPhotoWarningSentAt": {"$lte": warning_deadline}},
                    {
                        "$or": [
                            {"missingPhotoSuspendedAt": {"$exists": False}},
                            {"missingPhotoSuspendedAt": None},
                        ]
                    },
                ]
            }
            suspend_candidates = await db.users.find(suspend_query).limit(batch_size).to_list(batch_size)

            context.log("info", f"Phase 2 — {len(suspend_candidates)} users to suspend")

            if len(suspend_candidates) == batch_size:
                total_suspend = await db.users.count_documents(suspend_query)
                remainder = max(0, total_suspend - len(suspend_candidates))
                if remainder:
                    context.log("info", f"Suspension backlog: {remainder} additional user(s) waiting (rerun job to process the remainder)")

            for user in suspend_candidates:
                try:
                    username = user["username"]
                    first_name = user.get("firstName", username)

                    suspension_time = datetime.utcnow()

                    if not dry_run:
                        # Suspend the account
                        status_field = user.get("status")
                        status_update: Dict[str, Any] = {
                            "accountStatus": "suspended",
                            "deactivationReason": "no_photo_limit_reached",
                            "missingPhotoSuspendedAt": suspension_time,
                            "updated_at": suspension_time,
                        }

                        if isinstance(status_field, dict):
                            status_update.update({
                                "status.status": "suspended",
                                "status.updated_at": suspension_time,
                                "status.updated_by": updated_by,
                            })
                        else:
                            status_update["status"] = {
                                "status": "suspended",
                                "updated_at": suspension_time,
                                "updated_by": updated_by,
                            }

                        await db.users.update_one(
                            {"username": username},
                            {"$set": status_update},
                        )

                        # Send suspension email
                        await notification_service.queue_notification(
                            username=username,
                            trigger="missing_photo_suspended",
                            channels=["email"],
                            template_data={
                                "recipient": {
                                    "firstName": first_name,
                                    "username": username,
                                },
                                "recipient_firstName": first_name,
                                "profile_url": profile_edit_url,
                            },
                            priority="high",
                        )

                    suspensions += 1
                    context.log(
                        "info",
                        f"{'[DRY RUN] ' if dry_run else ''}"
                        f"Suspended {username} — no profile photos after grace period",
                    )

                except Exception as e:
                    err_msg = f"Failed to suspend {user.get('username')}: {e}"
                    errors.append(err_msg)
                    context.log("error", err_msg)

            # ── result ─────────────────────────────────────────────────
            duration = (datetime.utcnow() - start_time).total_seconds()
            total = warnings_sent + suspensions

            return JobResult(
                status="success" if not errors else "partial",
                message=(
                    f"Warned {warnings_sent} user(s), suspended {suspensions} user(s)"
                    + (" [DRY RUN]" if dry_run else "")
                ),
                details={
                    "warnings_sent": warnings_sent,
                    "suspensions": suspensions,
                    "total_affected": total,
                    "dry_run": dry_run,
                    "warning_days": warning_days,
                    "grace_days": grace_days,
                },
                records_processed=len(warn_candidates) + len(suspend_candidates),
                records_affected=total,
                errors=errors[:10],
                duration_seconds=duration,
            )

        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            context.log("error", f"Job failed: {e}")
            return JobResult(
                status="failed",
                message=f"Missing profile photos job failed: {e}",
                errors=[str(e)],
                duration_seconds=duration,
            )


# Export
__all__ = ["MissingProfilePhotosJob"]
