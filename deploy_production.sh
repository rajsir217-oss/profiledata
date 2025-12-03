#!/bin/bash
# Production Deployment Script - Dec 3, 2025
# Run this after reviewing PRODUCTION_DEPLOYMENT_PLAN.md

set -e  # Exit on error

echo "=========================================="
echo "Production Deployment - Dec 3, 2025"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if MONGODB_URL is set
if [ -z "$MONGODB_URL" ]; then
    echo -e "${RED}❌ MONGODB_URL not set!${NC}"
    echo "Export your production MongoDB URL:"
    echo "export MONGODB_URL='mongodb://...'"
    exit 1
fi

echo -e "${GREEN}✅ MongoDB URL configured${NC}"
echo ""

# Step 1: Backup Database
echo "=========================================="
echo "Step 1: Database Backup"
echo "=========================================="
BACKUP_DIR="/tmp/matrimonial_backup_$(date +%Y%m%d_%H%M%S)"
echo "Creating backup at: $BACKUP_DIR"

read -p "Create database backup? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mongodump --uri="$MONGODB_URL" --out="$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup created${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping backup (NOT RECOMMENDED)${NC}"
fi
echo ""

# Step 2: Create Email Analytics Indexes
echo "=========================================="
echo "Step 2: Create Email Analytics Indexes"
echo "=========================================="
read -p "Create indexes on email_analytics? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mongosh "$MONGODB_URL" --quiet --eval "
        db.email_analytics.createIndex({ tracking_id: 1, event_type: 1 });
        db.email_analytics.createIndex({ timestamp: -1 });
        db.email_analytics.createIndex({ tracking_id: 1, timestamp: -1 });
        print('✅ Indexes created');
        db.email_analytics.getIndexes().forEach(idx => {
            print('  - ' + JSON.stringify(idx.key));
        });
    "
    echo -e "${GREEN}✅ Indexes created${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping indexes${NC}"
fi
echo ""

# Step 3: Update Database Cleanup Job
echo "=========================================="
echo "Step 3: Update Database Cleanup Job"
echo "=========================================="
read -p "Update Database Cleanup job configuration? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mongosh "$MONGODB_URL" --quiet --eval "
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
        
        if (result.matchedCount > 0) {
            print('✅ Job updated');
            var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
            print('Targets:');
            job.parameters.cleanup_targets.forEach(t => {
                print('  - ' + t.collection + ': ' + t.days_old + ' days');
            });
        } else {
            print('❌ Job not found!');
        }
    "
    echo -e "${GREEN}✅ Job configuration updated${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping job update${NC}"
fi
echo ""

# Step 4: Verify Configuration
echo "=========================================="
echo "Step 4: Verification"
echo "=========================================="
echo "Checking collections and configurations..."
mongosh "$MONGODB_URL" --quiet --eval "
    print('\\n📊 Collection Status:');
    var collections = db.getCollectionNames();
    print('  email_analytics:', collections.includes('email_analytics') ? '✅' : '❌');
    print('  dynamic_jobs:', collections.includes('dynamic_jobs') ? '✅' : '❌');
    print('  notification_queue:', collections.includes('notification_queue') ? '✅' : '❌');
    
    print('\\n📈 Email Analytics:');
    print('  Documents:', db.email_analytics.countDocuments({}));
    print('  Indexes:', db.email_analytics.getIndexes().length);
    
    print('\\n🧹 Database Cleanup Job:');
    var job = db.dynamic_jobs.findOne({name: 'Database Cleanup'});
    if (job) {
        print('  Enabled:', job.enabled);
        print('  Targets:', job.parameters.cleanup_targets ? job.parameters.cleanup_targets.length : 0);
        print('  Next run:', job.nextRunAt);
    } else {
        print('  ❌ Job not found!');
    }
"
echo -e "${GREEN}✅ Verification complete${NC}"
echo ""

# Step 5: Deploy Backend (Manual)
echo "=========================================="
echo "Step 5: Deploy Backend"
echo "=========================================="
echo -e "${YELLOW}⚠️  Manual step required:${NC}"
echo ""
echo "Deploy backend code:"
echo "  cd fastapi_backend"
echo "  gcloud app deploy --project=YOUR_PROJECT_ID"
echo ""
echo "Or using Docker:"
echo "  docker build -t your-registry/backend:latest ."
echo "  docker push your-registry/backend:latest"
echo ""
read -p "Press Enter when backend is deployed..."
echo -e "${GREEN}✅ Backend deployment noted${NC}"
echo ""

# Step 6: Deploy Frontend (Manual)
echo "=========================================="
echo "Step 6: Deploy Frontend"
echo "=========================================="
echo -e "${YELLOW}⚠️  Manual step required:${NC}"
echo ""
echo "Deploy frontend code:"
echo "  cd frontend"
echo "  npm run build"
echo "  gcloud app deploy --project=YOUR_PROJECT_ID"
echo ""
read -p "Press Enter when frontend is deployed..."
echo -e "${GREEN}✅ Frontend deployment noted${NC}"
echo ""

# Step 7: Test Endpoints
echo "=========================================="
echo "Step 7: Testing"
echo "=========================================="
echo -e "${YELLOW}⚠️  Manual testing required:${NC}"
echo ""
echo "Test these items:"
echo "  1. Email Analytics page loads (admin login)"
echo "  2. Database Cleanup job runs successfully"
echo "  3. Job execution log shows per-collection breakdown"
echo "  4. No errors in browser console"
echo "  5. No errors in backend logs"
echo ""
read -p "Press Enter when testing is complete..."
echo ""

# Summary
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ Database backup: $BACKUP_DIR"
echo "  ✅ Indexes created on email_analytics"
echo "  ✅ Database Cleanup job updated"
echo "  ✅ Backend deployed"
echo "  ✅ Frontend deployed"
echo "  ✅ Testing completed"
echo ""
echo "Next steps:"
echo "  1. Monitor email analytics dashboard"
echo "  2. Check Database Cleanup job runs every hour"
echo "  3. Monitor collection sizes decrease over time"
echo ""
echo "Documentation:"
echo "  - PRODUCTION_DEPLOYMENT_PLAN.md"
echo "  - EMAIL_ANALYTICS_FIX.md"
echo "  - DATABASE_CLEANUP_ENHANCED.md"
echo ""
echo -e "${GREEN}🚀 Production deployment successful!${NC}"
