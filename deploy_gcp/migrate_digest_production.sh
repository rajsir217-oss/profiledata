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
ENV_PRODUCTION="$BACKEND_DIR/.env.production"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Backend Dir: $BACKEND_DIR"
echo "   Env File: $ENV_PRODUCTION"
echo ""

# Check if --dry-run flag is passed
DRY_RUN=""
if [ "$1" == "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Check if .env.production exists
if [ ! -f "$ENV_PRODUCTION" ]; then
    echo -e "${RED}❌ .env.production not found at $ENV_PRODUCTION${NC}"
    exit 1
fi

# Extract MongoDB URL from .env.production
echo -e "${BLUE}🔐 Reading MongoDB URL from .env.production...${NC}"
MONGODB_URL=$(grep "^MONGODB_URL=" "$ENV_PRODUCTION" | cut -d'=' -f2- | tr -d '"')

if [ -z "$MONGODB_URL" ]; then
    echo -e "${RED}❌ Failed to extract MONGODB_URL from .env.production${NC}"
    exit 1
fi

# Show partial URL for confirmation (hide password)
MONGODB_URL_DISPLAY=$(echo "$MONGODB_URL" | sed 's/:.*@/:***@/')
echo -e "${GREEN}✅ MongoDB URL: ${MONGODB_URL_DISPLAY}${NC}"
echo ""

# Set environment variables for the migration script
export MONGODB_URL="$MONGODB_URL"
export DATABASE_NAME="matrimonialDB"
export ENV="production"

# Change to backend directory
cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo -e "${BLUE}🐍 Activating virtual environment...${NC}"
    source venv/bin/activate
fi

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
