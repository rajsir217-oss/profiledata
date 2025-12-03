# Production Deployment Plan - Dec 3, 2025

## Overview
Deployment includes email analytics fixes, enhanced database cleanup, and various improvements.

---

## 📋 SECTION 1: CODE CHANGES

### Backend Files Modified (Dec 3, 2025)

#### 1. Email Tracking Router
**File:** `/fastapi_backend/routers/email_tracking.py`

**Changes:**
- Fixed database dependency injection (changed `db = None` to `db = Depends(get_database)`)
- Fixed parameter ordering in `track_email_click()` function
- Now properly handles async database operations

**Impact:** Low risk - Bug fix only
**Testing:** Email tracking pixel and click tracking endpoints

---

#### 2. Database Cleanup Job Template
**File:** `/fastapi_backend/job_templates/database_cleanup.py`

**Changes:**
- Enhanced to support multiple collections in one run
- New parameter structure: `cleanup_targets` array
- Individual retention policies per collection
- Enhanced logging with emojis and clear breakdown by type
- Better error handling per collection

**Impact:** Medium risk - Structural change to job template
**Testing:** Run job manually and verify logs show per-collection breakdown

---

#### 3. Frontend: Email Analytics Component
**File:** `/frontend/src/components/EmailAnalytics.js`

**Changes:**
- Fixed API endpoint (changed `API_ENDPOINTS.BASE_URL` to `getBackendUrl()`)
- Now correctly calls backend API instead of hitting frontend

**Impact:** Low risk - Bug fix only
**Testing:** Access Email Analytics page, verify data loads

---

### New Files Created (Reference/Testing Only)

**NOT for production deployment:**
- `/fastapi_backend/test_email_analytics.py` - Test data generator (dev tool only)
- `EMAIL_ANALYTICS_FIX.md` - Documentation
- `DASHBOARD_AND_EMAIL_ANALYTICS_FIX.md` - Documentation
- `DATABASE_CLEANUP_ENHANCED.md` - Documentation

---

## 📊 SECTION 2: DATABASE CHANGES

### New Collections (Already Exist - Verify)

#### 1. `email_analytics`
**Purpose:** Track email opens and clicks
**Schema:**
```javascript
{
  tracking_id: String,           // notification_queue._id
  event_type: "open" | "click",
  timestamp: Date,
  ip_address: String,
  user_agent: String,
  referer: String,
  // For clicks only:
  link_type: String,
  destination_url: String
}
```

**Indexes Needed:**
```javascript
db.email_analytics.createIndex({ tracking_id: 1, event_type: 1 })
db.email_analytics.createIndex({ timestamp: -1 })
db.email_analytics.createIndex({ tracking_id: 1, timestamp: -1 })
```

**Current Data:** 26 documents (test data - can be cleared for production)

---

### Modified Collections

#### 1. `dynamic_jobs` - Updated "Database Cleanup" Job

**Before:**
```javascript
{
  name: "Database Cleanup",
  parameters: {
    collection: "logs",
    condition_type: "older_than_days",
    days_old: 2,
    date_field: "created_at"
  }
}
```

**After:**
```javascript
{
  name: "Database Cleanup",
  description: "Clean up old logs, activity logs, and job executions",
  parameters: {
    cleanup_targets: [
      { collection: "logs", days_old: 2, date_field: "created_at" },
      { collection: "activity_logs", days_old: 5, date_field: "timestamp" },
      { collection: "job_executions", days_old: 3, date_field: "created_at" }
    ],
    dry_run: false,
    batch_size: 100
  }
}
```

**Migration Script:**
```javascript
// Run in production MongoDB
db.dynamic_jobs.updateOne(
  { name: "Database Cleanup" },
  {
    $set: {
      description: "Clean up old logs, activity logs, and job executions",
      parameters: {
        cleanup_targets: [
          { collection: "logs", days_old: 2, date_field: "created_at" },
          { collection: "activity_logs", days_old: 5, date_field: "timestamp" },
          { collection: "job_executions", days_old: 3, date_field: "created_at" }
        ],
        dry_run: false,
        batch_size: 100
      },
      updatedAt: new Date()
    }
  }
);
```

---

#### 2. `notification_queue` - Enhanced with Email Tracking Fields

**Additional Fields (automatically added by email notifier):**
```javascript
{
  emailOpened: Boolean,
  emailOpenedAt: Date,
  emailOpenCount: Number,
  emailClickCount: Number,
  emailClicks: [
    {
      link_type: String,
      url: String,
      timestamp: Date
    }
  ]
}
```

**No migration needed** - Fields added dynamically

---

### Data to Clean (Optional - Dev Environment Only)

If deploying to production with clean slate:

```javascript
// Clear test email analytics data
db.email_analytics.deleteMany({});

// Verify notification templates exist
db.notification_templates.countDocuments({ channel: "email" });

// Should be > 0, if not, run seed script
```

---

## 🔧 SECTION 3: CONFIGURATION CHANGES

### Environment Variables (No Changes Required)

Existing variables should already be set:
```bash
# Email (SMTP) - Already configured
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yoursite.com
FROM_NAME=L3V3L Matrimony

# Backend/Frontend URLs
BACKEND_URL=https://your-backend.run.app
FRONTEND_URL=https://your-frontend.run.app

# MongoDB (Already configured)
MONGODB_URL=mongodb://...
```

**Verify in production:**
```bash
# Backend
echo $BACKEND_URL
echo $FRONTEND_URL
echo $SMTP_HOST

# Frontend .env.production
cat frontend/.env.production | grep REACT_APP_BACKEND_URL
```

---

## 🚀 SECTION 4: DEPLOYMENT STEPS

### Pre-Deployment Checklist

**1. Database Backup**
```bash
# Backup production database BEFORE deployment
mongodump --uri="mongodb://..." --out=/backup/matrimonial_$(date +%Y%m%d)
```

**2. Verify Collections Exist**
```bash
mongosh $MONGODB_URL --eval "
  var collections = db.getCollectionNames();
  print('email_analytics exists:', collections.includes('email_analytics'));
  print('dynamic_jobs exists:', collections.includes('dynamic_jobs'));
  print('notification_queue exists:', collections.includes('notification_queue'));
"
```

**3. Check Current Job Configuration**
```bash
mongosh $MONGODB_URL --eval "
  db.dynamic_jobs.findOne({name: 'Database Cleanup'}, {parameters: 1});
"
```

---

### Deployment Steps

#### Step 1: Deploy Backend Code
```bash
cd /path/to/profiledata

# Pull latest code
git pull origin main

# Deploy backend (GCP example)
cd fastapi_backend
gcloud app deploy --project=your-project-id

# Or Docker
docker build -t your-registry/matrimonial-backend:latest .
docker push your-registry/matrimonial-backend:latest
```

**Files to deploy:**
- ✅ `routers/email_tracking.py`
- ✅ `job_templates/database_cleanup.py`
- ✅ All dependencies (requirements.txt unchanged)

---

#### Step 2: Create Email Analytics Indexes
```bash
mongosh $MONGODB_URL --eval "
  // Create indexes for email analytics
  db.email_analytics.createIndex({ tracking_id: 1, event_type: 1 });
  db.email_analytics.createIndex({ timestamp: -1 });
  db.email_analytics.createIndex({ tracking_id: 1, timestamp: -1 });
  
  print('Indexes created successfully');
  db.email_analytics.getIndexes();
"
```

---

#### Step 3: Update Database Cleanup Job
```bash
mongosh $MONGODB_URL --eval "
  var result = db.dynamic_jobs.updateOne(
    { name: 'Database Cleanup' },
    {
      \$set: {
        description: 'Clean up old logs, activity logs, and job executions',
        parameters: {
          cleanup_targets: [
            { collection: 'logs', days_old: 2, date_field: 'created_at' },
            { collection: 'activity_logs', days_old: 5, date_field: 'timestamp' },
            { collection: 'job_executions', days_old: 3, date_field: 'created_at' }
          ],
          dry_run: false,
          batch_size: 100
        },
        updatedAt: new Date()
      }
    }
  );
  
  print('Matched:', result.matchedCount);
  print('Modified:', result.modifiedCount);
  
  // Verify
  db.dynamic_jobs.findOne({name: 'Database Cleanup'}, {description: 1, parameters: 1});
"
```

---

#### Step 4: Deploy Frontend
```bash
cd frontend

# Build production bundle
npm run build

# Deploy (GCP example)
gcloud app deploy --project=your-project-id

# Or to Cloud Storage + CDN
gsutil -m rsync -r build/ gs://your-bucket/
```

**Files to deploy:**
- ✅ `components/EmailAnalytics.js`
- ✅ All other components (no changes, but full build needed)

---

#### Step 5: Verify Deployment

**Test Email Tracking Endpoints:**
```bash
# Test tracking pixel (should return 1x1 PNG)
curl -I https://your-backend.run.app/api/email-tracking/pixel/test123

# Expected: 200 OK, Content-Type: image/png
```

**Test Email Analytics API:**
```bash
# Get analytics summary (requires admin token)
curl https://your-backend.run.app/api/email-tracking/stats/summary?days=30 \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: JSON with email statistics
```

**Test Email Analytics UI:**
1. Login as admin
2. Navigate to Email Analytics page
3. Should load data without errors
4. Check browser console - no errors

**Test Database Cleanup Job:**
1. Go to Dynamic Scheduler
2. Find "Database Cleanup" job
3. Click Run ▶️
4. Check execution log - should show per-collection breakdown:
   ```
   📁 Processing: logs
   📁 Processing: activity_logs
   📁 Processing: job_executions
   📊 SUMMARY: ...
   ```

---

## 📊 SECTION 5: DATA VERIFICATION

### After Deployment - Verify Data

**1. Check Email Analytics Data**
```bash
mongosh $MONGODB_URL --eval "
  print('Email analytics events:', db.email_analytics.countDocuments({}));
  print('Opens:', db.email_analytics.countDocuments({event_type: 'open'}));
  print('Clicks:', db.email_analytics.countDocuments({event_type: 'click'}));
"
```

**2. Check Database Cleanup Job**
```bash
mongosh $MONGODB_URL --eval "
  var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
  print('Job enabled:', job.enabled);
  print('Next run:', job.nextRunAt);
  print('Targets:', JSON.stringify(job.parameters.cleanup_targets, null, 2));
"
```

**3. Check Job Execution History**
```bash
mongosh $MONGODB_URL --eval "
  db.job_executions.find(
    {jobName: 'Database Cleanup'},
    {status: 1, message: 1, details: 1, createdAt: 1}
  ).sort({createdAt: -1}).limit(1).pretty();
"
```

---

## 🔍 SECTION 6: MONITORING

### What to Monitor After Deployment

**1. Email Analytics**
- Track open rates and click rates in dashboard
- Monitor `email_analytics` collection size
- Check for errors in email tracking endpoints

**2. Database Cleanup**
- Verify job runs every hour
- Check execution logs for clear per-collection breakdown
- Monitor collection sizes (should decrease over time):
  ```bash
  mongosh $MONGODB_URL --eval "
    print('logs:', db.logs.countDocuments({}));
    print('activity_logs:', db.activity_logs.countDocuments({}));
    print('job_executions:', db.job_executions.countDocuments({}));
  "
  ```

**3. Error Logs**
- Check backend logs for email tracking errors
- Monitor job execution failures
- Check frontend console for API errors

---

## ⚠️ SECTION 7: ROLLBACK PLAN

### If Deployment Fails

**1. Revert Backend Code**
```bash
# Deploy previous version
git checkout <previous-commit>
gcloud app deploy --project=your-project-id
```

**2. Revert Database Cleanup Job**
```bash
mongosh $MONGODB_URL --eval "
  db.dynamic_jobs.updateOne(
    { name: 'Database Cleanup' },
    {
      \$set: {
        parameters: {
          collection: 'logs',
          condition_type: 'older_than_days',
          days_old: 2,
          date_field: 'created_at',
          batch_size: 100
        }
      }
    }
  );
"
```

**3. Revert Frontend**
```bash
git checkout <previous-commit>
npm run build
# Deploy old build
```

**4. Restore Database (if needed)**
```bash
mongorestore --uri="mongodb://..." /backup/matrimonial_YYYYMMDD
```

---

## ✅ SECTION 8: POST-DEPLOYMENT TESTING

### Manual Testing Checklist

**Email Analytics:**
- [ ] Login as admin
- [ ] Navigate to Email Analytics page
- [ ] Verify data loads (even if 0)
- [ ] Check browser console for errors
- [ ] Try different time periods (7/30/90 days)
- [ ] Click Refresh button

**Database Cleanup:**
- [ ] Go to Dynamic Scheduler
- [ ] Find "Database Cleanup" job
- [ ] Verify description shows "Clean up old logs, activity logs, and job executions"
- [ ] Click Run button
- [ ] Wait for execution to complete
- [ ] Check execution log shows per-collection breakdown
- [ ] Verify 3 collections processed

**Email Tracking (if applicable):**
- [ ] Send test email with tracking
- [ ] Open email in email client
- [ ] Verify open is tracked in `email_analytics` collection
- [ ] Click link in email
- [ ] Verify click is tracked

---

## 📦 SECTION 9: FILES CHECKLIST

### Files to Deploy

**Backend:**
```
✅ routers/email_tracking.py
✅ job_templates/database_cleanup.py
❌ test_email_analytics.py (dev only - DO NOT deploy)
```

**Frontend:**
```
✅ components/EmailAnalytics.js
✅ Full production build (npm run build)
```

**Documentation (optional):**
```
📄 EMAIL_ANALYTICS_FIX.md
📄 DATABASE_CLEANUP_ENHANCED.md
📄 PRODUCTION_DEPLOYMENT_PLAN.md (this file)
```

---

## 🎯 SECTION 10: SUCCESS CRITERIA

Deployment is successful if:

1. ✅ Backend deploys without errors
2. ✅ Frontend deploys without errors
3. ✅ Email Analytics page loads data
4. ✅ Database Cleanup job runs successfully
5. ✅ Job execution log shows per-collection breakdown
6. ✅ No errors in backend logs
7. ✅ No errors in frontend console
8. ✅ Email tracking endpoints return correct responses
9. ✅ Database indexes exist on `email_analytics`
10. ✅ `dynamic_jobs` collection has updated configuration

---

## 📞 SECTION 11: SUPPORT

### If Issues Occur

**Email Analytics not loading:**
- Check browser console for API errors
- Verify backend URL in `apiConfig.js`
- Check backend logs for errors at `/api/email-tracking/stats/summary`

**Database Cleanup shows old format:**
- Re-run the MongoDB update script (Step 3)
- Verify `cleanup_targets` parameter exists
- Restart backend to reload job template

**Email tracking not working:**
- Check SMTP configuration
- Verify tracking URLs are reachable from email clients
- Check `email_analytics` collection for new documents

---

## 📝 SUMMARY

**Total Changes:**
- 🔧 3 files modified (2 backend, 1 frontend)
- 📊 1 database job configuration updated
- 🗂️ 3 indexes to create on email_analytics
- ⏱️ Estimated deployment time: 30-45 minutes
- 🎯 Risk level: Low to Medium

**No Breaking Changes**
- All changes are backwards compatible
- No API endpoint changes (only bug fixes)
- No database schema changes (only enhancements)
- Existing functionality unaffected

**Ready for Production! 🚀**
