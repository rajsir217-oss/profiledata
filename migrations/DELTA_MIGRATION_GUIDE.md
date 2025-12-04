# Delta Migration Guide

Smart deployment approach: **Compare local vs production** and generate migration scripts for **ONLY the differences**.

## Why Delta Migrations?

✅ **Safety** - Only change what's different  
✅ **Clarity** - See exactly what will change  
✅ **Efficiency** - Skip unchanged data  
✅ **Auditability** - Track what changed when  

---

## Quick Start

### 1. Set Environment Variables
```bash
# Your local dev database
export LOCAL_MONGODB_URL="mongodb://localhost:27017/matrimonialDB"

# Your production database
export PRODUCTION_MONGODB_URL="mongodb://prod-server:27017/matrimonialDB"
```

### 2. Run Comparison and Generate Delta
```bash
./migrations/compare_and_generate_delta.sh
```

### 3. Review Generated Delta Script
```bash
# Check what will change
cat migrations/delta_*/comparison_results.json | jq

# Review migration script
cat migrations/delta_*/delta_migration_*.js
```

### 4. Apply Delta to Production
```bash
mongosh "$PRODUCTION_MONGODB_URL" < migrations/delta_*/delta_migration_*.js
```

---

## What It Does

### Step 1: Export Job Configurations
- Exports all jobs from **local** database
- Exports all jobs from **production** database
- Saves to separate files for comparison

### Step 2: Compare Configurations
Identifies:
- **➕ New jobs** - Exist in local but not in production
- **🔄 Modified jobs** - Different parameters between local and prod
- **➖ Deleted jobs** - Exist in prod but not in local (warning only)
- **✅ Unchanged jobs** - Identical in both environments

### Step 3: Generate Delta Migration
Creates a **targeted migration script** that:
- Inserts new jobs
- Updates modified jobs (with automatic backup)
- Skips unchanged jobs
- Shows clear summary of changes

---

## Example Output

```
==========================================
Job Configuration Delta Generator
==========================================

✅ Local MongoDB: mongodb://localhost:27017/matrimonialDB
✅ Production MongoDB: mongodb://prod-server...

📁 Output directory: ./migrations/delta_20251203_160000

==========================================
Step 1: Exporting Job Definitions
==========================================
📤 Exporting from LOCAL...
  ✅ Found 5 jobs in local
📤 Exporting from PRODUCTION...
  ✅ Found 4 jobs in production

==========================================
Step 2: Comparing Configurations
==========================================
🔍 Analyzing differences...

📊 Comparison Results:
  ➕ New jobs: 1
  🔄 Modified jobs: 1
  ➖ Deleted jobs: 0
  ✅ Unchanged jobs: 3

==========================================
Step 3: Generating Delta Migration Scripts
==========================================
✅ Delta migration script generated

==========================================
Summary
==========================================

📊 Changes Detected:

🔄 MODIFIED JOBS (1):
   - Database Cleanup
     Local params: cleanup_targets, dry_run, batch_size
     Prod params: collection, condition_type, days_old, date_field

✅ UNCHANGED JOBS (3):
   - Email Notifier
   - SMS Notifier
   - System Cleanup

==========================================
✅ Analysis Complete!
==========================================

Files Generated:
  1. local_jobs_raw.txt          - Local job configurations
  2. prod_jobs_raw.txt           - Production job configurations
  3. comparison_results.json     - Detailed comparison
  4. delta_migration_*.js        - Migration script with ONLY differences
```

---

## Generated Delta Migration Script Example

```javascript
/**
 * Delta Migration - Auto-generated
 * Date: 2025-12-03
 * 
 * This script applies only the differences between local and production
 */

// ============================================================
// MODIFIED JOBS
// ============================================================

print("🔄 Updating job: Database Cleanup");
try {
    // Backup current configuration
    var currentJob = db.dynamic_jobs.findOne({ name: "Database Cleanup" });
    if (currentJob) {
        db.migration_history.insertOne({
            migration_id: "delta_2025-12-03",
            job_name: "Database Cleanup",
            backup_data: currentJob,
            applied_at: new Date()
        });
    }

    // Update with new configuration
    var result = db.dynamic_jobs.updateOne(
        { name: "Database Cleanup" },
        { $set: {
            parameters: {
                cleanup_targets: [
                    { collection: "logs", days_old: 2, date_field: "created_at" },
                    { collection: "activity_logs", days_old: 5, date_field: "timestamp" },
                    { collection: "job_executions", days_old: 3, date_field: "created_at" }
                ],
                dry_run: false,
                batch_size: 100
            },
            description: "Clean up old logs, activity logs, and job executions"
        }}
    );
    print("  ✅ Job 'Database Cleanup' updated");
    results.modified_jobs++;
} catch(e) {
    print("  ❌ Error:", e.message);
    results.errors.push("Database Cleanup: " + e.message);
}

// ============================================================
// SUMMARY
// ============================================================

print("\n========================================");
print("📊 Migration Summary:");
print("  🔄 Jobs updated:", results.modified_jobs);
print("  ❌ Errors:", results.errors.length);
print("========================================\n");
```

---

## Manual Comparison Tool

For quick checks without generating migration:

```bash
./migrations/manual_compare_jobs.sh
```

This shows side-by-side comparison of "Database Cleanup" job:
- Local configuration
- Production configuration
- Quick diff summary

---

## Workflow

### For Development
```bash
# 1. Make changes to jobs in local database
# (e.g., update job parameters in Dynamic Scheduler UI)

# 2. Compare with production
./migrations/compare_and_generate_delta.sh

# 3. Review differences
cat migrations/delta_*/comparison_results.json

# 4. If satisfied, commit the delta script
git add migrations/delta_*/
git commit -m "Migration: Update Database Cleanup job"
```

### For Deployment
```bash
# 1. Pull latest code (includes delta script)
git pull

# 2. Set production URL
export PRODUCTION_MONGODB_URL="mongodb://..."

# 3. Apply delta migration
mongosh "$PRODUCTION_MONGODB_URL" < migrations/delta_*/delta_migration_*.js

# 4. Verify
./migrations/manual_compare_jobs.sh
```

---

## Safety Features

### Automatic Backups
Every modified job is backed up to `migration_history` collection:
```javascript
{
  migration_id: "delta_2025-12-03",
  job_name: "Database Cleanup",
  backup_data: { /* original job config */ },
  applied_at: ISODate("2025-12-03T...")
}
```

### Idempotent
- Can run multiple times safely
- Uses `updateOne` (not `insert`)
- Checks existence before operations

### Rollback Support
```bash
# Restore from backup
mongosh "$PRODUCTION_MONGODB_URL" --eval "
  var backup = db.migration_history.findOne({
    job_name: 'Database Cleanup'
  }, {}, { sort: { applied_at: -1 } });
  
  if (backup) {
    db.dynamic_jobs.replaceOne(
      { name: 'Database Cleanup' },
      backup.backup_data
    );
    print('✅ Job restored');
  }
"
```

---

## Comparison Results JSON Structure

```json
{
  "new_jobs": [
    {
      "name": "New Job Name",
      "config": { /* full job config */ }
    }
  ],
  "modified_jobs": [
    {
      "name": "Database Cleanup",
      "local": { /* local config */ },
      "prod": { /* production config */ }
    }
  ],
  "deleted_jobs": [
    {
      "name": "Old Job Name",
      "config": { /* prod config */ }
    }
  ],
  "unchanged_jobs": [
    "Email Notifier",
    "SMS Notifier",
    "System Cleanup"
  ]
}
```

---

## Best Practices

### Before Comparison
1. ✅ Ensure local changes are finalized
2. ✅ Test jobs locally
3. ✅ Document why changes are needed

### During Comparison
1. ✅ Review `comparison_results.json` carefully
2. ✅ Check modified jobs show expected changes
3. ✅ Investigate any unexpected new/deleted jobs

### Before Deployment
1. ✅ Review generated delta script
2. ✅ Test delta script on staging/dev environment
3. ✅ Backup production database
4. ✅ Schedule deployment during low-traffic period

### After Deployment
1. ✅ Verify changes in production
2. ✅ Test jobs run correctly
3. ✅ Monitor execution logs
4. ✅ Keep delta script for audit trail

---

## Troubleshooting

### "No differences found"
- Both environments are in sync ✅
- Or comparison failed to parse configs

### "Job not found in production"
- New job - will be inserted
- Or production database connection issue

### "Modified job shows no changes in params"
- Check other fields (description, schedule, enabled)
- Or comparing identical configurations

### Script fails to generate
- Check Node.js is installed
- Check MongoDB shell is installed
- Check network access to both databases
- Review error messages in output

---

## Files Generated

Each run creates a timestamped directory:
```
migrations/delta_20251203_160000/
├── local_jobs_raw.txt          # Raw export from local
├── prod_jobs_raw.txt           # Raw export from production
├── comparison_results.json     # Detailed comparison
├── delta_migration_20251203.js # Generated migration script
└── compare_jobs.js             # Comparison logic (temporary)
```

---

## Integration with CI/CD

```yaml
# Example GitHub Actions workflow
deploy:
  steps:
    - name: Compare configurations
      run: |
        export PRODUCTION_MONGODB_URL="${{ secrets.PROD_MONGODB }}"
        ./migrations/compare_and_generate_delta.sh
    
    - name: Review differences
      run: cat migrations/delta_*/comparison_results.json
    
    - name: Apply delta migration
      run: mongosh "$PRODUCTION_MONGODB_URL" < migrations/delta_*/delta_migration_*.js
      if: github.ref == 'refs/heads/main'
```

---

## Summary

**Traditional Approach:**
- Export entire database
- Import to production
- Overwrites everything
- Risk of data loss

**Delta Approach:**
- Compare specific collections
- Generate targeted changes
- Apply only differences
- Safe and auditable

**This is the smart way to deploy data changes!** 🎯
