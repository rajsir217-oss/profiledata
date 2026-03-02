# Notification Queue Architecture (Current Implementation)

**Version:** 1.0  
**Date:** March 1, 2026  
**Status:** Implemented (as currently deployed in code)

---

## 1. Purpose

This document describes the **end-to-end notification queue architecture** currently implemented in the backend, including:

- Event trigger and dispatch
- Preference-based channel filtering
- Queue insertion, scheduling, and retry behavior
- Channel-specific job processing (email / SMS / push)
- Legacy compatibility logic
- Recently implemented production fixes

---

## 2. Core Components

### 2.1 Event Dispatcher

`EventDispatcher` is the primary event fan-out layer. It:

1. receives domain events,
2. optionally publishes to Redis,
3. logs activity,
4. executes registered handlers that queue notifications.

Ref: @fastapi_backend/services/event_dispatcher.py#152-264

### 2.2 Notification Service

`NotificationService` is the central queue engine:

- preferences read/create/update
- queue writes (`enqueue_notification`, `queue_notification`)
- atomic pending retrieval (`get_pending_notifications`)
- lifecycle updates (`mark_as_sent`, retries)
- template rendering helpers

Refs:  
@fastapi_backend/services/notification_service.py#44-155  
@fastapi_backend/services/notification_service.py#160-328  
@fastapi_backend/services/notification_service.py#359-439  
@fastapi_backend/services/notification_service.py#444-587  
@fastapi_backend/services/notification_service.py#891-971

### 2.3 Queue Manager

`QueueManager` provides operational controls used during enqueue and jobs:

- queue status (normal/paused/emergency/maintenance)
- pause/resume behavior
- rate-limiting checks

Refs:  
@fastapi_backend/services/queue_manager.py#17-47  
@fastapi_backend/services/queue_manager.py#52-162

### 2.4 Channel Worker Jobs

- Email worker: claims and sends email notifications  
  @fastapi_backend/job_templates/email_notifier_template.py#120-249
- SMS worker: claims and sends SMS with cost + quality filters  
  @fastapi_backend/job_templates/sms_notifier_template.py#118-269
- Push worker: claims push notifications, resolves active device subscriptions, and sends push payloads  
  @fastapi_backend/job_templates/push_notifier_template.py#101-157

### 2.5 Queue API (Admin / User visibility)

Queue read endpoint normalizes old/new schema for UI and supports backward-compatible statuses.

Ref: @fastapi_backend/routers/notifications.py#144-208

---

## 3. Data Model (Queue Layer)

Primary queue item model (`NotificationQueueItem`):

- `username`
- `trigger`
- `priority`
- `channels` (list)
- `templateData`
- `status`
- `scheduledFor`
- `attempts`, `lastAttempt`, `error`
- timestamps

Creation model (`NotificationQueueCreate`) is used for inserts.

Ref: @fastapi_backend/models/notification_models.py#307-347

---

## 4. End-to-End Flow

## 4.1 Event trigger -> handler execution

A domain event is dispatched via `EventDispatcher.dispatch(...)`, then mapped handlers execute asynchronously.

Ref: @fastapi_backend/services/event_dispatcher.py#244-253

## 4.2 Handler builds notification request

Each handler calls `notification_service.queue_notification(...)` with:

- target username
- trigger string
- requested channels
- template data payload
- priority

Examples:

- `profile_view` requests `["email", "push"]`  
  @fastapi_backend/services/event_dispatcher.py#636-647
- `new_message` requests `["email", "sms", "push"]` and now supplies `recipient.firstName`, `match.age`, `message.preview`  
  @fastapi_backend/services/event_dispatcher.py#673-693
- `message_read` requests `["email", "push"]`  
  @fastapi_backend/services/event_dispatcher.py#715-725

## 4.3 Preference pre-filtering (critical gate)

`queue_notification(...)` pre-filters requested channels against user preferences **before queue insertion**.

- If no channels remain after filtering: returns `None` (nothing inserted)
- If some remain: inserts one record per allowed channel

Ref: @fastapi_backend/services/notification_service.py#918-960

### Why this matters

This enforces the current design intent:

- channels not opted-in by the user should not enter queue
- channel workers process only what was allowed upstream

## 4.4 Enqueue checks + scheduling

For each per-channel item, `enqueue_notification(...)` enforces:

1. queue operational status is normal (unless `force_send=True`),
2. preference/channel validity (unless `force_send=True`),
3. rate-limit checks,
4. quiet-hours scheduling.

Ref: @fastapi_backend/services/notification_service.py#169-225

Quiet-hours behavior:

- if currently in quiet window, item is delayed to quiet-hours end (`scheduledFor`) and status becomes `scheduled`
- otherwise status is `pending`

Ref: @fastapi_backend/services/notification_service.py#836-885

## 4.5 Worker claim (atomic)

Workers call `get_pending_notifications(channel=...)`, which atomically claims records by moving them to `processing` using `find_one_and_update`.

Claim criteria include:

- status in `[pending, scheduled, queued]`
- `scheduledFor` is null or due
- retry window (`nextRetryAt`) is due
- channel match supports both old and new schemas

Ref: @fastapi_backend/services/notification_service.py#233-328

## 4.6 Send + finalize

Channel workers perform provider-specific send logic, then call `mark_as_sent(...)`:

- success -> `sent`
- failure with attempts left -> back to `pending` with exponential backoff (`nextRetryAt`)
- max attempts reached -> `failed`

Ref: @fastapi_backend/services/notification_service.py#392-425

---

## 5. Default Preference Model (Current)

New default preferences are **EMAIL-only** for most triggers (including message/profile/privacy events), with push/SMS opt-in expected via user settings.

Ref: @fastapi_backend/services/notification_service.py#63-91

Notable included defaults (now present):

- `message_read`
- `conversation_cold`
- `pii_denied`
- `pii_revoked`

Ref: @fastapi_backend/services/notification_service.py#73-87

---

## 6. Legacy Compatibility Strategy

The system currently supports mixed historical queue records:

### 6.1 Status compatibility

`queued` is included as a retrievable status in worker claims.

Ref: @fastapi_backend/services/notification_service.py#243-245

### 6.2 Schema compatibility

Both are accepted:

- old: `channel` (singular), `recipientUsername`
- new: `channels` (list), `username`

Worker claim path transforms legacy docs into modern model shape before parsing.

Ref: @fastapi_backend/services/notification_service.py#262-321

### 6.3 Queue API compatibility

`/api/notifications/queue` also normalizes old/new structures for frontend visibility.

Ref: @fastapi_backend/routers/notifications.py#182-199

---

## 7. Channel Worker Behavior

## 7.1 Email Job

- checks queue status first
- resets stuck `processing`
- atomically claims email items
- resolves recipient from `email` or `contactEmail`
- decrypts encrypted values when needed
- renders templates using NotificationService + app URLs
- marks sent/failed and logs delivery

Refs:  
@fastapi_backend/job_templates/email_notifier_template.py#120-249  
@fastapi_backend/job_templates/email_notifier_template.py#260-389

## 7.2 SMS Job

- enforces daily cost limits
- resets stuck `processing`
- atomically claims SMS items
- resolves recipient from `phone` or `contactNumber`
- decrypts encrypted values when needed
- applies optional filtering (`priorityOnly`, `verifiedUsersOnly`)
- marks sent/failed and logs cost

Ref: @fastapi_backend/job_templates/sms_notifier_template.py#130-289

## 7.3 Push Job

- resets stuck `processing`
- atomically claims push items
- requires active push subscriptions
- if no active subscriptions: marks record `skipped` with reason

Ref: @fastapi_backend/job_templates/push_notifier_template.py#111-157

---

## 8. Template Rendering & Data Contract

`render_template(...)` supports:

- `{var}` and `{{var}}`
- nested placeholders (`{match.firstName}`)
- underscore variants (`{match_firstName}`)
- loop and conditional processing

Ref: @fastapi_backend/services/notification_service.py#444-587

Recent payload + template alignment updates:

- `new_message` handler now supplies required recipient/match/message fields  
  @fastapi_backend/services/event_dispatcher.py#677-692
- email template app short aliases (`app.chatUrl`, `app.unsubscribeUrl`, etc.) are now injected  
  @fastapi_backend/job_templates/email_notifier_template.py#371-378
- monthly digest has contribution footer inserted between Pro Tip and Footer sections  
  @fastapi_backend/job_templates/monthly_digest_notifier.py#571-626

---

## 9. Route-Level Notification Integration Notes

Certain routes now correctly use `queue_notification(...)` rather than direct invalid enqueue signatures. Example: conversation close path uses `trigger="conversation_cold"` through queue service.

Ref: @fastapi_backend/routes.py#8516-8535

This preserves preference pre-filtering and avoids broken direct enqueue calls.

---

## 10. Operational Semantics

- **Pause/maintenance control:** Enqueue and workers respect queue status  
  @fastapi_backend/services/notification_service.py#169-180  
  @fastapi_backend/job_templates/email_notifier_template.py#120-130
- **Stuck recovery:** each worker resets stale `processing` records before claim  
  @fastapi_backend/services/notification_service.py#330-357
- **Retry model:** exponential backoff and max-attempt fail-out  
  @fastapi_backend/services/notification_service.py#401-423
- **Quiet hours:** can delay sends into future schedule windows  
  @fastapi_backend/services/notification_service.py#857-884

---

## 11. High-Level Sequence (Text Diagram)

1. User/system action produces domain event.  
2. `EventDispatcher.dispatch` executes mapped notification handler(s).  
3. Handler calls `queue_notification` with trigger + candidate channels + template data.  
4. `queue_notification` filters channels by user prefs.  
5. For each allowed channel, `enqueue_notification` applies queue status, rate limit, quiet hours, then inserts queue row.  
6. Channel worker (email/SMS/push) atomically claims due rows for its channel.  
7. Worker sends through provider and updates status via `mark_as_sent` (+ logs).  
8. Failed sends retry with backoff until max attempts; then marked failed.

---

## 12. Recent Fixes Captured in Current Architecture

1. **Preference-first channel pre-filter** in `queue_notification` so non-opted channels do not enter queue.  
2. **Default preferences shifted to EMAIL-first** (push/SMS no longer default for most triggers).  
3. **`get_pending_notifications` query fixed** (removed faulty empty `$or` behavior) and now includes legacy `queued` status.  
4. **Legacy schema handling strengthened** in both worker claim and queue API paths.  
5. **Route-level direct enqueue cleanup** for problematic/broken push enqueue paths.  
6. **Template data alignment for new_message** (`recipient.firstName`, `match.age`, `message.preview`).  
7. **Email app URL alias injection** for DB templates (`chatUrl`, `unsubscribeUrl`, etc.).  
8. **Monthly digest contribution section insertion** in digest-specific HTML.

---

## 13. Deployment / Data Notes

- No mandatory schema migration is required for baseline operation because the runtime supports old+new queue schemas and old+new status values.
- Existing historical queue records may still reflect old behavior and can be cleaned operationally if needed, but code is backward-compatible at runtime.

---

## 14. Scope Boundaries

This document describes **current implemented behavior** only. It does not propose future redesigns or additional features beyond the present code paths.
