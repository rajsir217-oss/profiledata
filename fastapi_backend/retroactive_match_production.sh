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

# Read MongoDB URL from .env.production
MONGO_URL=$(grep "^MONGODB_URL=" .env.production | cut -d'"' -f2)

if [ -z "$MONGO_URL" ]; then
  echo "❌ MONGODB_URL not found in .env.production!"
  exit 1
fi

# ENCRYPTION_KEY in .env.production is a placeholder (${ENCRYPTION_KEY})
# We need to get it from .env or .env.local which has the actual key
if [ -f ".env" ]; then
  ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" .env | sed 's/^ENCRYPTION_KEY=//')
elif [ -f ".env.local" ]; then
  ENCRYPTION_KEY=$(grep "^ENCRYPTION_KEY=" .env.local | sed 's/^ENCRYPTION_KEY=//')
else
  echo "❌ Cannot find ENCRYPTION_KEY in .env or .env.local!"
  exit 1
fi

if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" = "\${ENCRYPTION_KEY}" ]; then
  echo "❌ ENCRYPTION_KEY not found or is a placeholder!"
  echo "   Make sure .env or .env.local has the actual encryption key."
  exit 1
fi

echo "✅ MongoDB from .env.production, ENCRYPTION_KEY from .env (same key for all envs)"
echo ""

# Extract database name
DB_NAME=$(echo "$MONGO_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
if [ -z "$DB_NAME" ]; then
  DB_NAME="matrimonialDB"
fi

echo "📊 Database: $DB_NAME"
echo "🔗 MongoDB Host: $(echo "$MONGO_URL" | sed -n 's|.*@\([^/]*\).*|\1|p' | cut -d'?' -f1)"
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
export USE_PRODUCTION="true"  # Critical flag to skip .env loading
export MONGODB_URL="$MONGO_URL"
export DATABASE_NAME="$DB_NAME"
export ENCRYPTION_KEY="$ENCRYPTION_KEY"

if [ "$MODE" == "LIVE" ]; then
  python3 retroactive_match_users_to_invitations.py --live
else
  python3 retroactive_match_users_to_invitations.py
fi

echo ""
echo "================================================================================"
echo "✅ RETROACTIVE MATCHING COMPLETE"
echo "================================================================================"
