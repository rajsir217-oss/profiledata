#!/bin/bash

# ============================================
# Production Migration: Set Daily Digest as Default
# ============================================
# This script runs the digest migration against the PRODUCTION MongoDB
# 
# Usage:
#   ./migrate_digest_production.sh           # Run migration
#   ./migrate_digest_production.sh --dry-run # Preview changes only
#
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🔄 Production Migration: Daily Digest Default${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/fastapi_backend"

# GCP Configuration
PROJECT_ID="matrimonial-staging"
REGION="us-central1"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Backend Dir: $BACKEND_DIR"
echo ""

# Check if --dry-run flag is passed
DRY_RUN=""
if [ "$1" == "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Fetch MongoDB URL from GCP Secret Manager
echo -e "${BLUE}🔐 Fetching MongoDB URL from GCP Secret Manager...${NC}"
MONGODB_URL=$(gcloud secrets versions access latest --secret="MONGODB_URL" --project="$PROJECT_ID" 2>/dev/null)

if [ -z "$MONGODB_URL" ]; then
    echo -e "${RED}❌ Failed to fetch MONGODB_URL from Secret Manager${NC}"
    echo "   Make sure you have access to the secret and gcloud is configured."
    exit 1
fi

echo -e "${GREEN}✅ MongoDB URL retrieved successfully${NC}"
echo ""

# Set environment variables for the migration script
export MONGODB_URL="$MONGODB_URL"
export DATABASE_NAME="matrimonialDB"
export ENV="production"

# Change to backend directory
cd "$BACKEND_DIR"

echo -e "${BLUE}🚀 Running migration script...${NC}"
echo ""

# Run the migration
if [ -n "$DRY_RUN" ]; then
    python -m migrations.migrate_digest_default --dry-run
else
    # For actual migration, auto-confirm
    echo "yes" | python -m migrations.migrate_digest_default
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Migration Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}📝 What was changed:${NC}"
echo "   - All existing notification preferences updated"
echo "   - digestSettings.enabled = True"
echo "   - All batch options (favorites, shortlists, PII, etc.) = True"
echo "   - Only SUSPICIOUS_LOGIN alerts remain instant"
echo ""
echo -e "${YELLOW}📌 Next Steps:${NC}"
echo "   1. Deploy backend with updated code: ./deploy_backend_simple.sh"
echo "   2. New users will automatically get digest defaults"
echo "   3. Users can still opt-out in their notification preferences"
echo ""
