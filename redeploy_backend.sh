#!/bin/bash

# Quick backend redeployment with CORS fix

set -e

echo "🔄 Redeploying Backend with CORS Fix"
echo "====================================="
echo ""

PROJECT_ID="matrimonial-staging"
REGION="us-central1"
BACKEND_SERVICE="matrimonial-backend"

# MongoDB and Redis URLs
MONGODB_URL="mongodb+srv://rajl3v3l_db_user:3F01eZUHTY9tx07u@mongocluster0.rebdf0h.mongodb.net/matrimonialDB?retryWrites=true&w=majority&appName=MongoCluster0"
REDIS_URL="redis://default:2svzScwOza6YUFifjx32WIWqWHytrq12@redis-11872.c263.us-east-1-2.ec2.redns.redis-cloud.com:11872"

# Generate secret key
SECRET_KEY=$(openssl rand -hex 32)

echo "📦 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $BACKEND_SERVICE"
echo ""

# Set project
gcloud config set project $PROJECT_ID

cd fastapi_backend

# Copy Dockerfile
cp Dockerfile.prod Dockerfile

echo "🔨 Building and deploying backend..."
echo "   This may take 5-10 minutes..."
echo ""

gcloud run deploy $BACKEND_SERVICE \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars="MONGODB_URL=$MONGODB_URL,REDIS_URL=$REDIS_URL,DATABASE_NAME=matrimonialDB,SECRET_KEY=$SECRET_KEY,ENVIRONMENT=production"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format 'value(status.url)')

# Clean up
rm Dockerfile

cd ..

echo ""
echo "============================================="
echo "✅ Backend Redeployed!"
echo "============================================="
echo ""
echo "🌐 Backend URL:"
echo "   $BACKEND_URL"
echo ""
echo "✅ CORS now allows production frontend!"
echo "✅ Redis connection uses environment variable!"
echo ""
echo "💡 Next: Hard refresh your browser (Cmd+Shift+R)"
echo "   Then try logging in again!"
echo ""
