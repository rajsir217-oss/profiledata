#!/bin/bash

# Simple Backend Deployment Script
# Deploys FastAPI backend to Google Cloud Run

set -e  # Exit on error

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PROJECT_ID="matrimonial-staging"
SERVICE_NAME="matrimonial-backend"
REGION="us-central1"
GCS_BUCKET="matrimonial-images-prod"

# Load production environment variables
source "$PROJECT_ROOT/fastapi_backend/.env.production" 2>/dev/null || true

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

# Generate build info before deployment
echo "📝 Generating build information..."
cd "$PROJECT_ROOT/fastapi_backend"
python3 generate_build_info.py || echo "⚠️  Could not generate build info (continuing anyway)"
cd "$PROJECT_ROOT"

# Build and deploy in one command
echo "📦 Building and deploying..."
gcloud run deploy $SERVICE_NAME \
  --source "$PROJECT_ROOT/fastapi_backend" \
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
ENV=production,\
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
FROM_EMAIL=rajl3v3l@gmail.com,\
FROM_NAME=L3V3L Dating,\
SECRET_KEY=$SECRET_KEY,\
ENABLE_NOTIFICATIONS=true,\
ENABLE_SCHEDULER=true,\
ENABLE_WEBSOCKETS=true,\
DEBUG_MODE=false,\
LOG_LEVEL=INFO" \
  --set-secrets "ENCRYPTION_KEY=ENCRYPTION_KEY:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest"

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
echo "🔧 Updating BACKEND_URL and FRONTEND_URL environment variables..."

# Use actual domain for FRONTEND_URL, not Cloud Run URL
# This is critical for CORS to work correctly!
FRONTEND_URL="https://l3v3lmatches.com"
APP_URL="https://l3v3lmatches.com"

gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --update-env-vars "BACKEND_URL=$BACKEND_URL,FRONTEND_URL=$FRONTEND_URL,APP_URL=$APP_URL"

echo "✅ Backend configured:"
echo "   BACKEND_URL: $BACKEND_URL"
echo "   FRONTEND_URL: $FRONTEND_URL"
echo ""

# Restore local environment
echo "🔄 Restoring local environment configuration..."
if [ -f "$SCRIPT_DIR/switch-env.sh" ]; then
    bash "$SCRIPT_DIR/switch-env.sh" local
    echo "✅ Local environment restored - you can now run local backend with ./bstart.sh"
else
    echo "⚠️  switch-env.sh not found, manually run: ./switch-env.sh local"
fi
