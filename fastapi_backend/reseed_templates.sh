#!/bin/bash
# Reseed Email Templates with Environment Auto-Detection
# This script automatically uses the correct environment (.env.local or .env.production)

set -e

echo "📧 Email Template Reseeding Script"
echo "=================================="
echo ""

# Detect environment
if [ -n "$K_SERVICE" ]; then
    ENV="production"
    echo "🌍 Environment: PRODUCTION (Google Cloud Run)"
elif [ -n "$APP_ENVIRONMENT" ]; then
    ENV="$APP_ENVIRONMENT"
    echo "🌍 Environment: $ENV (from APP_ENVIRONMENT)"
else
    ENV="local"
    echo "🌍 Environment: LOCAL (development)"
fi

echo ""
echo "📝 This will update email templates with URLs from .env.$ENV"
echo ""

# Confirm if running in production
if [ "$ENV" = "production" ]; then
    echo "⚠️  WARNING: You are about to update PRODUCTION templates!"
    read -p "   Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Aborted."
        exit 1
    fi
fi

echo ""
echo "🚀 Running template seeder..."
echo ""

# Run the seed script (it will auto-detect environment)
python3 seed_status_change_templates.py

echo ""
echo "✅ Done! Templates have been updated."
echo ""

# Show what URL was used
if [ -f ".env.$ENV" ]; then
    APP_URL=$(grep "^APP_URL=" ".env.$ENV" | cut -d'=' -f2 | tr -d '"')
    echo "📍 Templates now use: $APP_URL"
else
    echo "ℹ️  Using default .env file"
fi

echo ""
