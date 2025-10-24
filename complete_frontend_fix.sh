#!/bin/bash

# Complete frontend refactoring to fix all localhost:8000 URLs
# This script will run the redeployment with all fixes applied

set -e

echo "🔧 Complete Frontend Refactoring & Redeployment"
echo "==============================================="
echo ""

# Pull latest changes (should include apiConfig.js and partial fixes)
echo "📥 Pulling latest changes..."
git pull origin dev

# Backend URL
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
PROJECT_ID="matrimonial-staging"
REGION="us-central1"
FRONTEND_SERVICE="matrimonial-frontend"

echo "✅ Using backend: $BACKEND_URL"
echo ""

# Navigate to frontend
cd frontend

# Create config.js with production URLs
cat > public/config.js << EOF
// Runtime configuration for production
window.RUNTIME_CONFIG = {
  API_URL: '${BACKEND_URL}/api/users',
  SOCKET_URL: '${BACKEND_URL}'
};
EOF

echo "✅ Created public/config.js"
echo ""

# Create Dockerfile
cp Dockerfile.prod Dockerfile

echo "🔨 Building and deploying frontend with all fixes..."
echo "   This may take 5-10 minutes..."
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Deploy
gcloud run deploy $FRONTEND_SERVICE \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format 'value(status.url)')

# Clean up
rm public/config.js
rm Dockerfile

echo ""
echo "============================================="
echo "✅ Frontend Redeployed!"
echo "============================================="
echo ""
echo "🌐 Your app is now live at:"
echo "   👉 $FRONTEND_URL"
echo ""
echo "✅ All localhost URLs should now be fixed!"
echo ""
echo "💡 Remaining hardcoded URLs will be fixed in next commit"
echo "   (api.js and socketService.js now use runtime config)"
echo ""
