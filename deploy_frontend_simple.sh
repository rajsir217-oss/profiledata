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
echo "Service URL:"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)"
