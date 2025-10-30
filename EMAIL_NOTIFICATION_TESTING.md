# 📧 Email Notification System - Testing Guide

**Last Updated:** October 29, 2025  
**Status:** ✅ Fully Working with Mailtrap

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Start Backend
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata
./bstart.sh
```

### Step 2: Create Test Notification
```bash
cd fastapi_backend
python3 admin_tools/test_real_email.py <<< "rajsir217@gmail.com"
```

### Step 3: Run Email Job
1. Open app: http://localhost:3000
2. Go to: **Admin** → **Dynamic Scheduler**
3. Find: **"Email Notifications"** job
4. Click: **"Run Now"** ▶️

### Step 4: Check Mailtrap
1. Go to: https://mailtrap.io/inboxes
2. Click: **"Sandboxes"** → **"My Sandbox"**
3. Click: **📧 Envelope icon** (top toolbar)
4. View the captured email!

---

## ✅ What's Working

| Component | Status | Notes |
|-----------|--------|-------|
| **Backend** | ✅ Working | FastAPI running on port 8000 |
| **Notification Queue** | ✅ Working | MongoDB collection: `notification_queue` |
| **Email Job** | ✅ Working | Template: `email_notifier` |
| **SMTP Connection** | ✅ Working | Mailtrap sandbox |
| **Email Delivery** | ✅ Working | Emails captured in Mailtrap |

---

## 📋 Current Configuration

### SMTP Settings (`.env.local`)
```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=2a7eb00af4bb06
SMTP_PASSWORD=ef9dd8f3c6c3eb
FROM_EMAIL=noreply@l3v3l-local.com
FROM_NAME=L3V3L Dating (Local)
```

### Test User
- **Username:** admin
- **Email:** rajsir217@gmail.com
- **Database:** matrimonialDB

---

## 🔧 Common Issues & Solutions

### Issue 1: "No pending email notifications"
**Cause:** Queue is empty  
**Fix:** Run the test script to create a notification

### Issue 2: "User 'test_user' not found"
**Cause:** Test script uses wrong username  
**Fix:** Already fixed - now uses "admin" by default

### Issue 3: "0 processed"
**Cause:** All notifications have status "sent" or "failed"  
**Fix:** Create fresh notification with `status: "pending"`

### Issue 4: No email in Mailtrap
**Cause:** Using wrong job (Bulk Email Notification vs Email Notifications)  
**Fix:** Use "Email Notifications" job (template: `email_notifier`)

---

## 📊 Job Details

### ✅ CORRECT Job: "Email Notifications"
- **Template:** `email_notifier`
- **What it does:** Processes `notification_queue` and sends via SMTP
- **Use this for:** Real email sending via Mailtrap

### ❌ WRONG Job: "Bulk Email Notification"
- **Template:** `email_notification`
- **What it does:** Only simulates email sending (logs only)
- **Don't use for:** Testing real SMTP

---

## 🚀 Testing Workflow (Clean Process)

### 1. Create Notification
```bash
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend
python3 admin_tools/test_real_email.py <<< "rajsir217@gmail.com"
```

**Expected Output:**
```
✅ Created test notification: [ID]
📋 Notification ID: [ID]
```

### 2. Verify Notification in Queue
```bash
mongosh "mongodb://localhost:27017/matrimonialDB" --quiet --eval \
  "db.notification_queue.find({status: 'pending', channels: {\$in: ['email']}}).count()"
```

**Expected:** Should show `1` (or more)

### 3. Run Email Job
- Go to: http://localhost:3000/admin (Dynamic Scheduler)
- Click: **"Email Notifications"** → **"Run Now"**

**Expected Result:**
```json
{
  "sent": 1,
  "failed": 0,
  "total": 1
}
```

### 4. Verify in Mailtrap
- URL: https://mailtrap.io/inboxes
- Navigate: Sandboxes → My Sandbox → 📧
- Check: Email should be there with:
  - **To:** rajsir217@gmail.com
  - **From:** L3V3L Dating <noreply@l3v3l-local.com>
  - **Subject:** New weekly_digest notification

---

## 📁 Important Files

```
/fastapi_backend/
├── .env.local                          # SMTP configuration
├── admin_tools/
│   └── test_real_email.py              # Test notification generator
├── job_templates/
│   └── email_notifier_template.py      # Email job logic
└── services/
    └── email_service.py                # SMTP sending logic

/frontend/src/components/
└── DynamicScheduler.js                 # Job management UI
```

---

## 🎯 Tomorrow's Testing Checklist

- [ ] Start backend (`./bstart.sh`)
- [ ] Create test notification (test script)
- [ ] Verify notification in MongoDB
- [ ] Run "Email Notifications" job
- [ ] Check Mailtrap inbox
- [ ] Verify email content and formatting
- [ ] Test with different notification types
- [ ] Test bulk notifications (multiple at once)

---

## 💡 Tips for Tomorrow

1. **Always use "admin" username** - it exists in database
2. **Check notification status** - must be "pending" to process
3. **Use correct job** - "Email Notifications" not "Bulk Email Notification"
4. **Mailtrap inbox location** - Sandboxes → My Sandbox → 📧 icon
5. **Fresh test every time** - Run test script before each job run

---

## 🔗 Quick Links

- **App:** http://localhost:3000
- **Dynamic Scheduler:** http://localhost:3000/admin
- **API Docs:** http://localhost:8000/docs
- **Mailtrap:** https://mailtrap.io/inboxes
- **Backend Logs:** Terminal running `./bstart.sh`

---

## ✨ Success Criteria

Your email notification system is working when:
- ✅ Test script creates notification without errors
- ✅ Job processes 1+ notifications (not 0)
- ✅ Job status shows "success" with "sent": 1
- ✅ Email appears in Mailtrap inbox
- ✅ Email has correct recipient and content

---

**Everything is configured and working! See you tomorrow for fresh testing!** 🎉
