"""
Missing Profile Photos Job
===========================
Checks for users with no profile pictures or with missing/invalid phone
numbers whose accounts were activated more than 30 days ago.

- Day 30+:  Sends warning email — "update the missing profile data (photo
            and/or phone) within 7 days or your account will be suspended."
- Day 37+:  If still non-compliant, suspends the account and sends email —
            "your account has been suspended due to unresolved profile data
            issues."

Runs daily. Tracks state via user document fields:
  missingPhotoWarningSentAt  — datetime of first warning
  missingPhotoSuspendedAt    — datetime of suspension
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional

from .base import JobTemplate, JobExecutionContext, JobResult
from services.notification_service import NotificationService
from services.contribution_reminders import extract_phone
from services.phone_utils import normalize_phone_for_sms
from config import Settings

logger = logging.getLogger(__name__)


def _has_profile_photos(user: Dict[str, Any]) -> bool:
    """Return True if the user appears to have at least one profile image."""
    images = user.get("images") or []
    public_images = user.get("publicImages") or []

    def _entry_has_content(entry: Any) -> bool:
        if isinstance(entry, str):
            return bool(entry.strip())
        if isinstance(entry, dict):
            return any(bool(str(value).strip()) for value in entry.values())
        return bool(entry)

    if isinstance(images, list) and any(_entry_has_content(item) for item in images):
        return True
    if isinstance(public_images, list) and any(_entry_has_content(item) for item in public_images):
        return True

    # Some legacy profiles may store a single string instead of list
    if isinstance(images, str) and images.strip():
        return True
    if isinstance(public_images, str) and public_images.strip():
        return True

    return False


def _analyse_phone_issue(user: Dict[str, Any]) -> Dict[str, Any]:
    """Inspect a user's phone information and return validation details."""
    raw_phone = extract_phone(user)
    normalized_phone = normalize_phone_for_sms(raw_phone) if raw_phone else ""

    if not raw_phone:
        issue_reason = "missing"
    elif not normalized_phone:
        issue_reason = "invalid"
    else:
        issue_reason = None

    if issue_reason == "missing":
        issue_description = "Add a primary phone number so members can reach you."
    elif issue_reason == "invalid":
        issue_description = "Update your phone number to a valid 10-digit US number."
    else:
        issue_description = ""

    return {
        "raw_phone": raw_phone,
        "normalized_phone": normalized_phone,
        "issue_reason": issue_reason,
        "issue_description": issue_description,
        "has_issue": issue_reason is not None,
    }


def _summarize_compliance(photo_missing: bool, phone_issue: bool) -> Dict[str, str]:
    labels = []
    if photo_missing:
        labels.append("profile photo")
    if phone_issue:
        labels.append("valid phone number")

    if not labels:
        summary = ""
    elif len(labels) == 1:
        summary = labels[0]
    else:
        summary = " and ".join([", ".join(labels[:-1]), labels[-1]]) if len(labels) > 2 else " and ".join(labels)

    if labels:
        bullets = []
        if photo_missing:
            bullets.append("<li>Upload at least one profile photo</li>")
        if phone_issue:
            bullets.append("<li>Provide a valid 10-digit US phone number</li>")
        issues_html = "".join(bullets)
    else:
        issues_html = ""

    return {
        "labels": labels,
        "summary": summary,
        "issues_html": issues_html,
    }


class MissingProfilePhotosJob(JobTemplate):
    """Job for warning and suspending users with no profile pictures"""

    template_type = "missing_profile_photos"
    template_name = "Missing Profile Data [Profile Pics]"
    template_description = (
        "Warn users missing required profile photos or a valid phone after 30 days, "
        "then suspend after 7 more days if still unresolved"
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

        def _as_trimmed_string(value_ref: Any) -> Dict[str, Any]:
            return {
                "$trim": {
                    "input": {
                        "$convert": {
                            "input": value_ref,
                            "to": "string",
                            "onNull": "",
                            "onError": "",
                        }
                    }
                }
            }

        def _field_to_array_expr(field_name: str) -> Dict[str, Any]:
            """Mongo expression that returns the field as an array of non-empty raw values."""
            field_ref = f"${field_name}"
            return {
                "$cond": [
                    {"$isArray": field_ref},
                    field_ref,
                    {
                        "$cond": [
                            {
                                "$and": [
                                    {"$ne": [field_ref, None]},
                                    {
                                        "$gt": [
                                            {"$strLenCP": _as_trimmed_string(field_ref)},
                                            0,
                                        ]
                                    },
                                ]
                            },
                            [field_ref],
                            [],
                        ]
                    },
                ]
            }

        image_entries_expr = {
            "$concatArrays": [
                _field_to_array_expr("images"),
                _field_to_array_expr("publicImages"),
                _field_to_array_expr("profilePhotos"),
            ]
        }

        meaningful_image_count_expr = {
            "$size": {
                "$filter": {
                    "input": image_entries_expr,
                    "as": "img",
                    "cond": {
                        "$gt": [{"$strLenCP": _as_trimmed_string("$$img")}, 0]
                    },
                }
            }
        }

        no_photo_filter = {
            "$expr": {"$eq": [0, meaningful_image_count_expr]}
        }

        phone_entries_expr = {
            "$concatArrays": [
                _field_to_array_expr("phone"),
                _field_to_array_expr("phones"),
                _field_to_array_expr("phoneNumbers"),
                _field_to_array_expr("contactPhone"),
                _field_to_array_expr("contactPhones"),
                _field_to_array_expr("contactNumber"),
                _field_to_array_expr("contactNumbers"),
                _field_to_array_expr("primaryPhone"),
            ]
        }

        valid_phone_count_expr = {
            "$size": {
                "$filter": {
                    "input": phone_entries_expr,
                    "as": "value",
                    "cond": {
                        "$regexMatch": {
                            "input": {"$toString": "$$value"},
                            "regex": "\\\\d{7,}",
                        }
                    },
                }
            }
        }

        phone_missing_filter = {
            "$expr": {"$eq": [0, valid_phone_count_expr]}
        }

        warning_not_sent_filter = {
            "$or": [
                {"missingPhotoWarningSentAt": {"$exists": False}},
                {"missingPhotoWarningSentAt": None},
            ]
        }

        warning_deadline = now - timedelta(days=grace_days)

        def _build_date_lte_filter(field_name: str, cutoff: datetime, include_missing: bool = False) -> Dict[str, Any]:
            iso_value = cutoff.isoformat()
            clauses = [
                {
                    "$and": [
                        {field_name: {"$type": "date"}},
                        {field_name: {"$lte": cutoff}},
                    ]
                },
                {
                    "$and": [
                        {field_name: {"$type": "timestamp"}},
                        {field_name: {"$lte": cutoff}},
                    ]
                },
                {
                    "$and": [
                        {field_name: {"$type": "string"}},
                        {field_name: {"$lte": iso_value}},
                    ]
                },
            ]

            if include_missing:
                clauses.extend([
                    {field_name: {"$exists": False}},
                    {field_name: None},
                ])

            return {"$or": clauses}

        created_at_warning_filter = _build_date_lte_filter("createdAt", warning_cutoff, include_missing=True)
        created_at_suspension_filter = _build_date_lte_filter("createdAt", suspension_cutoff, include_missing=True)
        warning_sent_before_deadline_filter = _build_date_lte_filter("missingPhotoWarningSentAt", warning_deadline)

        warning_candidates_checked = 0
        suspend_candidates_checked = 0
        photo_issue_warnings = 0
        phone_issue_warnings = 0
        photo_issue_suspensions = 0
        phone_issue_suspensions = 0
        active_non_compliant_total = 0
        active_non_compliant_photo_only = 0
        active_non_compliant_phone_only = 0
        active_non_compliant_both = 0

        def analyse_user_compliance(user_doc: Dict[str, Any]):
            photo_missing = not _has_profile_photos(user_doc)
            phone_details = _analyse_phone_issue(user_doc)
            phone_issue = phone_details["has_issue"]
            summary = _summarize_compliance(photo_missing, phone_issue)
            return photo_missing, phone_issue, phone_details, summary

        try:
            # ── Phase 0: Log all active users currently out of compliance ──
            context.log("info", "Collecting active profiles missing photos or a valid phone number…")

            non_compliant_entries: list[str] = []
            non_compliant_cursor = db.users.find({
                "$and": [
                    {"accountStatus": "active"},
                    {
                        "$or": [
                            no_photo_filter,
                            phone_missing_filter,
                            {"phoneVerified": {"$ne": True}},
                        ]
                    },
                ]
            }).sort("createdAt", 1)

            async for user in non_compliant_cursor:
                username = user.get("username")
                if not username:
                    continue

                photo_missing, phone_issue, phone_details, _summary = analyse_user_compliance(user)
                if not (photo_missing or phone_issue):
                    continue

                active_non_compliant_total += 1
                if photo_missing and phone_issue:
                    active_non_compliant_both += 1
                elif photo_missing:
                    active_non_compliant_photo_only += 1
                elif phone_issue:
                    active_non_compliant_phone_only += 1

                issue_parts: list[str] = []
                if photo_missing:
                    issue_parts.append("missing photo")
                if phone_issue:
                    phone_reason = phone_details["issue_reason"] or "issue"
                    issue_parts.append(f"phone {phone_reason}")
                entry = f"{username} ({', '.join(issue_parts)})"
                non_compliant_entries.append(entry)

            if non_compliant_entries:
                context.log(
                    "info",
                    f"Active profiles with unresolved data issues: {active_non_compliant_total}"
                    f" (photo only: {active_non_compliant_photo_only},"
                    f" phone only: {active_non_compliant_phone_only},"
                    f" both: {active_non_compliant_both})",
                )

                # Emit logs in small batches to avoid oversized log lines
                batch_size = 10
                for i in range(0, len(non_compliant_entries), batch_size):
                    batch = non_compliant_entries[i:i + batch_size]
                    context.log("info", " • " + "; ".join(batch))
            else:
                context.log(
                    "info",
                    "No active profiles currently missing photos or a valid phone number.",
                )

            # ── Phase 1: Send warnings (account ≥ warning_days old, no prior warning) ──
            warn_query = {
                "$and": [
                    {"accountStatus": "active"},
                    created_at_warning_filter,
                    warning_not_sent_filter,
                    {
                        "$or": [
                            no_photo_filter,
                            phone_missing_filter,
                            {"phoneVerified": {"$ne": True}},
                        ]
                    },
                ]
            }
            warn_cursor = db.users.find(warn_query).sort("createdAt", 1).limit(batch_size * 10)

            async for user in warn_cursor:
                warning_candidates_checked += 1

                username = user.get("username")
                if not username:
                    continue

                photo_missing, phone_issue, phone_details, summary = analyse_user_compliance(user)

                if not (photo_missing or phone_issue):
                    continue

                try:
                    first_name = user.get("firstName", username)

                    warn_time = datetime.utcnow()

                    template_data = {
                        "recipient": {
                            "firstName": first_name,
                            "username": username,
                        },
                        "recipient_firstName": first_name,
                        "graceDays": grace_days,
                        "profile_url": profile_edit_url,
                        "photo_issue": photo_missing,
                        "phone_issue": phone_issue,
                        "phone_issue_reason": phone_details["issue_reason"],
                        "phone_issue_description": phone_details["issue_description"],
                        "compliance_issue_summary": summary["summary"],
                        "compliance_issue_list_html": summary["issues_html"],
                    }

                    if not dry_run:
                        await notification_service.queue_notification(
                            username=username,
                            trigger="missing_photo_warning",
                            channels=["email"],
                            template_data=template_data,
                            priority="medium",
                        )

                        await db.users.update_one(
                            {"username": username},
                            {
                                "$set": {
                                    "missingPhotoWarningSentAt": warn_time,
                                    "updated_at": warn_time,
                                    "profileComplianceIssues": {
                                        "photoMissing": photo_missing,
                                        "phoneIssue": phone_issue,
                                        "phoneIssueReason": phone_details["issue_reason"],
                                        "summary": summary["summary"],
                                        "issuesHtml": summary["issues_html"],
                                        "capturedAt": warn_time,
                                    },
                                }
                            },
                        )

                    warnings_sent += 1
                    if photo_missing:
                        photo_issue_warnings += 1
                    if phone_issue:
                        phone_issue_warnings += 1

                    issue_parts = []
                    if photo_missing:
                        issue_parts.append("missing profile photo")
                    if phone_issue:
                        issue_parts.append(f"phone issue ({phone_details['issue_reason']})")
                    issue_description = " and ".join(issue_parts)

                    context.log(
                        "info",
                        f"{'[DRY RUN] ' if dry_run else ''}"
                        f"Sent compliance warning to {username} for {issue_description}",
                    )

                    if warnings_sent >= batch_size:
                        break

                except Exception as e:
                    err_msg = f"Failed to warn {user.get('username')}: {e}"
                    errors.append(err_msg)
                    context.log("error", err_msg)

            total_warn = await db.users.count_documents({
                "$and": [
                    {"accountStatus": "active"},
                    created_at_warning_filter,
                    warning_not_sent_filter,
                    {
                        "$or": [
                            no_photo_filter,
                            phone_missing_filter,
                            {"phoneVerified": {"$ne": True}},
                        ]
                    },
                ]
            })
            backlog_warn = max(0, total_warn - warnings_sent)
            if backlog_warn:
                context.log("info", f"Warning backlog estimate: {backlog_warn} user(s) waiting (rerun job to continue)")

            # ── Phase 2: Suspend (warning sent ≥ grace_days ago, still no photos) ──
            suspend_query = {
                "$and": [
                    {"accountStatus": "active"},
                    created_at_suspension_filter,
                    warning_sent_before_deadline_filter,
                    {
                        "$or": [
                            no_photo_filter,
                            phone_missing_filter,
                            {"phoneVerified": {"$ne": True}},
                        ]
                    },
                    {
                        "$or": [
                            {"missingPhotoSuspendedAt": {"$exists": False}},
                            {"missingPhotoSuspendedAt": None},
                        ]
                    },
                ]
            }
            suspend_cursor = db.users.find(suspend_query).sort("missingPhotoWarningSentAt", 1).limit(batch_size * 10)

            async for user in suspend_cursor:
                suspend_candidates_checked += 1

                username = user.get("username")
                if not username:
                    continue

                photo_missing, phone_issue, phone_details, summary = analyse_user_compliance(user)

                if not (photo_missing or phone_issue):
                    if not dry_run:
                        await db.users.update_one(
                            {"username": username},
                            {
                                "$set": {
                                    "missingPhotoWarningSentAt": None,
                                    "updated_at": datetime.utcnow(),
                                },
                                "$unset": {
                                    "profileComplianceIssues": "",
                                    "missingPhotoSuspendedAt": "",
                                },
                            },
                        )
                    context.log("info", f"Skipping suspension for {username} — compliance restored")
                    continue

                try:
                    first_name = user.get("firstName", username)

                    suspension_time = datetime.utcnow()

                    reason = "profile_data_non_compliant"
                    if photo_missing and not phone_issue:
                        reason = "no_photo_limit_reached"
                    elif phone_issue and not photo_missing:
                        reason = "invalid_phone_number"

                    template_data = {
                        "recipient": {
                            "firstName": first_name,
                            "username": username,
                        },
                        "recipient_firstName": first_name,
                        "profile_url": profile_edit_url,
                        "photo_issue": photo_missing,
                        "phone_issue": phone_issue,
                        "phone_issue_reason": phone_details["issue_reason"],
                        "phone_issue_description": phone_details["issue_description"],
                        "compliance_issue_summary": summary["summary"],
                        "compliance_issue_list_html": summary["issues_html"],
                    }

                    if not dry_run:
                        # Suspend the account
                        status_field = user.get("status")
                        status_update: Dict[str, Any] = {
                            "accountStatus": "suspended",
                            "deactivationReason": reason,
                            "missingPhotoSuspendedAt": suspension_time,
                            "updated_at": suspension_time,
                            "profileComplianceIssues": {
                                "photoMissing": photo_missing,
                                "phoneIssue": phone_issue,
                                "phoneIssueReason": phone_details["issue_reason"],
                                "summary": summary["summary"],
                                "issuesHtml": summary["issues_html"],
                                "suspendedAt": suspension_time,
                            },
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
                            template_data=template_data,
                            priority="high",
                        )

                    suspensions += 1
                    if photo_missing:
                        photo_issue_suspensions += 1
                    if phone_issue:
                        phone_issue_suspensions += 1

                    issue_parts = []
                    if photo_missing:
                        issue_parts.append("missing profile photo")
                    if phone_issue:
                        issue_parts.append(f"phone issue ({phone_details['issue_reason']})")
                    issue_description = " and ".join(issue_parts)

                    context.log(
                        "info",
                        f"{'[DRY RUN] ' if dry_run else ''}"
                        f"Suspended {username} — unresolved {issue_description}",
                    )

                    if suspensions >= batch_size:
                        break

                except Exception as e:
                    err_msg = f"Failed to suspend {user.get('username')}: {e}"
                    errors.append(err_msg)
                    context.log("error", err_msg)

            total_suspend = await db.users.count_documents({
                "$and": [
                    {"accountStatus": "active"},
                    created_at_suspension_filter,
                    warning_sent_before_deadline_filter,
                    {
                        "$or": [
                            {"missingPhotoSuspendedAt": {"$exists": False}},
                            {"missingPhotoSuspendedAt": None},
                        ]
                    },
                    {
                        "$or": [
                            no_photo_filter,
                            phone_missing_filter,
                            {"phoneVerified": {"$ne": True}},
                        ]
                    },
                ]
            })
            backlog_suspend = max(0, total_suspend - suspensions)
            if backlog_suspend:
                context.log("info", f"Suspension backlog estimate: {backlog_suspend} user(s) waiting (rerun job to continue)")

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
                    "photo_issue_warnings": photo_issue_warnings,
                    "phone_issue_warnings": phone_issue_warnings,
                    "photo_issue_suspensions": photo_issue_suspensions,
                    "phone_issue_suspensions": phone_issue_suspensions,
                    "active_non_compliant_total": active_non_compliant_total,
                    "active_non_compliant_photo_only": active_non_compliant_photo_only,
                    "active_non_compliant_phone_only": active_non_compliant_phone_only,
                    "active_non_compliant_both": active_non_compliant_both,
                },
                records_processed=warning_candidates_checked + suspend_candidates_checked,
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
