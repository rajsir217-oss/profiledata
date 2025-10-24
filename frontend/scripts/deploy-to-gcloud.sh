#!/bin/bash
# Deploy frontend to Google Cloud Run

set -e

ENV=${1:-dev}
PROJECT_ID=${2:-your-gcp-project-id}
REGION=${3:-us-central1}

echo "🚀 Deploying frontend to Google Cloud Run"
echo "Environment: $ENV"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "================================================"

# Validate environment
if [[ ! "$ENV" =~ ^(dev|stage|pod)$ ]]; then
  echo "❌ Error: Invalid environment. Use: dev, stage, or pod"
  exit 1
fi

# Load environment variables from .env file
ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found!"
  echo "💡 Copy from .env.$ENV.example and configure with your backend URLs"
  exit 1
fi

# Read environment variables
echo "📋 Loading configuration from $ENV_FILE..."
source <(grep -v '^#' "$ENV_FILE" | sed 's/^/export /')

# Service name based on environment
SERVICE_NAME="frontend-$ENV"

echo ""
echo "📦 Service configuration:"
echo "  Service name: $SERVICE_NAME"
echo "  Backend URL: ${REACT_APP_SOCKET_URL:-not set}"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Build for environment
echo "🏗️  Building for $ENV..."
./scripts/build-for-env.sh $ENV

# Deploy to Cloud Run
echo ""
echo "☁️  Deploying to Google Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_ENVIRONMENT=$ENV" \
  --set-env-vars "REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}" \
  --set-env-vars "REACT_APP_API_URL=${REACT_APP_API_URL}" \
  --set-env-vars "REACT_APP_WS_URL=${REACT_APP_WS_URL}"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your frontend is now live at:"
gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)'

echo ""
echo "🔍 Test your deployment:"
echo "  1. Open the URL above in your browser"
echo "  2. Open browser console (F12)"
echo "  3. Verify backend URL in network requests"
echo "  4. Check for any errors"
