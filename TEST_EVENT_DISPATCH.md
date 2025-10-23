# Event Dispatch Testing Guide

## Problem
Activity log shows events but Event Queue is empty (0 queued, 1 sent in 24h)

## Root Cause
Backend server needs restart to load new event dispatcher code added in commits:
- `33d5a32` - Added profile_viewed, pii_granted, pii_rejected dispatchers
- `134c89b` - Added pii_requested dispatcher

## Test Plan

### 1. Restart Backend
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./bstart.sh
```

### 2. Test Profile View Notifications
**Action:** Have user A view user B's profile

**Expected:**
- Activity Log: ✅ Profile Viewed entry
- Event Queue: ✅ New notification queued for user B
  - Trigger: "profile_view"
  - Channel: "push"
  - Status: "queued" or "sent"

**Verify:**
```bash
# Check notification queue
mongosh matrimonialDB --eval "db.notification_queue.find({trigger: 'profile_view'}).sort({createdAt: -1}).limit(3).pretty()"
```

### 3. Test PII Request Notifications
**Action:** User A requests PII from user B

**Expected:**
- Activity Log: ✅ PII Request Sent
- Event Queue: ✅ New notification queued for user B
  - Trigger: "pii_request"
  - Channels: ["email", "sms"]
  - Status: "queued"

**Verify:**
```bash
mongosh matrimonialDB --eval "db.notification_queue.find({trigger: 'pii_request'}).sort({createdAt: -1}).limit(3).pretty()"
```

### 4. Test PII Approval Notifications
**Action:** User B approves user A's PII request

**Expected:**
- Activity Log: ✅ PII Request Approved
- Event Queue: ✅ New notification queued for user A (requester)
  - Trigger: "pii_granted"
  - Channels: ["email", "push"]
  - Status: "queued"

**Verify:**
```bash
mongosh matrimonialDB --eval "db.notification_queue.find({trigger: 'pii_granted'}).sort({createdAt: -1}).limit(3).pretty()"
```

### 5. Test PII Rejection Notifications
**Action:** User B rejects user A's PII request

**Expected:**
- Activity Log: ✅ PII Request Denied
- Event Queue: ✅ New notification queued for user A (requester)
  - Trigger: "pii_rejected" 
  - Channels: ["email", "push"]
  - Status: "queued"

**Verify:**
```bash
mongosh matrimonialDB --eval "db.notification_queue.find({trigger: 'pii_rejected'}).sort({createdAt: -1}).limit(3).pretty()"
```

## Debugging If Still Failing

### Check Backend Logs
```bash
# Look for dispatch errors
grep -i "dispatch\|queue_notification" logs/*.log | tail -50

# Look for notification service errors
grep -i "notification.*error" logs/*.log | tail -50
```

### Check User Preferences
```bash
# Verify user has notifications enabled
mongosh matrimonialDB --eval "db.notification_preferences.findOne({username: 'TARGET_USERNAME'})"
```

### Check Event Dispatcher
```python
# Add debug logging to routes.py where dispatch is called:
logger.info(f"🔥 About to dispatch profile_viewed event")
await dispatcher.dispatch(...)
logger.info(f"✅ Dispatch completed")
```

### Check Notification Service
```python
# Add debug logging to notification_service.py queue_notification:
print(f"🔥 queue_notification called: {username}, {trigger}, {channels}")
result = await self.enqueue_notification(queue_data)
print(f"✅ Enqueued: {result}")
```

## Known Working Events
These already dispatch correctly (from previous commits):
- ✅ Favorite Added
- ✅ Favorite Removed
- ✅ Shortlist Added
- ✅ Shortlist Removed

## Newly Fixed Events
These should work after restart:
- 🆕 Profile Viewed
- 🆕 PII Requested
- 🆕 PII Granted
- 🆕 PII Rejected

## Current Status
- Backend running: YES (PID 17698)
- New code loaded: ❌ NO - needs restart
- Event handlers registered: ✅ YES (in code)
- User preferences: ✅ Configured
- Notification queue: ✅ Working (old events visible)

**ACTION REQUIRED: Restart backend with ./bstart.sh**
