# Production Deployment Checklist - Dec 3, 2025

## Quick Reference

**Total Changes:** 3 files (2 backend, 1 frontend)  
**Database Changes:** 1 job config update + 3 indexes  
**Risk Level:** Low-Medium  
**Estimated Time:** 30-45 minutes  
**Rollback:** Easy (documented in plan)

---

## 📋 Pre-Deployment

### Preparation
- [ ] Read `PRODUCTION_DEPLOYMENT_PLAN.md` completely
- [ ] Review all changes in files listed below
- [ ] Ensure you have production access credentials
- [ ] Set `MONGODB_URL` environment variable
- [ ] Schedule deployment window (low traffic period)
- [ ] Notify team of deployment

### Backup
- [ ] **CRITICAL:** Backup production database
  ```bash
  mongodump --uri="$MONGODB_URL" --out=/backup/matrimonial_$(date +%Y%m%d)
  ```
- [ ] Verify backup completed successfully
- [ ] Store backup in safe location

---

## 🗂️ Files to Deploy

### Backend Files (2)
- [ ] `fastapi_backend/routers/email_tracking.py` ← Fixed dependency injection
- [ ] `fastapi_backend/job_templates/database_cleanup.py` ← Enhanced multi-collection

### Frontend Files (1)
- [ ] `frontend/src/components/EmailAnalytics.js` ← Fixed API endpoint

### DO NOT Deploy (Dev Tools Only)
- [ ] ❌ `test_email_analytics.py` - Testing only
- [ ] ❌ `*.md` files - Documentation only

---

## 💾 Database Changes

### 1. Create Indexes on `email_analytics`
```bash
mongosh $MONGODB_URL --eval "
  db.email_analytics.createIndex({ tracking_id: 1, event_type: 1 });
  db.email_analytics.createIndex({ timestamp: -1 });
  db.email_analytics.createIndex({ tracking_id: 1, timestamp: -1 });
"
```
- [ ] Indexes created successfully
- [ ] Verify with `db.email_analytics.getIndexes()`

### 2. Update `dynamic_jobs` Collection
```bash
mongosh $MONGODB_URL --eval "
  db.dynamic_jobs.updateOne(
    { name: 'Database Cleanup' },
    { \$set: {
      description: 'Clean up old logs, activity logs, and job executions',
      parameters: {
        cleanup_targets: [
          { collection: 'logs', days_old: 2, date_field: 'created_at' },
          { collection: 'activity_logs', days_old: 5, date_field: 'timestamp' },
          { collection: 'job_executions', days_old: 3, date_field: 'created_at' }
        ],
        dry_run: false,
        batch_size: 100
      }
    }}
  );
"
```
- [ ] Job configuration updated
- [ ] Verify with `db.dynamic_jobs.findOne({name: 'Database Cleanup'})`

### 3. Verify Collections Exist
```bash
mongosh $MONGODB_URL --eval "
  var cols = db.getCollectionNames();
  print('email_analytics:', cols.includes('email_analytics'));
  print('dynamic_jobs:', cols.includes('dynamic_jobs'));
  print('notification_queue:', cols.includes('notification_queue'));
"
```
- [ ] All collections exist

---

## 🚀 Deployment Steps

### Backend Deployment
- [ ] Navigate to backend directory: `cd fastapi_backend`
- [ ] Deploy to production:
  ```bash
  gcloud app deploy --project=YOUR_PROJECT_ID
  # OR
  docker build -t registry/backend:latest .
  docker push registry/backend:latest
  ```
- [ ] Wait for deployment to complete
- [ ] Check backend health endpoint
- [ ] Verify no errors in logs

### Frontend Deployment
- [ ] Navigate to frontend directory: `cd frontend`
- [ ] Build production bundle: `npm run build`
- [ ] Deploy to production:
  ```bash
  gcloud app deploy --project=YOUR_PROJECT_ID
  # OR
  gsutil -m rsync -r build/ gs://your-bucket/
  ```
- [ ] Wait for deployment to complete
- [ ] Clear CDN cache if applicable
- [ ] Verify site loads

---

## ✅ Post-Deployment Testing

### Email Analytics
- [ ] Login as admin user
- [ ] Navigate to Email Analytics page
- [ ] Verify page loads without errors
- [ ] Check browser console - no errors
- [ ] Try different time periods (7/30/90 days)
- [ ] Click Refresh button - works
- [ ] Verify data shows (even if 0)

### Database Cleanup Job
- [ ] Go to Dynamic Scheduler page
- [ ] Find "Database Cleanup" job
- [ ] Verify description: "Clean up old logs, activity logs, and job executions"
- [ ] Click ▶️ Run button
- [ ] Wait for execution to complete
- [ ] Check execution log shows:
  ```
  📁 Processing: logs
  📁 Processing: activity_logs
  📁 Processing: job_executions
  📊 SUMMARY: ...
  ```
- [ ] Verify 3 collections processed
- [ ] Check job execution details show `results_by_collection`

### Email Tracking Endpoints
- [ ] Test tracking pixel:
  ```bash
  curl -I https://backend-url/api/email-tracking/pixel/test123
  ```
  Expected: 200 OK, Content-Type: image/png
- [ ] Test analytics summary:
  ```bash
  curl https://backend-url/api/email-tracking/stats/summary?days=30 \
    -H "Authorization: Bearer ADMIN_TOKEN"
  ```
  Expected: JSON response with email stats

### General Checks
- [ ] No errors in backend logs
- [ ] No errors in frontend console
- [ ] All pages load correctly
- [ ] Dashboard shows correct data
- [ ] Notifications work
- [ ] Job scheduler runs automatically

---

## 📊 Verification Queries

### Check Email Analytics
```bash
mongosh $MONGODB_URL --eval "
  print('Email analytics events:', db.email_analytics.countDocuments({}));
  print('Opens:', db.email_analytics.countDocuments({event_type: 'open'}));
  print('Clicks:', db.email_analytics.countDocuments({event_type: 'click'}));
  print('Indexes:', db.email_analytics.getIndexes().length);
"
```
- [ ] Query runs successfully
- [ ] Indexes exist (should be 4+)

### Check Database Cleanup Job
```bash
mongosh $MONGODB_URL --eval "
  var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
  print('Enabled:', job.enabled);
  print('Targets:', job.parameters.cleanup_targets.length);
  print('Next run:', job.nextRunAt);
  job.parameters.cleanup_targets.forEach(t => {
    print('  -', t.collection + ':', t.days_old, 'days');
  });
"
```
- [ ] Query runs successfully
- [ ] Job enabled: true
- [ ] Targets: 3
- [ ] Shows logs (2d), activity_logs (5d), job_executions (3d)

### Check Job Execution History
```bash
mongosh $MONGODB_URL --eval "
  db.job_executions.find(
    {jobName: 'Database Cleanup'},
    {status: 1, message: 1, details: 1}
  ).sort({createdAt: -1}).limit(1).pretty();
"
```
- [ ] Shows recent execution
- [ ] Status: success
- [ ] details.results_by_collection exists

---

## 🔄 Monitoring (First 24 Hours)

### Hour 1
- [ ] Verify email analytics page loads
- [ ] Check backend logs for errors
- [ ] Monitor response times

### Hour 2-3
- [ ] Database Cleanup job should run (every 1 hour)
- [ ] Check job execution log
- [ ] Verify per-collection breakdown shows
- [ ] Check collection sizes

### Hour 4-6
- [ ] Monitor email analytics data growth
- [ ] Check for any error spikes
- [ ] Verify tracking endpoints working

### Hour 12
- [ ] Review all job executions (should be ~12)
- [ ] Check if old data is being cleaned
- [ ] Monitor database size

### Hour 24
- [ ] Full system health check
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify cleanup is working as expected

---

## 🔙 Rollback (If Needed)

### Backend Rollback
```bash
git checkout <previous-commit>
cd fastapi_backend
gcloud app deploy --project=YOUR_PROJECT_ID
```
- [ ] Previous version deployed
- [ ] Backend health check passes

### Frontend Rollback
```bash
git checkout <previous-commit>
cd frontend
npm run build
gcloud app deploy --project=YOUR_PROJECT_ID
```
- [ ] Previous version deployed
- [ ] Site loads correctly

### Database Rollback
```bash
# Restore Database Cleanup job to old config
mongosh $MONGODB_URL --eval "
  db.dynamic_jobs.updateOne(
    { name: 'Database Cleanup' },
    { \$set: {
      parameters: {
        collection: 'logs',
        condition_type: 'older_than_days',
        days_old: 2,
        date_field: 'created_at'
      }
    }}
  );
"
```
- [ ] Job config reverted
- [ ] Verify old format works

### Full Database Restore (Last Resort)
```bash
mongorestore --uri="$MONGODB_URL" /backup/matrimonial_YYYYMMDD
```
- [ ] Database restored from backup
- [ ] Verify all collections intact

---

## 📞 Troubleshooting

### Email Analytics Not Loading
- Check: Browser console for API errors
- Check: Backend URL in config
- Check: Backend logs at `/api/email-tracking/stats/summary`
- Fix: Hard refresh browser (Cmd+Shift+R)

### Database Cleanup Shows Old Format
- Check: MongoDB job configuration
- Fix: Re-run update script (Step 2 above)
- Fix: Restart backend to reload template

### Email Tracking Not Working
- Check: SMTP configuration
- Check: Tracking URLs reachable
- Check: `email_analytics` collection for new documents
- Fix: Verify indexes exist

---

## ✅ Success Criteria

Deployment is successful when:

- [ ] Backend deployed without errors
- [ ] Frontend deployed without errors
- [ ] Email Analytics page loads data
- [ ] Database Cleanup runs with new format
- [ ] Execution log shows per-collection breakdown
- [ ] No errors in backend logs
- [ ] No errors in frontend console
- [ ] Email tracking endpoints work
- [ ] Database indexes exist
- [ ] Job configuration updated correctly
- [ ] All manual tests pass
- [ ] Monitoring shows normal operation

---

## 📝 Sign-Off

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Backend Version:** _______________  
**Frontend Version:** _______________  
**Database Backup:** _______________  

**Checklist Completed:** [ ]  
**All Tests Passed:** [ ]  
**Monitoring Active:** [ ]  
**Team Notified:** [ ]  

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

## 📚 Related Documents

- `PRODUCTION_DEPLOYMENT_PLAN.md` - Full deployment plan
- `EMAIL_ANALYTICS_FIX.md` - Email analytics changes
- `DATABASE_CLEANUP_ENHANCED.md` - Database cleanup changes
- `deploy_production.sh` - Automated deployment script

---

**Ready to Deploy! 🚀**
