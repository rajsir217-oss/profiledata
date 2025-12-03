# Status Change Email Notifications

**Implemented:** December 2, 2025  
**Feature:** Automatic email notifications when admin changes user account status

## Overview

When an admin changes a user's account status, the system now automatically queues an email notification to inform the user. This ensures users are always aware of changes to their account status.

## Supported Status Changes

### 1. Profile Approved (pending → active)
- **Trigger:** Admin changes status from `pending_admin_approval` or `pending` to `active`
- **Email:** "🎉 Your Profile is Now Active - Welcome to USVedika!"
- **Content:** 
  - Congratulates user on approval
  - Lists available features (browse matches, messaging, favorites, etc.)
  - CTA button to dashboard
  - Admin's reason (if provided) is included

### 2. Account Suspended
- **Trigger:** Admin changes status to `suspended`
- **Email:** "⚠️ Your Account Has Been Suspended"
- **Content:**
  - Explains account is temporarily suspended
  - Shows admin's reason for suspension
  - Lists restrictions (no access, profile hidden, no messaging)
  - Contact support button
  - Admin's reason is displayed prominently

### 3. Account Banned
- **Trigger:** Admin changes status to `suspended` with reason containing "ban" or "permanent"
- **Email:** "⛔ Your Account Has Been Banned"
- **Content:**
  - Explains account is permanently banned
  - Shows admin's reason for ban
  - Lists consequences (account closed, data removed, cannot create new account)
  - Contact support button (for questions only)
  - Admin's reason is displayed prominently

### 4. Account Paused (Admin-Initiated)
- **Trigger:** Admin changes status to `paused`
- **Email:** "⏸️ Your Account Has Been Paused by Admin"
- **Content:**
  - Explains account has been paused by admin
  - Shows admin's reason for pause
  - Lists restrictions (profile hidden, no new messages, existing matches preserved)
  - Distinguishes from user-initiated pause
  - Contact support button
  - Admin's reason is displayed prominently

## Implementation Details

### Backend Changes

#### 1. Updated Status Change Endpoint
**File:** `/fastapi_backend/auth/admin_routes.py`

**Added:**
- `reason` field to `StatusUpdateRequest` model
- `_queue_status_change_notification()` helper function
- Notification queuing after successful status update

**Endpoint:** `PATCH /api/admin/users/{username}/status`

**Request Body:**
```json
{
  "status": "active",
  "reason": "Verified user credentials and profile information"
}
```

#### 2. Notification Queuing Function
```python
async def _queue_status_change_notification(
    db,
    username: str,
    user_email: str,
    old_status: str,
    new_status: str,
    reason: Optional[str],
    admin_username: str
)
```

**Logic:**
- Only queues for: approval, suspension, ban, paused
- Determines notification type based on status transition
- Includes admin's reason in template data
- Queues to `notification_queue` collection
- Fails gracefully (doesn't break status update if notification fails)

#### 3. Email Templates
**Collection:** `notification_templates`

Four templates created:
- `status_approved` - Green success theme
- `status_suspended` - Orange warning theme  
- `status_banned` - Red error theme
- `status_paused` - Blue/indigo info theme

All templates:
- Use responsive HTML with inline CSS
- Include USVedika branding
- Display username, status, message, and reason
- Provide relevant CTA buttons
- Show help/contact footer

### Processing

Notifications are processed by the existing **Email Notifier Job** (`job_templates/email_notifier_template.py`):
- Runs every 1 minute
- Picks up pending notifications from queue
- Renders template with user data
- Sends via SMTP (Gmail)
- Updates status to 'sent' or 'failed'
- Tracks attempts and errors

## Data Flow

```
1. Admin opens "Change User Status" modal
   ↓
2. Selects new status + enters reason (optional)
   ↓
3. Frontend: PATCH /api/admin/users/{username}/status
   ↓
4. Backend: Updates user.accountStatus in database
   ↓
5. Backend: Queues notification (if status is approval/suspension/ban)
   ↓
6. Backend: Logs audit event
   ↓
7. Email Notifier Job (runs every 1 min):
   - Fetches pending notifications
   - Renders email template
   - Sends email via SMTP
   - Marks as 'sent'
   ↓
8. User receives email notification
```

## Database Schema

### notification_queue Collection
```javascript
{
  username: "aaravmishra021",
  email: "aaravmishra21@example.com",
  type: "status_approved",
  channel: "email",
  subject: "🎉 Your Profile is Now Active - Welcome to USVedika!",
  templateData: {
    username: "aaravmishra021",
    status: "active",
    message: "Your profile has been approved...",
    reason: "Verified credentials"  // Optional
  },
  status: "pending",  // pending → sent/failed
  attempts: 0,
  metadata: {
    old_status: "pending_admin_approval",
    new_status: "active",
    reason: "Verified credentials",
    changed_by: "admin"
  },
  createdAt: ISODate("2025-12-02T..."),
  updatedAt: ISODate("2025-12-02T...")
}
```

## Testing

### Test Scenario 1: Profile Approval
```bash
# 1. Create test user with pending status
mongosh matrimonialDB --eval "db.users.findOne({username: 'testuser'}).accountStatus"
# Expected: "pending_admin_approval"

# 2. Admin changes status to 'active' with reason
curl -X PATCH http://localhost:8000/api/admin/users/testuser/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "reason": "Profile verified successfully"}'

# 3. Check notification queue
mongosh matrimonialDB --eval "db.notification_queue.findOne({username: 'testuser', type: 'status_approved'})"

# 4. Wait 1 minute for email notifier job to run

# 5. Check email sent
mongosh matrimonialDB --eval "db.notification_log.findOne({username: 'testuser', type: 'status_approved'})"
```

### Test Scenario 2: Account Suspension
```bash
# Admin suspends user
curl -X PATCH http://localhost:8000/api/admin/users/testuser/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended", "reason": "Inappropriate profile content"}'

# User receives "Account Suspended" email with reason
```

### Test Scenario 3: Account Ban
```bash
# Admin bans user (reason contains "ban" keyword)
curl -X PATCH http://localhost:8000/api/admin/users/testuser/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended", "reason": "Permanent ban for Terms of Service violation"}'

# User receives "Account Banned" email (red theme)
```

### Test Scenario 4: Account Paused
```bash
# Admin pauses user account
curl -X PATCH http://localhost:8000/api/admin/users/testuser/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused", "reason": "Incomplete profile verification pending"}'

# User receives "Account Paused by Admin" email (blue/indigo theme)
```

## Frontend Integration

**No frontend changes required!** The existing modal already has:
- Status selection radio buttons
- "Reason (optional)" textarea
- Update Status button

The backend automatically:
- Accepts the reason field
- Queues appropriate notification
- Sends email asynchronously

## Configuration

### Environment Variables
Uses existing notification system configuration:
- `SMTP_HOST` - Gmail SMTP server
- `SMTP_PORT` - 587 (TLS)
- `SMTP_USERNAME` - Sender email
- `SMTP_PASSWORD` - App password
- `SMTP_FROM_EMAIL` - "USVedika Notifications"

### Email Scheduler
**Job Template:** `email_notifier_template.py`  
**Frequency:** Every 1 minute  
**Batch Size:** 50 notifications per run

## Monitoring

### Check Pending Notifications
```bash
mongosh matrimonialDB --eval "db.notification_queue.countDocuments({status: 'pending', type: /status_/})"
```

### Check Sent Notifications (Last 24 hours)
```bash
mongosh matrimonialDB --eval "db.notification_log.countDocuments({
  type: {$in: ['status_approved', 'status_suspended', 'status_banned', 'status_paused']},
  sentAt: {$gte: new Date(Date.now() - 24*60*60*1000)}
})"
```

### Check Failed Notifications
```bash
mongosh matrimonialDB --eval "db.notification_queue.find({
  status: 'failed',
  type: /status_/
}, {username: 1, type: 1, error: 1})"
```

## Error Handling

1. **No Email Address:** Notification is skipped (logged as warning)
2. **Template Not Found:** Uses fallback plain text email
3. **SMTP Error:** Marked as 'failed', retried up to 3 times
4. **Notification Failure:** Does NOT block status change (user gets status update, notification fails gracefully)

## Future Enhancements

1. **SMS Notifications:** Add SMS channel for critical changes (suspension/ban)
2. **Push Notifications:** Browser/mobile push for real-time alerts
3. **In-App Notifications:** Show notification banner on next login
4. **Email Preferences:** Allow users to opt-out of non-critical notifications
5. **Template Customization:** Admin UI to edit email templates
6. **Multi-language:** Translate emails based on user's preferred language

## Files Modified

1. `/fastapi_backend/auth/admin_routes.py` - Added notification queuing
2. `/fastapi_backend/seed_status_change_templates.py` - Created (template seeder)
3. Database: `notification_templates` collection - Added 4 templates

## Rollback

If issues occur, to disable notifications:

```javascript
// Disable all status change templates
db.notification_templates.updateMany(
  {trigger: {$in: ['status_approved', 'status_suspended', 'status_banned', 'status_paused']}},
  {$set: {enabled: false}}
)
```

Or remove the notification queuing call from `admin_routes.py` (lines 467-476).

---

**Status:** ✅ Implemented and Active  
**Last Updated:** December 2, 2025  
**Maintained By:** Development Team
