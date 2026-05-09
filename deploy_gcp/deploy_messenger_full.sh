#!/usr/bin/env bash

# Deployment script for the L3V3L Messenger (React Native Web) on Cloud Run.
# Mirrors deploy_frontend_full.sh but for messenger-web.
#
#   - Builds the messenger-web container image (context = repo root, because
#     messenger-web depends on ../messenger/src via webpack aliases).
#   - Deploys to Cloud Run as a separate service (matrimonial-messenger).
#   - Resources are kept small (256Mi / 1 CPU / max 2 instances) since this
#     is a static SPA bundle served by `serve`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
MESSENGER_DIR="$REPO_ROOT/messenger-web"

# -----------------------------------------------------------------------------
# Configuration (env-overridable)
# -----------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-matrimonial-staging}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-matrimonial-messenger}"
BACKEND_SERVICE="${BACKEND_SERVICE:-matrimonial-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_URI="${IMAGE_URI:-gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}}"

# -----------------------------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------------------------
if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "🔑 Checking active gcloud account..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" >/dev/null 2>&1; then
  echo "  No active account found. Opening browser for login..."
  gcloud auth login
fi

echo "🛠️  Setting gcloud project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

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

# Resolve backend URL (informational only — messenger reads via apiConfig.js)
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region "$REGION" \
  --format 'value(status.url)' 2>/dev/null || true)
if [[ -n "$BACKEND_URL" ]]; then
  echo "ℹ️  Backend reachable at: $BACKEND_URL"
fi

# -----------------------------------------------------------------------------
# Build via Cloud Build (context = repo root, because Dockerfile copies both
# messenger/ and messenger-web/).
# -----------------------------------------------------------------------------
cd "$REPO_ROOT"

if [[ ! -f "$MESSENGER_DIR/cloudbuild.yaml" ]]; then
  echo "❌ Missing $MESSENGER_DIR/cloudbuild.yaml"
  exit 1
fi
if [[ ! -f "$MESSENGER_DIR/Dockerfile.prod" ]]; then
  echo "❌ Missing $MESSENGER_DIR/Dockerfile.prod"
  exit 1
fi

echo "📦 Building messenger image via Cloud Build..."
gcloud builds submit . \
  --config "messenger-web/cloudbuild.yaml" \
  --substitutions="_IMAGE_URI=${IMAGE_URI}"

echo "☁️  Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 256Mi \
  --timeout 60 \
  --max-instances 2 \
  --min-instances 0 \
  --concurrency 100 \
  --cpu-throttling >/dev/null

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo "============================================="
echo "🎉 Messenger deployment complete"
echo "   Cloud Run URL  : $SERVICE_URL"
echo "   Custom domain  : https://messenger.l3v3lmatches.com (if mapped)"
echo "============================================="
echo ""
echo "ℹ️  If this is the first deploy, set up the custom domain:"
echo "   ./deploy_gcp/deploy-production.sh --setup-messenger-domain"
echo ""
