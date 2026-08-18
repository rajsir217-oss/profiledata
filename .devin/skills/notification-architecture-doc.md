---
description: Generate a current architecture document for the notification queue.
---

# Skill: Write the Notification Queue Architecture Doc

## When to use

When the user asks for a current architecture document describing the notification queue implementation as-of-now.

## Output location

Update the existing doc:
- `docs/NOTIFICATION_SYSTEM_HYBRID_ARCHITECTURE.md`

Or create a new focused doc:
- `docs/NOTIFICATION_QUEUE_ARCHITECTURE.md`

## Sections to include

1. **Collections**
   - `notification_queue` — pending notifications.
   - `notification_log` — sent/failed history.
   - `notification_templates` — reusable email/SMS templates.

2. **Job templates**
   - `fastapi_backend/job_templates/email_notifier_template.py`
   - `fastapi_backend/job_templates/sms_notifier_template.py`

3. **End-to-end flow**
   - Something queues a notification (status change, monthly digest, invite, etc.).
   - Unified scheduler triggers the notifier job.
   - Notifier pulls pending items, renders templates, sends via SMTP/SMS gateway.
   - Result is written to `notification_log` and the queue item is updated.

4. **Status mapping**
   - `pending` -> "queued" in UI
   - `sent` -> "sent"
   - `failed` -> "failed"

5. **Reliability**
   - Max retry/attempts (typically 3).
   - Atomic claim in `JobRegistryService.claim_job_for_execution`.
   - Unified scheduler claims jobs before executing to prevent duplicate sends in multi-instance deployments.
   - Dedupe by username/email for batch jobs such as monthly digest.

6. **UI**
   - Event Queue Manager (admin-only) in the frontend.

7. **Integration points**
   - Admin status change emails.
   - Monthly digest.
   - Messenger public recipient invites.

## Code examples

Include the correct Pydantic id access and MongoDB update syntax:

```python
notif_id = notification.id

update_doc = {
    "$set": {"status": "sent", "updatedAt": datetime.utcnow()},
    "$inc": {"attempts": 1},
}
```

## Verification

- Confirm the document accurately reflects current collections and job templates.
- Cross-check with `fastapi_backend/services/notification_service.py` and the notifier job templates.
