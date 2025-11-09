#!/bin/bash
# Seed all email templates to production database
# Run this from deploy_gcp directory

set -e

echo "=============================================="
echo "🌱 Seed Production Email Templates"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "../fastapi_backend/seed_production_complete.py" ]; then
    echo "❌ Error: Run this from deploy_gcp directory"
    exit 1
fi

# Load production environment - extract only MONGODB_URL
if [ -f "../fastapi_backend/.env.production" ]; then
    echo "📝 Loading production environment..."
    # Extract MONGODB_URL from .env.production (handles quoted values)
    export MONGODB_URL=$(grep "^MONGODB_URL=" ../fastapi_backend/.env.production | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
elif [ -f "../fastapi_backend/.env" ]; then
    echo "📝 Loading .env file..."
    export MONGODB_URL=$(grep "^MONGODB_URL=" ../fastapi_backend/.env | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
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
echo "  Templates: 21 email templates"
echo ""
echo "⚠️  This will seed/update production database!"
echo ""
read -p "Continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Cancelled"
    exit 0
fi

# Step 1: Cleanup duplicates first
echo "🧹 Step 1: Cleaning up duplicate templates..."
echo ""
cd ../fastapi_backend
python3 cleanup_duplicate_templates.py --auto

echo ""
echo "🚀 Step 2: Seeding fresh templates..."
echo ""
python3 seed_production_complete.py --auto

echo ""
echo "✅ Done! Check your production email templates at:"
echo "   https://l3v3lmatches.com/email-templates"
echo ""
