#!/bin/bash
# Retroactively Match Existing Users to Invitations - PRODUCTION VERSION
# Reads configuration from .env.production

echo "================================================================================"
echo "🔄 RETROACTIVE MATCHING: Users → Invitations (PRODUCTION)"
echo "================================================================================"
echo ""

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
  echo "❌ .env.production file not found!"
  exit 1
fi

# Read configuration from .env.production
MONGO_URL=$(grep "^MONGODB_URL=" .env.production | cut -d'"' -f2)
ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" .env.production | cut -d'"' -f2)

if [ -z "$MONGO_URL" ]; then
  echo "❌ MONGODB_URL not found in .env.production!"
  exit 1
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "❌ ENCRYPTION_KEY not found in .env.production!"
  exit 1
fi

echo "✅ Using configuration from .env.production"
echo ""

# Extract database name
DB_NAME=$(echo "$MONGO_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
if [ -z "$DB_NAME" ]; then
  DB_NAME="matrimonialDB"
fi

echo "📊 Database: $DB_NAME"
echo ""

# Check if live mode
MODE="DRY RUN"
if [ "$1" == "--live" ]; then
  MODE="LIVE"
  echo "⚠️  WARNING: LIVE MODE - Will update production database"
  echo ""
  read -p "Type 'YES' to confirm: " CONFIRM
  
  if [ "$CONFIRM" != "YES" ]; then
    echo "❌ Cancelled"
    exit 1
  fi
  echo ""
else
  echo "🔍 DRY RUN MODE - No changes will be made"
  echo ""
fi

# Set environment variables and run script
export MONGODB_URL="$MONGO_URL"
export DATABASE_NAME="$DB_NAME"
export ENCRYPTION_KEY="$ENCRYPTION_KEY"
export ENV="production"
export SKIP_ENV_FILES="true"  # Skip loading .env files

if [ "$MODE" == "LIVE" ]; then
  python3 retroactive_match_users_to_invitations.py --live
else
  python3 retroactive_match_users_to_invitations.py
fi

echo ""
echo "================================================================================"
echo "✅ RETROACTIVE MATCHING COMPLETE"
echo "================================================================================"
