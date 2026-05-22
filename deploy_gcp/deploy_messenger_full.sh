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

# Production defaults baked into the messenger build during deploy.
# These are safe to embed (public URLs + Turnstile *site* key).
MAIN_APP_URL="${MAIN_APP_URL:-https://l3v3lmatches.com}"
TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-0x4AAAAAACAeADZnXAaS1tep}"

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

# Resolve backend URL (used for build-time config injection)
BACKEND_URL="${BACKEND_URL:-}"
if [[ -z "$BACKEND_URL" ]]; then
  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --format 'value(status.url)' 2>/dev/null || true)
fi
if [[ -n "$BACKEND_URL" ]]; then
  echo "ℹ️  Backend reachable at: $BACKEND_URL"
fi

# -----------------------------------------------------------------------------
# Prepare build-time configuration
#
# IMPORTANT:
# - messenger-web uses webpack DefinePlugin to load .env.production / .env.local
# - Those .env files are gitignored -> gcloud builds submit excludes them
# - So in production, process.env.MESSENGER_* can become undefined
#
# To avoid broken prod builds, we temporarily inject production defaults into
# source-controlled config files for the duration of the Cloud Build, then
# restore them immediately after.
# -----------------------------------------------------------------------------

MESSENGER_WEB_API_CONFIG_PATH="$MESSENGER_DIR/src/config/apiConfig.js"
MESSENGER_SHARED_API_CONFIG_PATH="$REPO_ROOT/messenger/src/config/api.js"
MESSENGER_WEB_API_CONFIG_BACKUP=$(mktemp)
MESSENGER_SHARED_API_CONFIG_BACKUP=$(mktemp)

restore_configs() {
  if [[ -f "$MESSENGER_WEB_API_CONFIG_BACKUP" ]]; then
    mv "$MESSENGER_WEB_API_CONFIG_BACKUP" "$MESSENGER_WEB_API_CONFIG_PATH"
  fi
  if [[ -f "$MESSENGER_SHARED_API_CONFIG_BACKUP" ]]; then
    mv "$MESSENGER_SHARED_API_CONFIG_BACKUP" "$MESSENGER_SHARED_API_CONFIG_PATH"
  fi
}
trap restore_configs EXIT

cp "$MESSENGER_WEB_API_CONFIG_PATH" "$MESSENGER_WEB_API_CONFIG_BACKUP"
cp "$MESSENGER_SHARED_API_CONFIG_PATH" "$MESSENGER_SHARED_API_CONFIG_BACKUP"

echo "📝 Injecting production defaults into messenger config (temporary)"
export BACKEND_URL
export MAIN_APP_URL
export TURNSTILE_SITE_KEY
export MESSENGER_DIR
python3 - <<'PY'
from pathlib import Path
import os
import sys
import re

backend_url = os.environ.get("BACKEND_URL") or ""
main_app_url = os.environ.get("MAIN_APP_URL") or ""
turnstile_site_key = os.environ.get("TURNSTILE_SITE_KEY") or ""
messenger_dir = Path(os.environ["MESSENGER_DIR"])
repo_root = messenger_dir.parent

web_api_config = messenger_dir / "src/config/apiConfig.js"
shared_api_config = repo_root / "messenger/src/config/api.js"

if not backend_url:
    print("❌ BACKEND_URL is empty - cannot bake production defaults", file=sys.stderr)
    sys.exit(1)

text = web_api_config.read_text()
repls = [
    (
        r"^(\s*const\s+raw\s*=\s*process\.env\.MESSENGER_BACKEND_URL)(?:\s*\|\|\s*[^;]+)?;\s*$",
        lambda m: f"{m.group(1)} || '{backend_url}';",
        "MESSENGER_BACKEND_URL",
    ),
    (
        r"^(\s*return\s+process\.env\.MESSENGER_TURNSTILE_SITE_KEY)(?:\s*\|\|\s*[^;]+)?;\s*$",
        lambda m: f"{m.group(1)} || '{turnstile_site_key}';",
        "MESSENGER_TURNSTILE_SITE_KEY",
    ),
    (
        r"^(\s*const\s+raw\s*=\s*process\.env\.MESSENGER_MAIN_APP_URL)(?:\s*\|\|\s*[^;]+)?;\s*$",
        lambda m: f"{m.group(1)} || '{main_app_url}';",
        "MESSENGER_MAIN_APP_URL",
    ),
]

for pattern, repl_fn, label in repls:
    next_text, n = re.subn(pattern, repl_fn, text, count=1, flags=re.MULTILINE)
    if n != 1:
        print(f"❌ Failed to patch messenger-web apiConfig ({label}). Matches found: {n}", file=sys.stderr)
        sys.exit(1)
    text = next_text
web_api_config.write_text(text)

text = shared_api_config.read_text()
needle_base = "  (typeof process !== 'undefined' && process?.env ? process.env.MESSENGER_BACKEND_URL : null) ||"
needle_ws = "  (typeof process !== 'undefined' && process?.env ? process.env.MESSENGER_WS_URL : null) ||"
if needle_base not in text:
    print("❌ Failed to locate messenger shared BACKEND_URL needle", file=sys.stderr)
    sys.exit(1)
if needle_ws not in text:
    print("❌ Failed to locate messenger shared WS_URL needle", file=sys.stderr)
    sys.exit(1)

inject_base = needle_base + f"\n  '{backend_url}' ||"
inject_ws = needle_ws + f"\n  '{backend_url}' ||"
text = text.replace(needle_base, inject_base, 1)
text = text.replace(needle_ws, inject_ws, 1)
shared_api_config.write_text(text)
PY

echo "✅ Messenger build configuration updated"

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

echo "🔄 Restoring local configuration files"
restore_configs
trap - EXIT

echo "✅ Local configuration restored"

echo "============================================="
echo "🎉 Messenger deployment complete"
echo "   Cloud Run URL  : $SERVICE_URL"
echo "   Custom domain  : https://messenger.l3v3lmatches.com (if mapped)"
echo "============================================="
echo ""
echo "ℹ️  If this is the first deploy, set up the custom domain:"
echo "   ./deploy_gcp/deploy-production.sh --setup-messenger-domain"
echo ""

# Restore local dev env file for messenger-web
echo "🔄 Restoring local development environment..."
cd "$MESSENGER_DIR"
if [ ! -f ".env.local" ] || ! grep -q "MESSENGER_BACKEND_URL=http://localhost:8000" ".env.local"; then
  echo "📝 Creating/updating messenger-web/.env.local for local development..."
  cat > ".env.local" <<'ENVLOCAL'
MESSENGER_BACKEND_URL=http://localhost:8000
MESSENGER_MAIN_APP_URL=http://localhost:3000
MESSENGER_TURNSTILE_SITE_KEY=1x00000000000000000000AA
ENVLOCAL
fi

echo "✅ Local environment restored!"
