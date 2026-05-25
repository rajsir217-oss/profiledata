#!/usr/bin/env bash

# Comprehensive frontend deployment script for Google Cloud Run
# - Builds the React frontend container image
# - Generates runtime config pointing to the active backend
# - Deploys to Cloud Run with consistent resource settings
# - Restores local config files after deployment to keep repo clean

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$REPO_ROOT/frontend"

# Load centralized configuration
. "$SCRIPT_DIR/deploy.config.sh"

# Parse command-line arguments
for arg in "$@"; do
  case $arg in
    --non-interactive)
      NON_INTERACTIVE=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
    --backend-url=*)
      BACKEND_URL="${arg#*=}"
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Configuration (can be overridden via environment variables or .env.deploy)
# -----------------------------------------------------------------------------
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_URI="${IMAGE_URI:-gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE}:${IMAGE_TAG}}"
CONFIG_FILE="${CONFIG_FILE:-${FRONTEND_DIR}/.env.deploy}"

# Optional config file (bash KEY=VALUE per line)
if [[ -f "$CONFIG_FILE" ]]; then
  echo "📄 Loading deployment config from $CONFIG_FILE"
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

BACKEND_URL="${BACKEND_URL:-}"
RUNTIME_ENVIRONMENT="${RUNTIME_ENVIRONMENT:-pod}"
ENABLE_WEBSOCKETS="${ENABLE_WEBSOCKETS:-true}"
ENABLE_NOTIFICATIONS="${ENABLE_NOTIFICATIONS:-true}"
DEBUG_RUNTIME="${DEBUG_RUNTIME:-false}"
LOG_LEVEL="${LOG_LEVEL:-WARNING}"

# -----------------------------------------------------------------------------
# Pre-flight checks
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
echo "🚀 Deploying $FRONTEND_SERVICE to Cloud Run"
echo "   Project : $PROJECT_ID"
echo "   Region  : $REGION"
echo "   Image   : $IMAGE_URI"
echo "============================================="

# Pre-deployment validation
pre_deployment_check frontend || exit 1

# Resolve backend URL if not provided
if [[ -z "$BACKEND_URL" ]]; then
  echo "🔍 Fetching backend URL from Cloud Run service $BACKEND_SERVICE"
  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --format 'value(status.url)' 2>/dev/null || true)

  if [[ -z "$BACKEND_URL" ]]; then
    echo "❌ Unable to determine backend URL. Set BACKEND_URL or deploy backend first."
    exit 1
  fi
fi

echo "✅ Backend URL: $BACKEND_URL"

# Validate backend URL format to prevent injection attacks
if ! [[ "$BACKEND_URL" =~ ^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$ ]]; then
  echo "❌ Invalid backend URL format: $BACKEND_URL"
  echo "   URL must start with http:// or https:// and contain valid characters"
  exit 1
fi

# Verify backend is accessible (with retries for cold start)
echo "🔍 Verifying backend health..."
HEALTH_CHECK_SUCCESS=false
for i in {1..3}; do
  if curl -sf --max-time 10 "${BACKEND_URL}/health" >/dev/null 2>&1; then
    echo "✅ Backend is responding"
    HEALTH_CHECK_SUCCESS=true
    break
  else
    if [ $i -lt 3 ]; then
      echo "⏳ Attempt $i/3 failed, waiting 10s for backend cold start..."
      sleep 10
    fi
  fi
done

if [ "$HEALTH_CHECK_SUCCESS" = false ]; then
  echo "⚠️  Warning: Backend not responding after 3 attempts at ${BACKEND_URL}"
  echo "   This might be due to cold start. Frontend will deploy anyway."
  echo "   Backend should be accessible within 1-2 minutes."
fi

# -----------------------------------------------------------------------------
# Prepare runtime configuration (temporary file modifications)
# -----------------------------------------------------------------------------
CONFIG_JS_PATH="$FRONTEND_DIR/public/config.js"
API_CONFIG_PATH="$FRONTEND_DIR/src/config/apiConfig.js"
CONFIG_JS_BACKUP=$(mktemp)
API_CONFIG_BACKUP=$(mktemp)

# Ensure backups are restored on exit
restore_configs() {
  if [[ -f "$CONFIG_JS_BACKUP" ]]; then
    mv "$CONFIG_JS_BACKUP" "$CONFIG_JS_PATH"
  fi
  if [[ -f "$API_CONFIG_BACKUP" ]]; then
    mv "$API_CONFIG_BACKUP" "$API_CONFIG_PATH"
  fi
}
trap restore_configs EXIT

cp "$CONFIG_JS_PATH" "$CONFIG_JS_BACKUP"
cp "$API_CONFIG_PATH" "$API_CONFIG_BACKUP"

echo "📝 Writing runtime configuration to public/config.js"
cat > "$CONFIG_JS_PATH" <<EOF
/**
 * Runtime Configuration (auto-generated by deploy_frontend_full.sh)
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: '${RUNTIME_ENVIRONMENT}',
  SOCKET_URL: '${BACKEND_URL}',
  API_URL: '${BACKEND_URL}/api/users',
  WS_URL: 'wss://${BACKEND_URL#https://}',
  ENABLE_WEBSOCKETS: ${ENABLE_WEBSOCKETS},
  ENABLE_NOTIFICATIONS: ${ENABLE_NOTIFICATIONS},
  DEBUG: ${DEBUG_RUNTIME},
  LOG_LEVEL: '${LOG_LEVEL}'
};
console.log('✅ Runtime config loaded for', window.RUNTIME_CONFIG.ENVIRONMENT, '| Log Level:', window.RUNTIME_CONFIG.LOG_LEVEL);
EOF

echo "📝 Updating frontend src/config/apiConfig.js pod configuration"
export BACKEND_URL
export FRONTEND_DIR
python3 - <<'PY'
from pathlib import Path
import os
import sys

frontend_dir = Path(os.environ["FRONTEND_DIR"])
path = frontend_dir / "src/config/apiConfig.js"
backend_url = os.environ["BACKEND_URL"]
api_url = f"{backend_url}/api/users"
ws_host = backend_url.replace("https://", "").replace("http://", "")
ws_url = f"wss://{ws_host}"

text = path.read_text()

replacements = {
    "backend: process.env.REACT_APP_POD_BACKEND_URL": f"backend: process.env.REACT_APP_POD_BACKEND_URL || '{backend_url}'",
    "api: process.env.REACT_APP_POD_API_URL": f"api: process.env.REACT_APP_POD_API_URL || '{api_url}'",
    "ws: process.env.REACT_APP_POD_WS_URL": f"ws: process.env.REACT_APP_POD_WS_URL || '{ws_url}'",
}

for original, replacement in replacements.items():
    if original not in text:
        print(f"❌ Failed to locate configuration line containing: {original}", file=sys.stderr)
        sys.exit(1)
    start = text.index(original)
    line_end = text.find("\n", start)
    if line_end == -1:
        line_end = len(text)
    old_segment = text[start:line_end]
    text = text.replace(old_segment, replacement + old_segment[len(original):], 1)

path.write_text(text)
PY

echo "✅ Frontend configuration updated"

# -----------------------------------------------------------------------------
# Build and deploy
# -----------------------------------------------------------------------------
cd "$REPO_ROOT"
echo "📦 Building container image via Cloud Build..."
gcloud builds submit frontend --tag "$IMAGE_URI"

echo "☁️  Deploying to Cloud Run..."
gcloud run deploy "$FRONTEND_SERVICE" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port $FRONTEND_PORT \
  --cpu $FRONTEND_CPU \
  --memory $FRONTEND_MEMORY \
  --timeout $FRONTEND_TIMEOUT \
  --max-instances $FRONTEND_MAX_INSTANCES \
  --min-instances $FRONTEND_MIN_INSTANCES \
  --concurrency $FRONTEND_CONCURRENCY \
  --cpu-throttling >/dev/null

echo "🔄 Restoring local configuration files"
restore_configs
trap - EXIT

echo "✅ Local configuration restored"

SERVICE_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format='value(status.url)')

echo "============================================="
echo "🎉 Frontend deployment complete"
echo "   Frontend URL : $SERVICE_URL"
echo "   Backend URL  : $BACKEND_URL"
echo "============================================="
echo ""

# Restore local environment for development
echo "🔄 Restoring local development environment..."
cd "$FRONTEND_DIR"

# Clean React cache to ensure fresh build
echo "🧹 Cleaning React cache..."
rm -rf node_modules/.cache build 2>/dev/null || true

# Ensure .env.local is set to local
if [ ! -f ".env.local" ] || ! grep -q "REACT_APP_ENVIRONMENT=local" ".env.local"; then
    echo "📝 Creating/updating .env.local for local development..."
    cat > ".env.local" <<'ENVLOCAL'
# Local Development Environment
REACT_APP_ENVIRONMENT=local
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/users
REACT_APP_WS_URL=ws://localhost:8000
ENVLOCAL
fi

echo "✅ Local environment restored!"
echo ""
echo "📝 To run local development:"
echo "   cd frontend && npm start"
echo "   Your app will connect to http://localhost:8000"
echo ""
echo "⚠️  If React dev server is running, restart it to pick up local config:"
echo "   Press Ctrl+C in the terminal running 'npm start'"
echo "   Then run: npm start"
