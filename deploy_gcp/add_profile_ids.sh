#!/bin/bash
# Add profileId to existing users in production
# Run this from deploy_gcp directory

set -e

echo "=============================================="
echo "🔧 Add ProfileIDs to Existing Users"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "../fastapi_backend/migrations/scripts/003_add_profile_ids.py" ]; then
    echo "❌ Error: Run this from deploy_gcp directory"
    exit 1
fi

# Load production environment
if [ -f "../fastapi_backend/.env.production" ]; then
    echo "📝 Loading production environment..."
    export $(grep -v '^#' ../fastapi_backend/.env.production | xargs)
elif [ -f "../fastapi_backend/.env" ]; then
    echo "📝 Loading .env file..."
    export $(grep -v '^#' ../fastapi_backend/.env | xargs)
else
    echo "⚠️  Warning: No .env file found"
    echo "   MONGODB_URL must be set manually"
fi

# Check if MONGODB_URL is set
if [ -z "$MONGODB_URL" ]; then
    echo ""
    echo "❌ MONGODB_URL is not set!"
    echo ""
    echo "Please set it manually:"
    echo "  export MONGODB_URL='your-production-mongodb-url'"
    echo ""
    exit 1
fi

# Show what we're about to do
echo ""
echo "Configuration:"
echo "  MongoDB: ${MONGODB_URL:0:50}..."
echo "  Migration: 003_add_profile_ids"
echo ""
echo "⚠️  This will generate unique profileIDs for users who don't have one!"
echo ""
read -p "Continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Run the migration script
echo "🚀 Running migration..."
echo ""
cd ../fastapi_backend/migrations/scripts
python3 003_add_profile_ids.py

echo ""
echo "✅ Done! Check your production profiles - they should now show Profile IDs"
echo ""
