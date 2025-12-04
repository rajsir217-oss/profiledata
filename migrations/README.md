# Database Migrations

This directory contains database migrations for incremental changes to production data.

## December 3, 2025 - Database Cleanup Enhancement

### What Changed
- Enhanced "Database Cleanup" job to support multiple collections
- Created indexes on `email_analytics` collection

### Files

1. **`migration_20251203_database_cleanup_enhancement.js`**
   - Main migration script
   - Creates indexes
   - Updates job configuration
   - Idempotent (safe to run multiple times)

2. **`export_new_job_config.sh`**
   - Exports current job configuration from development
   - Creates JSON file for reference

## How to Use

### Development/Testing

Test the migration on dev database:
```bash
mongosh mongodb://localhost:27017/matrimonialDB < migrations/migration_20251203_database_cleanup_enhancement.js
```

### Production Deployment

**Step 1: Backup Production Database**
```bash
mongodump --uri="$PRODUCTION_MONGODB_URL" --out=/backup/matrimonial_$(date +%Y%m%d)
```

**Step 2: Run Migration on Production**
```bash
mongosh "$PRODUCTION_MONGODB_URL" < migrations/migration_20251203_database_cleanup_enhancement.js
```

**Step 3: Verify**
```bash
mongosh "$PRODUCTION_MONGODB_URL" --eval "
  // Check job
  var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
  print('Job targets:', job.parameters.cleanup_targets.length);
  
  // Check indexes
  print('Indexes:', db.email_analytics.getIndexes().length);
"
```

## What This Migration Does

### 1. Creates Indexes on `email_analytics`
```javascript
{ tracking_id: 1, event_type: 1 }
{ timestamp: -1 }
{ tracking_id: 1, timestamp: -1 }
```

### 2. Updates `dynamic_jobs` Collection

**Before:**
```json
{
  "name": "Database Cleanup",
  "parameters": {
    "collection": "logs",
    "days_old": 2
  }
}
```

**After:**
```json
{
  "name": "Database Cleanup",
  "description": "Clean up old logs, activity logs, and job executions",
  "parameters": {
    "cleanup_targets": [
      { "collection": "logs", "days_old": 2, "date_field": "created_at" },
      { "collection": "activity_logs", "days_old": 5, "date_field": "timestamp" },
      { "collection": "job_executions", "days_old": 3, "date_field": "created_at" }
    ],
    "dry_run": false,
    "batch_size": 100
  }
}
```

## Rollback

If you need to rollback:

```bash
mongosh "$PRODUCTION_MONGODB_URL" --eval "
  // Find backup
  var backup = db.migration_history.findOne({
    migration_id: '20251203_database_cleanup_enhancement'
  });
  
  // Restore job
  if (backup && backup.backup_data) {
    db.dynamic_jobs.replaceOne(
      { name: 'Database Cleanup' },
      backup.backup_data
    );
    print('✅ Job restored to previous configuration');
  }
"
```

## Safety Features

- **Idempotent**: Can be run multiple times safely
- **Automatic Backup**: Saves old config to `migration_history` collection
- **Error Handling**: Checks if indexes already exist
- **Verification**: Shows before/after configuration

## Integration with Deployment Scripts

Your existing deployment scripts can run this migration:

```bash
# In your deploy script
echo "Running database migrations..."
mongosh "$PRODUCTION_MONGODB_URL" < migrations/migration_20251203_database_cleanup_enhancement.js
```

## Migration History

All migrations are logged in the `migration_history` collection:

```javascript
{
  migration_id: "20251203_database_cleanup_enhancement",
  applied_at: ISODate("2025-12-03T..."),
  backup_type: "dynamic_jobs",
  backup_data: { /* original job config */ }
}
```

## Notes

- ✅ This migration does NOT export/import entire collections
- ✅ Only modifies specific documents (1 job config)
- ✅ Only creates new indexes (non-destructive)
- ✅ Does NOT delete or modify existing data
- ✅ Safe to run on production with active users

## Questions?

See `PRODUCTION_DEPLOYMENT_PLAN.md` in the root directory for complete deployment instructions.
