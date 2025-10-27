#!/bin/bash

# Simple Backend Deployment Script
# Deploys FastAPI backend to Google Cloud Run

set -e  # Exit on error

PROJECT_ID="matrimonial-staging"
SERVICE_NAME="matrimonial-backend"
REGION="us-central1"
GCS_BUCKET="matrimonial-images-prod"

# Load production environment variables
source ./fastapi_backend/.env.production 2>/dev/null || true

echo "======================================"
echo "🚀 Simple Backend Deployment"
echo "======================================"
echo ""
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Build and deploy in one command
echo "📦 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source ./fastapi_backend \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "\
MONGODB_URL=$MONGODB_URL,\
DATABASE_NAME=$DATABASE_NAME,\
REDIS_URL=$REDIS_URL,\
USE_GCS=true,\
GCS_BUCKET_NAME=$GCS_BUCKET,\
GCS_PROJECT_ID=$PROJECT_ID,\
ALGORITHM=HS256,\
ACCESS_TOKEN_EXPIRE_MINUTES=30,\
SMTP_HOST=smtp.gmail.com,\
SMTP_PORT=587,\
FROM_EMAIL=noreply@l3v3l.com,\
FROM_NAME=L3V3L Dating,\
ENABLE_NOTIFICATIONS=true,\
ENABLE_SCHEDULER=true,\
ENABLE_WEBSOCKETS=true,\
DEBUG_MODE=false,\
LOG_LEVEL=INFO"

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the actual deployed URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo "Service URL: $BACKEND_URL"
echo ""

# Update BACKEND_URL and FRONTEND_URL environment variables
echo "🔧 Updating BACKEND_URL environment variable..."

# Check if frontend service exists to get its URL
FRONTEND_URL=$(gcloud run services describe matrimonial-frontend \
  --region $REGION \
  --format "value(status.url)" 2>/dev/null || echo "")

if [ -z "$FRONTEND_URL" ]; then
  echo "⚠️  Frontend not deployed yet, setting placeholder"
  FRONTEND_URL="https://matrimonial-frontend-458052696267.us-central1.run.app"
fi

gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --set-env-vars "BACKEND_URL=$BACKEND_URL,FRONTEND_URL=$FRONTEND_URL,APP_URL=$FRONTEND_URL"

echo "✅ Backend configured:"
echo "   BACKEND_URL: $BACKEND_URL"
echo "   FRONTEND_URL: $FRONTEND_URL"
