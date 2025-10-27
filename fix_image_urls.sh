#!/bin/bash

# Fix Image URLs in Production
# This script updates the backend URL environment variable

set -e

echo "🔧 Fixing Image URLs in Production"
echo "===================================="
echo ""

# Get backend URL
BACKEND_URL=$(gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format 'value(status.url)' 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Backend service not found"
    echo "Please deploy your backend first"
    exit 1
fi

echo "✅ Found backend URL: $BACKEND_URL"
echo ""

# Update environment variable
echo "📝 Updating BACKEND_URL environment variable..."
gcloud run services update matrimonial-backend \
  --region us-central1 \
  --set-env-vars BACKEND_URL=$BACKEND_URL

echo ""
echo "✅ Backend URL updated!"
echo ""
echo "Current configuration:"
echo "  BACKEND_URL = $BACKEND_URL"
echo ""
echo "🔄 The service will restart automatically with new settings"
echo ""
echo "Test it:"
echo "  1. Go to: https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app/dashboard"
echo "  2. View page source (Ctrl+U)"
echo "  3. Look for <img> tags - they should now show:"
echo "     $BACKEND_URL/uploads/..."
echo ""
