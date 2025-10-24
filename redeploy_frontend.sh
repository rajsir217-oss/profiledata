#!/bin/bash

# Quick script to redeploy frontend with correct backend URL

set -e

echo "🔄 Redeploying Frontend with Correct Backend URL"
echo "================================================"
echo ""

# Backend URL
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
PROJECT_ID="matrimonial-staging"
REGION="us-central1"
FRONTEND_SERVICE="matrimonial-frontend"

echo "📦 Configuration:"
echo "   Backend URL: $BACKEND_URL"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Navigate to frontend
cd frontend

# Create temporary .env.production file with backend URL
cat > .env.production << EOF
REACT_APP_API_URL=${BACKEND_URL}/api/users
REACT_APP_SOCKET_URL=${BACKEND_URL}
EOF

echo "✅ Created .env.production with backend URL"
echo ""

# Copy Dockerfile
cp Dockerfile.prod Dockerfile

echo "🔨 Building and deploying frontend..."
echo "   This may take 5-10 minutes..."
echo ""

# Deploy with env vars
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
rm .env.production
rm Dockerfile

echo ""
echo "============================================="
echo "✅ Frontend Redeployed!"
echo "============================================="
echo ""
echo "🌐 Your app is now live at:"
echo "   👉 $FRONTEND_URL"
echo ""
echo "✅ Frontend should now connect to backend correctly!"
echo ""
