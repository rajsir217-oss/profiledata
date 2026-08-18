# Backend Rules

> Behavioral guardrails for Python / FastAPI / MongoDB work in `fastapi_backend/`.
> See also `AGENTS.md` for the high-level conventions.

---

## 1. FastAPI dependency injection

### 1.1 Database access

Every route handler that touches MongoDB must accept `db` via FastAPI dependency injection:

```python
from dependencies import get_database

@router.get("/items")
async def list_items(db=Depends(get_database)):
    ...
```

- Do **not** call `get_database()` inside a handler body. This breaks test mocking.
- Every handler that needs the database should declare `db=Depends(get_database)` in its signature.

### 1.2 DELETE endpoints with query parameters

`DELETE` endpoints that receive query parameters must declare them explicitly with `Query(...)`:

```python
from fastapi import Query

@router.delete("/favorites/{target_username}")
async def remove_from_favorites(
    target_username: str,
    username: str = Query(...),
    db=Depends(get_database),
):
```

Without `Query(...)`, FastAPI does not know the parameter comes from the query string on `DELETE` requests, causing network errors.

---

## 2. Data validation and MongoDB edge cases

### 2.1 Empty strings before numeric conversion

MongoDB may return `''` for missing numeric fields. Always validate before `int()`:

```python
# WRONG - can fail with empty strings
value = int(data.get("field", 0))

# CORRECT
raw = data.get("field", 0)
value = int(raw) if raw not in ("", None) else 0
```

This pattern was applied to `l3v3l_matching_engine.py` for age ranges, stress levels, height parsing, and comparisons. Use it everywhere numeric data may come from MongoDB.

### 2.2 User schema fields

- The `status` object on the user document tracks `last_seen` and a legacy `status` string. Do **not** use it for account status or online status.
- The unified account-status field is `accountStatus`:
  ```python
  account_status = user.get('accountStatus', 'pending_email_verification')
  ```
- Valid `accountStatus` values:
  - `pending_email_verification`
  - `pending_admin_approval`
  - `active`
  - `suspended`
  - `banned` (mapped to `suspended` in practice)
  - `paused`
  - `deactivated`
- Admin status changes in `auth/admin_routes.py` must read from and write to `accountStatus`, not `status.status`.
- Online presence is tracked in Redis, not the database. Use `redis.set_user_online()` / `redis.is_user_online()`.

### 2.3 PII and contact fields

Encrypted PII may be stored under different keys. Read with fallback:

```python
email = user.get("email") or user.get("contactEmail")
phone = user.get("phone") or user.get("contactNumber")
```

Decrypt PII with `crypto_utils.PIIEncryption` before using it.

---

## 3. Notification system

### 3.1 Pydantic alias bug

Use `notification.id`, not `notification.dict().get("_id")`:

```python
# CORRECT
notif_id = notification.id

# WRONG - dict() returns None for _id because of Pydantic alias behavior
notif_id = notification.dict().get("_id")
```

### 3.2 Combined MongoDB updates

MongoDB updates that both set and increment must be combined in one document:

```python
update_doc = {
    "$set": {"status": "sent", "updatedAt": datetime.utcnow()},
    "$inc": {"attempts": 1},
}
```

### 3.3 Status change emails

When an admin changes user status (`PATCH /api/admin/users/{username}/status`):

- Request includes `status` and optional `reason`.
- Notification types:
  - `status_approved` — pending to active (green success email).
  - `status_suspended` — any to suspended (orange warning email).
  - `status_banned` — any to suspended with "ban" / "permanent" in reason (red error email).
  - `status_paused` — any to paused (blue/indigo info email).
- Notifications are queued to `notification_queue` and processed by the email notifier job.
- Failure does **not** block the status change.

### 3.4 Activity notification preferences

- Activity triggers (`profile_view`, `favorited`, `profile_visibility_spike`, `search_appearance`) must always block email and SMS channels.
- Frontend `UnifiedPreferences` sanitizes channels on load/save/reset and disables those toggles in the UI.
- Backend `NotificationService` enforces the same normalization for all existing and new users via `_ensure_compliance_channels`.
- `create_default_preferences` sets email/SMS defaults to `[]` for activity triggers.
- `_should_send` applies default-enabled fallback only when no explicit preference exists.

One-time migration: `fastapi_backend/migrations/disable_activity_email_sms_channels.py` (idempotent).

### 3.5 Monthly digest dedupe

`monthly_digest_notifier` must dedupe by username/email before queueing notifications. Dynamic scheduler jobs must be atomically claimed in `JobRegistryService.claim_job_for_execution` and `UnifiedScheduler.check_dynamic_jobs` must claim before `execute()` to prevent duplicate sends in multi-instance deployments.

---

## 4. Search and sort

### 4.1 Server-backed sort

- `GET /api/search` is the canonical search endpoint. Sort is server-backed.
- Canonical sort keys: `matchScore`, `height`, `firstName`, `location`, `education`, `profession`.
- Aliases are normalized on the backend:
  - `name` -> `firstName`
  - `heightInches` -> `height`
  - `occupation` -> `profession`
- Do not keep legacy `sortBy` / `sortOrder` in search-criteria payloads. Sort state is managed separately.

### 4.2 Projections

Backend search projections must include `updatedAt` so frontend search cards can render relative "Updated X ago" text.

- `SEARCH_RESULT_PROJECTION` and `DASHBOARD_USER_PROJECTION` in `fastapi_backend/routes.py` must include `updatedAt`.

---

## 5. API design

### 5.1 Route ordering and shadowing

Be careful with dynamic routes like `/api/notifications/{username}` shadowing later routes such as `/api/notifications/simpletexting-stats-public`.

- Use specific static paths before dynamic path parameters where possible.
- When refreshing SimpleTexting stats, call `/api/notifications/simpletexting-stats?force_refresh=true` (the authenticated endpoint), not the public one.

### 5.2 Face detection fallback

On Cloud Run, `services/face_detection.py` may fail to load OpenCV cascade files. `_get_detectors()` should try multiple cascade files (default, alt, alt2), return a graceful fallback when unavailable, and log a warning instead of raising a traceback.

### 5.3 Phone normalization

Use `fastapi_backend/services/phone_utils.py` for all SMS phone normalization:

```python
from services.phone_utils import normalize_phone_for_sms, format_phone_for_twilio
```

US inputs with parentheses, hyphens, spaces, and `+1` must normalize consistently.

### 5.4 SimpleTexting refresh and route shadowing

The notifications router has a dynamic `/api/notifications/{username}` route that can shadow later static routes like `/api/notifications/simpletexting-stats-public`.

- The frontend should call `/api/notifications/simpletexting-stats?force_refresh=true` (authenticated) to refresh stats.
- The backend public stats endpoint should bypass cache when `force_refresh=true`.
- Be careful with dynamic route ordering to avoid shadowing.

### 5.5 Invitation statistics

`InvitationService.get_statistics()` endpoint `/api/invitations/stats` must handle string dates:

```python
# In the aggregation pipeline, filter by $type: "date" before date arithmetic
{"createdAt": {"$type": "date"}}
```

Wrap average-time calculation in try/except so stats still return even when dates are malformed.

### 5.6 Status change emails

See `.devin/skills/status-change-notifications.md`.

---

## 6. Data cleanup and retention

### 6.1 Legacy `/messages` read-time cleanup

`GET /api/users/messages/conversation/{other_username}` must:

- Parse `scheduledDeleteAt` in multiple formats.
- Hide rows whose `scheduledDeleteAt` is in the past.
- Opportunistically delete expired rows from `messages`.

### 6.2 Messenger `get_messages` retention guard

`messenger_service.get_messages` must:

- Read `messageRetentionHours`.
- Filter out messages whose `expireAt` is past or whose `createdAt`/`updatedAt` plus the retention window is expired.
- Opportunistically delete expired legacy rows that lack `expireAt`.
- Support multiple timestamp formats.

---

## 7. Testing and quality

- New backend features need `tests/test_<feature>.py` with:
  - Happy path
  - Validation errors (`422`)
  - Not found (`404`)
  - Auth / authorization
  - Edge cases
- Do not delete or weaken tests without explicit approval.
- Run `pytest` before submitting backend changes.
