---
description: Implement or modify status-change email notifications for admin user actions.
---

# Skill: Status Change Email Notifications

## Endpoint

`PATCH /api/admin/users/{username}/status` in `fastapi_backend/auth/admin_routes.py`.

## Request body

```json
{
  "status": "active",
  "reason": "Optional admin reason"
}
```

## Notification types

| Admin action | Notification type | Email style |
|---|---|---|
| pending -> active | `status_approved` | Green success |
| any -> suspended | `status_suspended` | Orange warning |
| any -> suspended with "ban" or "permanent" in reason | `status_banned` | Red error |
| any -> paused | `status_paused` | Blue/indigo info |

## Flow

1. Admin updates user status.
2. Backend persists the status change.
3. Backend queues an email notification to `notification_queue`.
4. Email notifier job processes the queue every minute.
5. Template is rendered from `notification_templates`.
6. Email is sent; status change is **not** blocked by notification failure.

## Template content

- Include the admin's optional `reason` in the email body.
- Provide CTAs such as "Go to dashboard" or "Contact support".
- Use responsive HTML.

## Seeding

If templates do not exist, run or reference the seeder (e.g., `seed_status_change_templates.py`) to populate `notification_templates`.

## Error handling

- Notification failure must not block the status change.
- Retry on SMTP errors up to 3 attempts.
- Log failures to `notification_log`.

## Verification

- Change a user status and confirm the queue item is created with the correct type.
- Confirm the email notifier sends/renders the email.
- Confirm graceful degradation when SMTP is unavailable.
