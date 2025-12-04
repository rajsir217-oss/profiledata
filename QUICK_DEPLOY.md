# Quick Production Deployment Guide

## TL;DR - What You Need

### 1. Code Deployment (Use Your Existing Scripts)
```bash
# Deploy backend (your existing script)
./deploy-backend.sh

# Deploy frontend (your existing script)  
./deploy-frontend.sh
```

### 2. Data Migration (NEW - Run This)
```bash
# Run the migration on production database
mongosh "$PRODUCTION_MONGODB_URL" < migrations/migration_20251203_database_cleanup_enhancement.js
```

That's it! ✅

---

## What the Migration Does

**Changes ONLY:**
- ✅ Creates 3 indexes on `email_analytics` collection
- ✅ Updates 1 document in `dynamic_jobs` collection (Database Cleanup job)

**Does NOT:**
- ❌ Export/import entire database
- ❌ Modify existing user data
- ❌ Delete anything
- ❌ Require downtime

---

## Files Changed (For Your Deployment Scripts)

### Backend Files (3)
```
fastapi_backend/routers/email_tracking.py
fastapi_backend/job_templates/database_cleanup.py
```

### Frontend Files (1)
```
frontend/src/components/EmailAnalytics.js
```

---

## Pre-Deployment

### 1. Backup Database (REQUIRED)
```bash
mongodump --uri="$PRODUCTION_MONGODB_URL" --out=/backup/matrimonial_$(date +%Y%m%d)
```

### 2. Test Migration Locally (Optional but Recommended)
```bash
# Test on dev database first
mongosh mongodb://localhost:27017/matrimonialDB < migrations/migration_20251203_database_cleanup_enhancement.js
```

---

## Deployment Order

```
1. Backup database          ← CRITICAL!
2. Run data migration       ← New step (2 minutes)
3. Deploy backend code      ← Your existing script
4. Deploy frontend code     ← Your existing script
5. Verify                   ← 5 minutes
```

---

## The Migration Command

**Single command to apply all database changes:**

```bash
mongosh "$PRODUCTION_MONGODB_URL" < migrations/migration_20251203_database_cleanup_enhancement.js
```

**What it outputs:**
```
========================================
Migration: Database Cleanup Enhancement
========================================

📊 Step 1: Creating indexes on email_analytics...
  ✅ Index created: { tracking_id: 1, event_type: 1 }
  ✅ Index created: { timestamp: -1 }
  ✅ Index created: { tracking_id: 1, timestamp: -1 }

🔄 Step 2: Backing up existing job configuration...
  ✅ Backup saved to migration_history collection

🧹 Step 3: Updating Database Cleanup job configuration...
  ✅ Job configuration updated
  📝 Matched: 1
  📝 Modified: 1
  
  📋 New config:
     Description: Clean up old logs, activity logs, and job executions
     Targets:
       - logs: 2 days (field: created_at)
       - activity_logs: 5 days (field: timestamp)
       - job_executions: 3 days (field: created_at)

✅ Step 4: Verification...
  📊 email_analytics indexes: 4
  🧹 Database Cleanup job: ✅ Updated
     Cleanup targets: 3

========================================
✅ Migration completed successfully!
========================================
```

---

## Verification After Deployment

```bash
# Quick check - should show 3 targets
mongosh "$PRODUCTION_MONGODB_URL" --eval "
  var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
  print('Targets:', job.parameters.cleanup_targets.length);
  job.parameters.cleanup_targets.forEach(t => {
    print(' -', t.collection + ':', t.days_old, 'days');
  });
"
```

**Expected output:**
```
Targets: 3
 - logs: 2 days
 - activity_logs: 5 days
 - job_executions: 3 days
```

---

## Rollback (If Needed)

```bash
# Restore database from backup
mongorestore --uri="$PRODUCTION_MONGODB_URL" /backup/matrimonial_YYYYMMDD

# Or restore just the job config
mongosh "$PRODUCTION_MONGODB_URL" --eval "
  var backup = db.migration_history.findOne({
    migration_id: '20251203_database_cleanup_enhancement'
  });
  db.dynamic_jobs.replaceOne(
    { name: 'Database Cleanup' },
    backup.backup_data
  );
"
```

---

## Integration with Your Deployment Scripts

Add this to your deployment script:

```bash
#!/bin/bash
# Your existing deploy script

# ... your code ...

# NEW: Run database migration
echo "Running database migration..."
mongosh "$PRODUCTION_MONGODB_URL" < migrations/migration_20251203_database_cleanup_enhancement.js

# ... rest of your code ...
```

---

## Safety Features

✅ **Idempotent** - Can run multiple times safely  
✅ **Auto-backup** - Saves old config before changing  
✅ **Verification** - Shows before/after state  
✅ **Error handling** - Checks if indexes exist  
✅ **Rollback support** - Easy to revert  

---

## Files Location

```
migrations/
├── README.md                                          ← Full docs
├── migration_20251203_database_cleanup_enhancement.js ← The migration
└── export_new_job_config.sh                          ← Export tool (optional)
```

---

## Questions?

- See `migrations/README.md` for detailed migration docs
- See `PRODUCTION_DEPLOYMENT_PLAN.md` for complete deployment guide
- See `DEPLOYMENT_CHECKLIST.md` for step-by-step checklist

---

**Ready to deploy! Just add the migration command to your existing deployment workflow.** 🚀
