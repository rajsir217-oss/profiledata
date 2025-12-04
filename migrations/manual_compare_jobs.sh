#!/bin/bash
# Simple manual comparison of job definitions
# Shows side-by-side comparison for easy review

set -e

LOCAL_MONGODB=${LOCAL_MONGODB_URL:-"mongodb://localhost:27017/matrimonialDB"}
PROD_MONGODB=${PRODUCTION_MONGODB_URL:-""}

if [ -z "$PROD_MONGODB" ]; then
    echo "❌ PRODUCTION_MONGODB_URL not set!"
    echo "Export your production MongoDB URL:"
    echo "  export PRODUCTION_MONGODB_URL='mongodb://...'"
    exit 1
fi

echo "=========================================="
echo "Manual Job Configuration Comparison"
echo "=========================================="
echo ""

# Get list of jobs from both environments
echo "📋 Jobs in LOCAL:"
LOCAL_JOBS=$(mongosh "$LOCAL_MONGODB" --quiet --eval "db.dynamic_jobs.find({}, {name: 1}).toArray().map(j => j.name).join(', ')")
echo "$LOCAL_JOBS"
echo ""

echo "📋 Jobs in PRODUCTION:"
PROD_JOBS=$(mongosh "$PROD_MONGODB" --quiet --eval "db.dynamic_jobs.find({}, {name: 1}).toArray().map(j => j.name).join(', ')")
echo "$PROD_JOBS"
echo ""

# Compare specific job (Database Cleanup)
JOB_NAME="Database Cleanup"

echo "=========================================="
echo "Detailed Comparison: $JOB_NAME"
echo "=========================================="
echo ""

echo "📝 LOCAL Configuration:"
echo "----------------------------------------"
mongosh "$LOCAL_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    if (job) {
        print('Description:', job.description);
        print('Enabled:', job.enabled);
        print('Schedule:', job.schedule_type, '-', job.interval_seconds || job.schedule?.interval_seconds, 'seconds');
        print('\\nParameters:');
        print(JSON.stringify(job.parameters, null, 2));
    } else {
        print('❌ Job not found in local');
    }
"
echo ""

echo "📝 PRODUCTION Configuration:"
echo "----------------------------------------"
mongosh "$PROD_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    if (job) {
        print('Description:', job.description);
        print('Enabled:', job.enabled);
        print('Schedule:', job.schedule_type, '-', job.interval_seconds || job.schedule?.interval_seconds, 'seconds');
        print('\\nParameters:');
        print(JSON.stringify(job.parameters, null, 2));
    } else {
        print('❌ Job not found in production');
    }
"
echo ""

# Show differences
echo "=========================================="
echo "Quick Comparison"
echo "=========================================="
echo ""

# Count parameters
LOCAL_PARAM_COUNT=$(mongosh "$LOCAL_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    print(job ? Object.keys(job.parameters).length : 0);
")

PROD_PARAM_COUNT=$(mongosh "$PROD_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    print(job ? Object.keys(job.parameters).length : 0);
")

echo "Parameter count:"
echo "  Local: $LOCAL_PARAM_COUNT"
echo "  Prod:  $PROD_PARAM_COUNT"

if [ "$LOCAL_PARAM_COUNT" != "$PROD_PARAM_COUNT" ]; then
    echo "  ⚠️  Different parameter structures!"
fi

echo ""

# Check if cleanup_targets exists
LOCAL_HAS_TARGETS=$(mongosh "$LOCAL_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    print(job && job.parameters.cleanup_targets ? 'YES' : 'NO');
")

PROD_HAS_TARGETS=$(mongosh "$PROD_MONGODB" --quiet --eval "
    var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
    print(job && job.parameters.cleanup_targets ? 'YES' : 'NO');
")

echo "Has 'cleanup_targets' parameter:"
echo "  Local: $LOCAL_HAS_TARGETS"
echo "  Prod:  $PROD_HAS_TARGETS"

if [ "$LOCAL_HAS_TARGETS" = "YES" ] && [ "$PROD_HAS_TARGETS" = "NO" ]; then
    echo "  🔄 NEEDS UPDATE: Prod is using old format!"
    
    # Show target count
    TARGET_COUNT=$(mongosh "$LOCAL_MONGODB" --quiet --eval "
        var job = db.dynamic_jobs.findOne({name: '$JOB_NAME'});
        print(job.parameters.cleanup_targets.length);
    ")
    echo "  📊 Local has $TARGET_COUNT cleanup targets"
fi

echo ""
echo "=========================================="
echo "✅ Comparison Complete"
echo "=========================================="
echo ""
echo "To generate delta migration:"
echo "  ./migrations/compare_and_generate_delta.sh"
echo ""
