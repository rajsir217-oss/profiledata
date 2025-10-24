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
