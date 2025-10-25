#!/bin/bash
# MongoDB Migration Script - Local to Cloud
# Exports local MongoDB and imports to remote MongoDB (Atlas or any remote MongoDB)

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║   MongoDB Migration: Local → Cloud                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
LOCAL_DB="matrimonialDB"
LOCAL_HOST="localhost:27017"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="mongodb_backup_${TIMESTAMP}"

# Step 1: Check if MongoDB is running locally
echo -e "${YELLOW}Step 1: Checking local MongoDB${NC}"
echo "======================================"
if ! mongosh --eval "db.version()" --quiet > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to local MongoDB${NC}"
    echo "Please start MongoDB first:"
    echo "  brew services start mongodb-community"
    exit 1
fi
echo -e "${GREEN}✅ Local MongoDB is running${NC}"

# Step 2: Show current database statistics
echo ""
echo -e "${YELLOW}Step 2: Local Database Statistics${NC}"
echo "======================================"
mongosh --quiet --eval "
    use ${LOCAL_DB};
    print('Database: ${LOCAL_DB}');
    print('Collections:');
    db.getCollectionNames().forEach(function(collection) {
        var count = db.getCollection(collection).countDocuments();
        var size = db.getCollection(collection).stats().size;
        print('  - ' + collection + ': ' + count + ' documents (' + (size/1024).toFixed(2) + ' KB)');
    });
    print('');
    print('Total Size: ' + (db.stats().dataSize / 1024 / 1024).toFixed(2) + ' MB');
"

# Step 3: Ask for remote MongoDB URL
echo ""
echo -e "${YELLOW}Step 3: Remote MongoDB Configuration${NC}"
echo "======================================"
echo ""
echo "Choose your remote MongoDB option:"
echo ""
echo "1. MongoDB Atlas (Recommended - FREE 512MB)"
echo "   URL format: mongodb+srv://username:password@cluster.mongodb.net/"
echo ""
echo "2. Custom MongoDB Server"
echo "   URL format: mongodb://username:password@host:port/"
echo ""
echo "3. Google Cloud MongoDB (if you set it up)"
echo "   URL format: mongodb://username:password@ip:27017/"
echo ""

read -p "Enter remote MongoDB connection URL: " REMOTE_URL

if [ -z "$REMOTE_URL" ]; then
    echo -e "${RED}❌ No URL provided${NC}"
    exit 1
fi

# Validate connection
echo ""
echo "Testing remote connection..."
if ! mongosh "$REMOTE_URL" --eval "db.version()" --quiet > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to remote MongoDB${NC}"
    echo "Please check:"
    echo "  - Username and password are correct"
    echo "  - IP whitelist is configured (0.0.0.0/0 for testing)"
    echo "  - Network access is allowed"
    exit 1
fi
echo -e "${GREEN}✅ Remote MongoDB connection successful${NC}"

# Step 4: Export local database
echo ""
echo -e "${YELLOW}Step 4: Exporting Local Database${NC}"
echo "======================================"
echo "Creating backup in: $BACKUP_DIR"

mongodump \
    --host "$LOCAL_HOST" \
    --db "$LOCAL_DB" \
    --out "$BACKUP_DIR"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Export failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Local database exported${NC}"

# Show what was exported
echo ""
echo "📦 Exported Collections:"
ls -lh "$BACKUP_DIR/$LOCAL_DB/"

# Step 5: Confirm before importing
echo ""
echo -e "${YELLOW}Step 5: Ready to Import${NC}"
echo "======================================"
echo ""
echo -e "${BLUE}⚠️  IMPORTANT:${NC}"
echo "  This will import data to the remote database."
echo "  If collections already exist, you can choose to:"
echo "    - Merge (add new documents, keep existing)"
echo "    - Drop & Replace (delete existing, import fresh)"
echo ""

read -p "Import mode (merge/replace): " IMPORT_MODE

if [ "$IMPORT_MODE" != "merge" ] && [ "$IMPORT_MODE" != "replace" ]; then
    echo -e "${RED}❌ Invalid mode. Use 'merge' or 'replace'${NC}"
    exit 1
fi

# Step 6: Import to remote database
echo ""
echo -e "${YELLOW}Step 6: Importing to Remote Database${NC}"
echo "======================================"
echo "Mode: $IMPORT_MODE"
echo ""

if [ "$IMPORT_MODE" = "replace" ]; then
    echo "⚠️  This will DROP existing collections!"
    read -p "Are you sure? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Import cancelled"
        rm -rf "$BACKUP_DIR"
        exit 0
    fi
    DROP_FLAG="--drop"
else
    DROP_FLAG=""
fi

mongorestore \
    --uri="$REMOTE_URL" \
    --db "$LOCAL_DB" \
    $DROP_FLAG \
    "$BACKUP_DIR/$LOCAL_DB/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Import failed${NC}"
    echo "Backup is still available in: $BACKUP_DIR"
    exit 1
fi

echo -e "${GREEN}✅ Data imported successfully${NC}"

# Step 7: Verify import
echo ""
echo -e "${YELLOW}Step 7: Verifying Import${NC}"
echo "======================================"

mongosh "$REMOTE_URL" --quiet --eval "
    use ${LOCAL_DB};
    print('Remote Database: ${LOCAL_DB}');
    print('Collections:');
    db.getCollectionNames().forEach(function(collection) {
        var count = db.getCollection(collection).countDocuments();
        print('  - ' + collection + ': ' + count + ' documents');
    });
"

# Step 8: Cleanup
echo ""
echo -e "${YELLOW}Step 8: Cleanup${NC}"
echo "======================================"

read -p "Keep local backup? (y/n): " KEEP_BACKUP

if [ "$KEEP_BACKUP" = "y" ]; then
    # Compress backup
    tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"
    rm -rf "$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup compressed: ${BACKUP_DIR}.tar.gz${NC}"
    echo "   Size: $(du -sh ${BACKUP_DIR}.tar.gz | cut -f1)"
else
    rm -rf "$BACKUP_DIR"
    echo -e "${GREEN}✅ Temporary backup deleted${NC}"
fi

# Step 9: Summary
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║           🎉 MIGRATION SUCCESSFUL! 🎉                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Migration Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "📁 Database:     ${GREEN}${LOCAL_DB}${NC}"
echo -e "🔄 Mode:         ${GREEN}${IMPORT_MODE}${NC}"
echo -e "📍 Source:       ${GREEN}Local MongoDB${NC}"
echo -e "🌐 Destination:  ${GREEN}Remote MongoDB${NC}"
echo -e "⏱️  Time:         ${GREEN}$(date)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update your backend environment variables:"
echo "   MONGODB_URL=$REMOTE_URL"
echo ""
echo "2. For GitHub deployment, add secret:"
echo "   Go to: Settings → Secrets → Actions"
echo "   Name: MONGODB_URL"
echo "   Value: $REMOTE_URL"
echo ""
echo "3. Test the connection from your backend:"
echo "   cd fastapi_backend"
echo "   MONGODB_URL='$REMOTE_URL' python -c 'from database import get_database; import asyncio; asyncio.run(get_database())'"
echo ""
echo -e "${GREEN}✅ Your data is now in the cloud!${NC}"
