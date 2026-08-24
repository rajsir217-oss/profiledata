---
description: Perform a deep review of the monthly digest email system.
---

# Skill: Review Monthly Digest Email System

## When to use

When asked for a future deep review of the monthly digest email system.

## Scope

1. **Template rendering**
   - Locate and read `monthly_digest_notifier` template/job code.
   - Verify HTML/template variables and personalization logic.
   - Confirm butterfly emoji logo usage and brand consistency.

2. **Scheduler triggering and claiming**
   - `JobRegistryService.claim_job_for_execution` must atomically claim the job.
   - `UnifiedScheduler.check_dynamic_jobs` must claim before `execute()`.
   - Confirm this prevents duplicate sends across multiple Cloud Run instances.

3. **Notification queue dedupe**
   - `monthly_digest_notifier` must dedupe by username/email before queueing notifications.
   - Verify no user receives the same monthly digest twice in one run.

4. **End-to-end send logging / observability**
   - Trace queue insertion in `notification_queue`.
   - Confirm notifier job updates `notification_log` with send/fail status.
   - Check `attempts`, `status`, `updatedAt`, and any error payloads.
   - Verify admin visibility via Event Queue Manager and any digest-specific logs.

## Files to inspect

- `fastapi_backend/job_templates/monthly_digest_notifier.py` (or equivalent)
- `fastapi_backend/services/notification_service.py`
- `fastapi_backend/services/job_registry_service.py`
- `fastapi_backend/services/unified_scheduler.py`
- `fastapi_backend/routers/notifications.py`
- Frontend Event Queue Manager component

## Output

Produce a markdown report (e.g., `docs/MONTHLY_DIGEST_REVIEW.md`) with findings, risks, and recommendations.
