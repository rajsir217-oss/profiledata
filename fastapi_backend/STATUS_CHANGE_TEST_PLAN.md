# Status Change Complete Flow - Test Plan ✅

**Date:** December 6, 2025  
**All Fixes Applied:** Backend restarted at 10:44am

---

## 🔧 What Was Fixed

### 1. ✅ Field Reading Bug (CRITICAL)
**Problem:** Code read from wrong field
```python
# ❌ OLD CODE - Read from status.status (online/activity field)
old_status_value = user.get('status', {}).get('status')

# ✅ NEW CODE - Read from accountStatus (account status field)
old_status_value = user.get('accountStatus')
```

**Why this matters:**
- `status.status` = Legacy/activity field (not account status)
- `accountStatus` = Unified account status field (active/suspended/banned)
- Events only trigger when REAL status changes

---

### 2. ✅ Event Dispatcher Method Name
**Problem:** Called wrong method
```python
# ❌ OLD
await event_dispatcher.dispatch_event({...})

# ✅ NEW
await event_dispatcher.dispatch(
    event_type=UserEventType.USER_SUSPENDED,
    actor_username="admin",
    target_username="user123",
    metadata={...}
)
```

---

### 3. ✅ Activity Log Mappings
**Added missing mappings:**
```python
UserEventType.USER_APPROVED → ActivityType.USER_STATUS_CHANGED
UserEventType.USER_PAUSED → ActivityType.USER_STATUS_CHANGED
```

---

### 4. ✅ Email Templates with Environment URLs
**Templates now use:**
- Local: `http://localhost:3000/dashboard`
- Production: `https://l3v3lmatches.com/dashboard`

Auto-detected via `EnvironmentManager`

---

### 5. ✅ Event Handlers Created
```python
async def _handle_user_approved(event_data)
async def _handle_user_suspended(event_data)
async def _handle_user_banned(event_data)
async def _handle_user_paused(event_data)
```

All queue notifications with correct triggers

---

## 🧪 Complete Test Flow

### Test 1: Suspend User (active → suspended)

**Target User:** adityaiyer025 (currently suspended, change to active first)

**Steps:**
1. Go to User Management
2. Find user: **adityaiyer025**
3. Change status: **"Active"** (if not already)
4. Save
5. Change status: **"Suspended"** with reason "Test suspension"
6. Save

**Expected Results:**

#### A. Status Updated ✅
```bash
mongosh matrimonialDB --eval "
  db.users.findOne(
    {username: 'adityaiyer025'}, 
    {accountStatus: 1}
  )
"
```
**Expected:** `accountStatus: "suspended"`

#### B. Event Dispatched ✅
**Check logs:**
```
📤 Dispatching event: user_suspended
✅ Queued 'status_suspended' notification for adityaiyer025
```

#### C. Notification Queued ✅
```bash
mongosh matrimonialDB --eval "
  db.notification_queue.find(
    {username: 'adityaiyer025', trigger: 'status_suspended'},
    {trigger: 1, status: 1, createdAt: 1}
  ).sort({createdAt: -1}).limit(1)
"
```
**Expected:**
```javascript
{
  trigger: "status_suspended",
  status: "pending",
  createdAt: ISODate("2025-12-06T...")  // Recent timestamp
}
```

#### D. Activity Logged ✅
```bash
mongosh matrimonialDB --eval "
  db.activity_logs.find(
    {username: 'adityaiyer025', action: 'user_suspended'},
    {action: 1, timestamp: 1}
  ).sort({timestamp: -1}).limit(1)
"
```

#### E. Email Sent (within 60 seconds) ✅
**Wait 60 seconds**, then check:
```bash
mongosh matrimonialDB --eval "
  db.notification_queue.findOne(
    {username: 'adityaiyer025', trigger: 'status_suspended'},
    {status: 1, sentAt: 1}
  )
"
```
**Expected:** `status: "sent"`, `sentAt: ISODate(...)`

**Check email log:**
```bash
mongosh matrimonialDB --eval "
  db.notification_log.find(
    {username: 'adityaiyer025', trigger: 'status_suspended'},
    {status: 1, sentAt: 1}
  ).sort({sentAt: -1}).limit(1)
"
```

---

### Test 2: Activate User (suspended → active)

**Steps:**
1. Change **adityaiyer025** from "Suspended" to "Active"
2. Save

**Expected Results:**

#### A. Event: USER_APPROVED ✅
```
📤 Dispatching event: user_approved
✅ Queued 'status_approved' notification for adityaiyer025
```

#### B. Notification Queued ✅
```bash
mongosh matrimonialDB --eval "
  db.notification_queue.find(
    {username: 'adityaiyer025', trigger: 'status_approved'}
  ).sort({createdAt: -1}).limit(1)
"
```

#### C. Email Content Verification ✅
**After email sent**, verify correct URL:
```bash
mongosh matrimonialDB --eval "
  db.notification_templates.findOne(
    {trigger: 'status_approved'}, 
    {body: 1}
  ).body
" | grep -o 'href="http[^"]*"' | head -3
```

**Expected (Local):**
```
href="http://localhost:3000/dashboard"
href="http://localhost:3000/help"
href="http://localhost:3000/contact"
```

**Expected (Production):**
```
href="https://l3v3lmatches.com/dashboard"
href="https://l3v3lmatches.com/help"
href="https://l3v3lmatches.com/contact"
```

---

### Test 3: Pause User

**Steps:**
1. Change any active user to "Paused" with reason
2. Save

**Expected Results:**
- Event: `user_paused`
- Notification: `status_paused`
- Email template: "⏸️ Your Account Has Been Paused by Admin"

---

### Test 4: Ban User

**Steps:**
1. Suspend user with reason containing "ban" or "permanent"
2. Save

**Expected Results:**
- Event: `user_banned` (not `user_suspended`)
- Notification: `status_banned`
- Email template: "⛔ Your Account Has Been Banned"

---

## 📊 Verification Checklist

### Backend
- [ ] Backend running without errors
- [ ] EventDispatcher initialized
- [ ] Email notifier job running (every 60s)
- [ ] Templates seeded

### Status Change
- [ ] Status updated in database (`accountStatus` field)
- [ ] Audit log created
- [ ] No 500 errors

### Events
- [ ] Event dispatched (check logs)
- [ ] Event type correct (USER_APPROVED/SUSPENDED/BANNED/PAUSED)
- [ ] Metadata includes reason and old/new status

### Notifications
- [ ] Notification queued with `status: "pending"`
- [ ] Trigger matches event type
- [ ] Email address correct
- [ ] Template data populated

### Activity Logs
- [ ] Activity logged with correct action type
- [ ] Timestamp recent
- [ ] Target username correct

### Email Delivery
- [ ] Notification status changes to `"sent"`
- [ ] `sentAt` timestamp set
- [ ] Entry in `notification_log`
- [ ] URLs point to correct environment

---

## 🔍 Debugging Commands

### Check Backend Logs
```bash
# Last 50 lines with errors/events
tail -50 /tmp/cascade_command_271_output.txt | grep -i "error\|dispatch\|suspended\|approved"
```

### Check Email Notifier Job
```bash
mongosh matrimonialDB --eval "
  db.dynamic_jobs.findOne(
    {template_type: 'email_notifier'},
    {name: 1, enabled: 1, lastRun: 1, nextRun: 1, 'schedule.interval_seconds': 1}
  )
"
```
**Expected:** `enabled: true`, `interval_seconds: 60`

### Check Pending Notifications
```bash
mongosh matrimonialDB --eval "
  db.notification_queue.countDocuments({status: 'pending'})
"
```

### Check Recent Status Changes
```bash
mongosh matrimonialDB --eval "
  db.audit_logs.find(
    {action: 'status_change'},
    {username: 1, 'details.new_status': 1, timestamp: 1}
  ).sort({timestamp: -1}).limit(5)
"
```

### Check Failed Notifications
```bash
mongosh matrimonialDB --eval "
  db.notification_queue.find(
    {status: 'failed'},
    {username: 1, trigger: 1, attempts: 1, error: 1}
  ).sort({updatedAt: -1}).limit(5)
"
```

---

## ⚠️ Common Issues

### 1. No Notification Queued
**Cause:** Event not triggered (status unchanged)
**Solution:** Verify `accountStatus` actually changed

### 2. Email Not Sent
**Causes:**
- Email notifier not running
- SMTP credentials missing
- Template not found

**Check:**
```bash
# SMTP configured?
grep SMTP fastapi_backend/.env

# Template exists?
mongosh matrimonialDB --eval "
  db.notification_templates.findOne({trigger: 'status_approved'})
"

# Email notifier running?
mongosh matrimonialDB --eval "
  db.dynamic_jobs.findOne({template_type: 'email_notifier'})
"
```

### 3. Wrong Email URLs
**Cause:** Wrong environment or template not reseeded
**Solution:**
```bash
cd fastapi_backend
./reseed_templates.sh
```

---

## ✅ Success Criteria

All tests pass when:
1. ✅ Status changes in database
2. ✅ Event logged in backend console
3. ✅ Notification queued with correct trigger
4. ✅ Activity log created
5. ✅ Email sent within 60 seconds
6. ✅ Email has correct URLs for environment
7. ✅ Notification status = "sent"
8. ✅ Entry in notification_log

---

## 🚀 Ready to Test!

**Start with Test 1:**
1. Activate adityaiyer025 (if suspended)
2. Then suspend with reason "Test suspension"
3. Check all verification points
4. Wait 60 seconds for email
5. Verify email sent and logged

**Everything is ready! All fixes applied and backend running.** 🎉
