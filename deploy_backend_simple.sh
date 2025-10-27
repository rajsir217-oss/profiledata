#!/bin/bash

# Simple Backend Deployment Script
# Deploys FastAPI backend to Google Cloud Run

set -e  # Exit on error

PROJECT_ID="matrimonial-staging"
SERVICE_NAME="matrimonial-backend"
REGION="us-central1"
GCS_BUCKET="matrimonial-uploads-matrimonial-staging"

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
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --clear-base-image \
  --set-env-vars "MONGODB_URL=mongodb://localhost:27017,ENV=production,USE_GCS=true,GCS_BUCKET_NAME=$GCS_BUCKET,GCS_PROJECT_ID=$PROJECT_ID"

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the actual deployed URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo "Service URL: $BACKEND_URL"
echo ""

# Update BACKEND_URL environment variable with the actual URL
echo "🔧 Updating BACKEND_URL environment variable..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --set-env-vars "BACKEND_URL=$BACKEND_URL"

echo "✅ Backend URL configured: $BACKEND_URL"
