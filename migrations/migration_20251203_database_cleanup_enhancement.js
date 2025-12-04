/**
 * Migration: Database Cleanup Job Enhancement
 * Date: December 3, 2025
 * 
 * Changes:
 * 1. Update "Database Cleanup" job to support multiple collections
 * 2. Create indexes on email_analytics collection
 * 
 * This migration is IDEMPOTENT - safe to run multiple times
 */

// ============================================================
// MIGRATION UP - Apply Changes
// ============================================================

print("\n========================================");
print("Migration: Database Cleanup Enhancement");
print("Date: 2025-12-03");
print("========================================\n");

// Use the database
db = db.getSiblingDB('matrimonialDB');

// Step 1: Create indexes on email_analytics
print("📊 Step 1: Creating indexes on email_analytics...");
try {
    db.email_analytics.createIndex({ tracking_id: 1, event_type: 1 });
    print("  ✅ Index created: { tracking_id: 1, event_type: 1 }");
} catch (e) {
    if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
        print("  ℹ️  Index already exists: { tracking_id: 1, event_type: 1 }");
    } else {
        print("  ❌ Error creating index:", e.message);
    }
}

try {
    db.email_analytics.createIndex({ timestamp: -1 });
    print("  ✅ Index created: { timestamp: -1 }");
} catch (e) {
    if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
        print("  ℹ️  Index already exists: { timestamp: -1 }");
    } else {
        print("  ❌ Error creating index:", e.message);
    }
}

try {
    db.email_analytics.createIndex({ tracking_id: 1, timestamp: -1 });
    print("  ✅ Index created: { tracking_id: 1, timestamp: -1 }");
} catch (e) {
    if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
        print("  ℹ️  Index already exists: { tracking_id: 1, timestamp: -1 }");
    } else {
        print("  ❌ Error creating index:", e.message);
    }
}

// Step 2: Backup existing job configuration
print("\n🔄 Step 2: Backing up existing job configuration...");
var existingJob = db.dynamic_jobs.findOne({ name: "Database Cleanup" });

if (existingJob) {
    // Save backup to migration_history collection
    db.migration_history.insertOne({
        migration_id: "20251203_database_cleanup_enhancement",
        applied_at: new Date(),
        backup_type: "dynamic_jobs",
        backup_data: existingJob
    });
    print("  ✅ Backup saved to migration_history collection");
    print("  📋 Old config:", JSON.stringify(existingJob.parameters, null, 2));
} else {
    print("  ⚠️  Job 'Database Cleanup' not found!");
    print("  This migration may create a new job if needed.");
}

// Step 3: Update Database Cleanup job configuration
print("\n🧹 Step 3: Updating Database Cleanup job configuration...");

var newParameters = {
    cleanup_targets: [
        {
            collection: "logs",
            days_old: 2,
            date_field: "created_at"
        },
        {
            collection: "activity_logs",
            days_old: 5,
            date_field: "timestamp"
        },
        {
            collection: "job_executions",
            days_old: 3,
            date_field: "created_at"
        }
    ],
    dry_run: false,
    batch_size: 100
};

var updateResult = db.dynamic_jobs.updateOne(
    { name: "Database Cleanup" },
    {
        $set: {
            description: "Clean up old logs, activity logs, and job executions",
            parameters: newParameters,
            updatedAt: new Date()
        }
    }
);

if (updateResult.matchedCount > 0) {
    print("  ✅ Job configuration updated");
    print("  📝 Matched:", updateResult.matchedCount);
    print("  📝 Modified:", updateResult.modifiedCount);
    
    // Display new configuration
    var updatedJob = db.dynamic_jobs.findOne({ name: "Database Cleanup" });
    print("\n  📋 New config:");
    print("     Description:", updatedJob.description);
    print("     Targets:");
    updatedJob.parameters.cleanup_targets.forEach(function(target) {
        print("       -", target.collection + ":", target.days_old, "days (field:", target.date_field + ")");
    });
} else {
    print("  ❌ Job 'Database Cleanup' not found!");
    print("  Creating new job configuration...");
    
    // Create new job if it doesn't exist
    db.dynamic_jobs.insertOne({
        name: "Database Cleanup",
        description: "Clean up old logs, activity logs, and job executions",
        template_type: "database_cleanup",
        schedule_type: "interval",
        interval_seconds: 3600,
        enabled: true,
        parameters: newParameters,
        createdAt: new Date(),
        updatedAt: new Date(),
        nextRun: new Date(),
        notifications: { on_success: [], on_failure: [] },
        retry_policy: { max_retries: 3, retry_delay_seconds: 300 }
    });
    print("  ✅ New job created");
}

// Step 4: Verification
print("\n✅ Step 4: Verification...");

// Verify indexes
var indexes = db.email_analytics.getIndexes();
print("  📊 email_analytics indexes:", indexes.length);

// Verify job
var finalJob = db.dynamic_jobs.findOne({ name: "Database Cleanup" });
if (finalJob && finalJob.parameters.cleanup_targets) {
    print("  🧹 Database Cleanup job: ✅ Updated");
    print("     Cleanup targets:", finalJob.parameters.cleanup_targets.length);
} else {
    print("  🧹 Database Cleanup job: ❌ Not properly configured");
}

print("\n========================================");
print("✅ Migration completed successfully!");
print("========================================\n");

// ============================================================
// MIGRATION DOWN - Rollback Changes
// ============================================================

/**
 * To rollback this migration, run:
 * 
 * db = db.getSiblingDB('matrimonialDB');
 * 
 * // 1. Find backup
 * var backup = db.migration_history.findOne({
 *     migration_id: "20251203_database_cleanup_enhancement"
 * });
 * 
 * // 2. Restore job configuration
 * if (backup && backup.backup_data) {
 *     db.dynamic_jobs.replaceOne(
 *         { name: "Database Cleanup" },
 *         backup.backup_data
 *     );
 *     print("✅ Job configuration restored");
 * }
 * 
 * // 3. Drop indexes (optional - usually safe to keep)
 * // db.email_analytics.dropIndex({ tracking_id: 1, event_type: 1 });
 * // db.email_analytics.dropIndex({ timestamp: -1 });
 * // db.email_analytics.dropIndex({ tracking_id: 1, timestamp: -1 });
 */
