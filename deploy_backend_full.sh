#!/usr/bin/env bash

# Comprehensive backend deployment script for Google Cloud Run
# - Builds the FastAPI backend container image
# - Deploys to Cloud Run with full environment configuration
# - Updates the BACKEND_URL env var to the live service URL
# - Performs a post-deploy health check

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

# -----------------------------------------------------------------------------
# Configuration (override via environment variables before running the script)
# -----------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-matrimonial-staging}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-matrimonial-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_URI="${IMAGE_URI:-gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}}"
CONFIG_FILE="${CONFIG_FILE:-${REPO_ROOT}/fastapi_backend/.env.deploy}"

# Optional auto-load of config file (KEY=VALUE per line)
if [[ -f "$CONFIG_FILE" ]]; then
  echo "📄 Loading deployment config from $CONFIG_FILE"
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

# Required runtime secrets / configuration
REQUIRED_VARS=(
  MONGODB_URL
  REDIS_URL
  GCS_BUCKET_NAME
  GCS_PROJECT_ID
)

DATABASE_NAME="${DATABASE_NAME:-matrimonialDB}"
SECRET_KEY="${SECRET_KEY:-}"
USE_GCS="${USE_GCS:-true}"
ACCESS_TOKEN_EXPIRE_MINUTES="${ACCESS_TOKEN_EXPIRE_MINUTES:-30}"
ENVIRONMENT="${ENVIRONMENT:-production}"
FRONTEND_URL="${FRONTEND_URL:-}" # optional, can be empty

# Generate SECRET_KEY if not provided
if [[ -z "$SECRET_KEY" ]]; then
  SECRET_KEY="$(openssl rand -hex 32)"
  echo "🔐 Generated SECRET_KEY automatically: ${SECRET_KEY:0:12}..."
fi

# Validate required variables
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required environment variable: $var"
    echo "   Set it before running the script or place it in $CONFIG_FILE"
    exit 1
  fi
done

# Ensure gcloud is available and authenticated
if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "🔑 Checking active gcloud account..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null 2>&1; then
  echo "  No active account found. Opening browser for login..."
  gcloud auth login
fi

# Configure project
echo "🛠️  Setting gcloud project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

# Enable required APIs (idempotent)
echo "🔌 Ensuring required APIs are enabled"
gcloud services enable run.googleapis.com >/dev/null
gcloud services enable cloudbuild.googleapis.com >/dev/null
gcloud services enable artifactregistry.googleapis.com >/dev/null

echo "============================================="
echo "🚀 Deploying $SERVICE_NAME to Cloud Run"
echo "   Project : $PROJECT_ID"
echo "   Region  : $REGION"
echo "   Image   : $IMAGE_URI"
echo "============================================="

# Build container image using Cloud Build (Dockerfile in fastapi_backend)
cd "$REPO_ROOT"
echo "📦 Building container image via Cloud Build..."
gcloud builds submit fastapi_backend --tag "$IMAGE_URI"

echo "☁️  Deploying to Cloud Run..."
# Prepare environment variables for deployment
# Backlog: BACKEND_URL will be updated after deployment with live URL
ENV_VARS=(
  "ENV=$ENVIRONMENT"
  "MONGODB_URL=$MONGODB_URL"
  "DATABASE_NAME=$DATABASE_NAME"
  "REDIS_URL=$REDIS_URL"
  "USE_GCS=$USE_GCS"
  "GCS_BUCKET_NAME=$GCS_BUCKET_NAME"
  "GCS_PROJECT_ID=$GCS_PROJECT_ID"
  "SECRET_KEY=$SECRET_KEY"
  "ACCESS_TOKEN_EXPIRE_MINUTES=$ACCESS_TOKEN_EXPIRE_MINUTES"
)

if [[ -n "$FRONTEND_URL" ]]; then
  ENV_VARS+=("FRONTEND_URL=$FRONTEND_URL")
fi

# Join env vars by comma
ENV_VARS_JOINED=$(printf "%s," "${ENV_VARS[@]}")
ENV_VARS_JOINED=${ENV_VARS_JOINED%,}

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "$ENV_VARS_JOINED"

# Capture deployed URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo "🔗 Service live at: $SERVICE_URL"

echo "🔧 Updating BACKEND_URL env var to live URL"
gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --update-env-vars BACKEND_URL="$SERVICE_URL" >/dev/null

echo "✅ BACKEND_URL set to $SERVICE_URL"

echo "🩺 Performing health check..."
if ! curl -sSf "$SERVICE_URL/health" >/dev/null; then
  echo "⚠️ Health check failed at $SERVICE_URL/health"
else
  echo "✅ Health check succeeded"
fi

echo "============================================="
echo "🎉 Deployment complete"
echo "   Backend URL : $SERVICE_URL"
if [[ -n "$FRONTEND_URL" ]]; then
  echo "   Frontend URL: $FRONTEND_URL"
fi
echo "============================================="
