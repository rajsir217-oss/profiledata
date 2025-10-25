#!/bin/bash

# Simple Backend Deployment Script
# Deploys FastAPI backend to Google Cloud Run

set -e  # Exit on error

PROJECT_ID="matrimonial-staging"
SERVICE_NAME="matrimonial-backend"
REGION="us-central1"

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
  --set-env-vars "MONGODB_URL=mongodb://localhost:27017,ENV=production"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service URL:"
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)"
