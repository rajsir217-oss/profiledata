# Production Deployment Plan - Email Templates

**Feature Branch:** `feature/email-template-enhancements`  
**Target:** Production (GCP)  
**Date:** November 7, 2025  
**Deployed By:** Admin

---

## 📦 What's Being Deployed

### **New Features**
1. ✅ **20 Email Templates** (up from 5) - 100% coverage
2. ✅ **Email Template Preview UI** - Admin dashboard for viewing templates
3. ✅ **Test Scripts** - Create and verify test notifications
4. ✅ **Comprehensive Documentation** - User + Technical guides
5. ✅ **Search UX Improvements** - Default filters, sort by age, clear button fixes

### **Backend Changes**
- New router: `/api/users/email-templates`
- New files:
  - `routers/email_templates.py`
  - `email_templates_priority1.py`
  - `seed_missing_email_templates.py`
  - `test_notification_templates.py`

### **Frontend Changes**
- New component: `EmailTemplatePreview.js`
- New CSS: `EmailTemplatePreview.css`
- Sidebar menu: Added "Email Templates" link
- Route: `/email-templates`

### **Database Changes**
- ✅ **20 templates** in `notification_templates` collection (already seeded)
- No schema changes (uses existing collections)

---

## ✅ Pre-Deployment Checklist

### **1. Code Quality**
- [x] All code committed to feature branch
- [x] No merge conflicts
- [x] ESLint/Python linting passes
- [x] No console.logs in production code

### **2. Testing**
- [x] Templates preview UI working locally
- [x] Test notifications created successfully
- [x] API endpoints responding correctly
- [x] Mobile responsive verified
- [x] Theme-aware UI (light/dark mode)

### **3. Database**
- [x] All 20 templates seeded in MongoDB
- [x] Indexes present on collections
- [x] Test data cleaned up

### **4. Configuration**
- [ ] **CRITICAL:** Verify production SMTP credentials in `.env.production`
- [ ] Check production frontend/backend URLs
- [ ] Verify MongoDB connection string
- [ ] Review scheduler settings

### **5. Documentation**
- [x] User guide created
- [x] Technical documentation complete
- [x] Deployment plan documented (this file)

---

## 🔧 Production Configuration

### **Required Environment Variables**

Verify these in **`.env.production`**:

```bash
# SMTP Settings (CRITICAL - Required for email sending)
SMTP_HOST=smtp.sendgrid.net  # Or your production SMTP
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-production-sendgrid-key
FROM_EMAIL=noreply@yourapp.com
FROM_NAME=YourApp

# Application URLs
FRONTEND_URL=https://yourapp.com
BACKEND_URL=https://api.yourapp.com

# MongoDB (Production)
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net
DATABASE_NAME=matrimonialDB

# Scheduler
SCHEDULER_ENABLED=true
EMAIL_NOTIFIER_INTERVAL_MINUTES=5
```

### **SMTP Provider Recommendations**

**For Production, use:**
- ✅ **SendGrid** (Recommended) - 100 emails/day free, 99% deliverability
- ✅ **AWS SES** - $0.10 per 1000 emails, excellent deliverability
- ❌ **Gmail** - NOT recommended for production (rate limits, blocks)

---

## 🚀 Deployment Steps

### **Step 1: Merge to Main Branch**

```bash
# Ensure you're on feature branch
git checkout feature/email-template-enhancements

# Pull latest main
git checkout main
git pull origin main

# Merge feature branch
git merge feature/email-template-enhancements

# Resolve any conflicts if needed
# Then push to main
git push origin main
```

### **Step 2: Seed Production Database**

**IMPORTANT:** Only if templates aren't already in production DB.

```bash
# SSH into production server or run locally pointing to prod DB
cd fastapi_backend

# Check if templates exist
python3 -c "
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from config import Settings

async def check():
    settings = Settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    count = await db.notification_templates.count_documents({'channel': 'email'})
    print(f'Email templates in production: {count}')
    if count < 20:
        print('⚠️  Need to seed missing templates!')
    else:
        print('✅ All templates present')
    client.close()

asyncio.run(check())
"

# If needed, seed templates
python3 seed_email_templates.py  # Original 5
python3 seed_missing_email_templates.py  # Additional 15
```

### **Step 3: Deploy Backend (GCP)**

```bash
cd deploy_gcp

# Option A: Automated deployment
./deploy.sh backend production

# Option B: Manual deployment
gcloud app deploy backend/app.yaml --project=your-project-id --version=email-templates

# Verify deployment
curl https://api.yourapp.com/health
curl https://api.yourapp.com/api/users/email-templates/templates/categories
```

### **Step 4: Deploy Frontend (GCP)**

```bash
# Build production frontend
cd frontend
npm run build

# Deploy to GCP
cd ../deploy_gcp
./deploy.sh frontend production

# Or manual:
gcloud app deploy frontend/app.yaml --project=your-project-id

# Verify
open https://yourapp.com/email-templates
```

### **Step 5: Verify Email Notifier Job**

```bash
# Check scheduler status
curl https://api.yourapp.com/api/scheduler/jobs | jq '.jobs[] | select(.templateType=="email_notifier")'

# Should show:
{
  "jobName": "Email Notifier",
  "templateType": "email_notifier",
  "enabled": true,
  "schedule": {
    "type": "interval",
    "intervalMinutes": 5
  }
}
```

### **Step 6: Create Test Notification**

```bash
# On production (via admin UI or script)
# Create ONE test notification to verify system works

# Monitor in Event Queue Manager
# Watch for status change: queued → processing → sent
```

### **Step 7: Monitor Initial Emails**

```bash
# Watch logs
gcloud app logs tail -s default

# Check MongoDB
# notification_queue - should decrease
# notification_log - should increase with status "sent"

# Check SMTP provider dashboard
# SendGrid: https://app.sendgrid.com/stats
# AWS SES: CloudWatch metrics
```

---

## 🔍 Post-Deployment Verification

### **Checklist:**

1. **Admin UI Access**
   - [ ] Login as admin
   - [ ] Navigate to Email Templates
   - [ ] See all 20 templates listed
   - [ ] Click one template - preview loads

2. **Template API**
   - [ ] GET `/api/users/email-templates/templates` returns 20 templates
   - [ ] GET `/api/users/email-templates/templates/categories` returns 9 categories
   - [ ] GET `/api/users/email-templates/templates/mutual_favorite` returns template

3. **Notification System**
   - [ ] Event Queue Manager shows queue
   - [ ] Create test notification via UI
   - [ ] Notification appears in queue
   - [ ] Email Notifier job processes it (wait ~5 min)
   - [ ] Status changes to "sent"
   - [ ] Check recipient inbox - email received

4. **Email Sending**
   - [ ] Test email received
   - [ ] HTML renders correctly
   - [ ] Variables replaced properly
   - [ ] Unsubscribe link works
   - [ ] Mobile responsive (check on phone)

5. **Scheduler**
   - [ ] Email Notifier job is running
   - [ ] Check logs for job execution
   - [ ] No errors in logs
   - [ ] Queue processing regularly

---

## 🚨 Rollback Plan

If something goes wrong:

### **Option 1: Quick Fix**
```bash
# Fix the issue in code
git add .
git commit -m "hotfix: description"
git push origin main

# Redeploy
cd deploy_gcp
./deploy.sh backend production
./deploy.sh frontend production
```

### **Option 2: Full Rollback**
```bash
# Revert to previous commit
git log --oneline -5  # Find commit before merge
git revert <commit-hash>
git push origin main

# Redeploy previous version
./deploy.sh backend production
./deploy.sh frontend production

# Disable email templates in admin UI
# Mark feature as "beta" until fixed
```

### **Option 3: Feature Flag**
```bash
# In production, disable Email Templates menu item
# Edit Sidebar.js - comment out Email Templates entry
# Users won't see it, but system still works

# Disable email_notifier job temporarily if needed
# Via admin UI: Scheduler → Email Notifier → Disable
```

---

## 📊 Success Metrics

**After 24 hours:**

- [ ] Email delivery rate > 95%
- [ ] No critical errors in logs
- [ ] Queue processing time < 2 minutes
- [ ] User complaints = 0
- [ ] SMTP sending successful

**After 1 week:**

- [ ] All 20 templates used at least once
- [ ] Email open rate > 30%
- [ ] Email click rate > 10%
- [ ] Failed deliveries < 1%

---

## 🐛 Common Issues & Solutions

### **Issue: Emails not sending**
**Check:**
1. SMTP credentials in `.env.production`
2. Email Notifier job is enabled
3. SMTP server allows connection from GCP IP
4. Check `gcloud app logs` for SMTP errors

**Solution:**
- Verify SMTP credentials
- Test SMTP connection manually
- Check SendGrid/SES dashboard for blocks

### **Issue: Template variables not replacing**
**Check:**
1. Notification data structure
2. Template body has correct {variable.name} syntax
3. Logs show template rendering

**Solution:**
- View template in admin UI
- Check sample notification data structure
- Verify NotificationService.render_template() logic

### **Issue: Admin UI not loading templates**
**Check:**
1. API endpoint responding
2. JWT auth working
3. Browser console for errors
4. Network tab shows 200 response

**Solution:**
- Test API endpoint directly with curl
- Check JWT token validity
- Verify admin user authentication

---

## 📞 Support Contacts

**Technical Issues:**
- DevOps: devops@yourapp.com
- Backend: backend-team@yourapp.com
- Frontend: frontend-team@yourapp.com

**SMTP Issues:**
- SendGrid: https://support.sendgrid.com
- AWS SES: AWS Support Console

**Emergency:**
- On-call engineer: Use PagerDuty
- System down: Execute rollback immediately

---

## 📝 Deployment Log

**Record deployment details here:**

```
Date: _______________________
Time: _______________________
Deployed By: _______________________
Backend Version: _______________________
Frontend Version: _______________________
Database Migration: ☐ Yes ☐ No
Issues Encountered: _______________________
Resolution: _______________________
Status: ☐ Success ☐ Partial ☐ Rolled Back
```

---

## ✅ Final Checklist

Before marking deployment complete:

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Database seeded (20 templates)
- [ ] SMTP configured and tested
- [ ] Email Notifier job running
- [ ] Admin UI accessible
- [ ] Test email sent and received
- [ ] Monitoring dashboards updated
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Rollback plan ready

---

**Deployment Status:** ⏳ PENDING

**Sign-off:**
- Backend Lead: _______________
- Frontend Lead: _______________
- DevOps: _______________
- QA: _______________

---

**Last Updated:** November 7, 2025  
**Next Review:** 24 hours post-deployment
