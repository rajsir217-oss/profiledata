#!/bin/bash
# Export ONLY the new Database Cleanup job configuration
# For production deployment

set -e

echo "=========================================="
echo "Export New Job Configuration"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Output file
OUTPUT_DIR="./migrations/data"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/database_cleanup_job_$(date +%Y%m%d).json"

# Check if MongoDB is accessible
if ! command -v mongosh &> /dev/null; then
    echo "❌ mongosh not found! Please install MongoDB shell."
    exit 1
fi

# Export the Database Cleanup job configuration
echo "📤 Exporting Database Cleanup job configuration..."

# Use local MongoDB (development)
MONGODB_URL=${MONGODB_URL:-"mongodb://localhost:27017/matrimonialDB"}

mongosh "$MONGODB_URL" --quiet --eval "
    var job = db.dynamic_jobs.findOne({ name: 'Database Cleanup' });
    if (job) {
        // Remove MongoDB-specific _id for clean export
        delete job._id;
        print(JSON.stringify(job, null, 2));
    } else {
        print('{}');
    }
" > "$OUTPUT_FILE"

if [ -s "$OUTPUT_FILE" ]; then
    echo "✅ Job configuration exported to: $OUTPUT_FILE"
    echo ""
    echo "📋 Exported configuration:"
    cat "$OUTPUT_FILE"
    echo ""
    echo "=========================================="
    echo "✅ Export complete!"
    echo "=========================================="
    echo ""
    echo "To deploy to production:"
    echo "  1. Copy this file to production server"
    echo "  2. Run: mongosh \$PRODUCTION_MONGODB_URL < migrations/migration_20251203_database_cleanup_enhancement.js"
    echo ""
else
    echo "❌ Export failed! Job not found or empty."
    rm -f "$OUTPUT_FILE"
    exit 1
fi
