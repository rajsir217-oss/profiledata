#!/bin/bash

# Simple Frontend Deployment Script
# Deploys React frontend to Google Cloud Run

set -e  # Exit on error

PROJECT_ID="matrimonial-staging"
SERVICE_NAME="matrimonial-frontend"
REGION="us-central1"

echo "======================================"
echo "🚀 Simple Frontend Deployment"
echo "======================================"
echo ""
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Get backend URL
echo "🔍 Detecting backend URL..."
BACKEND_URL=$(gcloud run services describe matrimonial-backend \
  --region $REGION \
  --format 'value(status.url)' 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Backend service not found! Deploy backend first."
  exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"
echo ""

# Get frontend URL (placeholder for now, will be updated after deployment)
FRONTEND_URL="https://matrimonial-frontend-458052696267.us-central1.run.app"

# Update config.js with backend URL
echo "🔧 Updating config.js..."
cat > ./frontend/public/config.js << EOF
/**
 * Runtime Configuration
 * Auto-generated during deployment
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'pod',
  SOCKET_URL: '$BACKEND_URL',
  API_URL: '$BACKEND_URL/api/users',
  WS_URL: 'wss://${BACKEND_URL#https://}',
  FRONTEND_URL: '$FRONTEND_URL',
  ENABLE_WEBSOCKETS: true,
  ENABLE_NOTIFICATIONS: true,
  DEBUG: false
};
console.log('✅ Runtime config loaded:', window.RUNTIME_CONFIG.ENVIRONMENT);
EOF

# Update apiConfig.js with backend URL
echo "🔧 Updating apiConfig.js..."
# Use @ as delimiter to avoid conflicts with URLs containing ://
sed -i.bak "s@backend: process.env.REACT_APP_POD_BACKEND_URL.*@backend: process.env.REACT_APP_POD_BACKEND_URL || '$BACKEND_URL',@" ./frontend/src/config/apiConfig.js
sed -i.bak "s@api: process.env.REACT_APP_POD_API_URL.*@api: process.env.REACT_APP_POD_API_URL || '$BACKEND_URL/api/users',@" ./frontend/src/config/apiConfig.js
sed -i.bak "s@ws: process.env.REACT_APP_POD_WS_URL.*@ws: process.env.REACT_APP_POD_WS_URL || 'wss://${BACKEND_URL#https://}'@" ./frontend/src/config/apiConfig.js

echo "✅ Configuration updated"
echo ""

# Build and deploy in one command
echo "📦 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source ./frontend \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --clear-base-image

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the actual deployed frontend URL
DEPLOYED_FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo "Frontend URL: $DEPLOYED_FRONTEND_URL"
echo ""

# Update backend with the actual frontend URL
echo "🔧 Updating backend with frontend URL..."
gcloud run services update matrimonial-backend \
  --region $REGION \
  --update-env-vars "FRONTEND_URL=$DEPLOYED_FRONTEND_URL,APP_URL=$DEPLOYED_FRONTEND_URL" \
  --quiet

echo "✅ Backend updated with frontend URL"
echo ""
echo "🎉 Deployment Summary:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $DEPLOYED_FRONTEND_URL"
echo ""
echo "💡 Note: You may need to update config.js with the actual frontend URL"
echo "   Run './switch-environment.sh local' when done to restore local config"
