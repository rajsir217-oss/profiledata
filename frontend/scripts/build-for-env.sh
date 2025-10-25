#!/bin/bash
# Build frontend for specific environment

set -e

ENV=${1:-local}
VALID_ENVS="local docker dev stage pod"

# Validate environment
if [[ ! " $VALID_ENVS " =~ " $ENV " ]]; then
  echo "❌ Error: Invalid environment '$ENV'"
  echo "Valid environments: $VALID_ENVS"
  exit 1
fi

echo "🏗️  Building frontend for environment: $ENV"
echo "================================================"

# Check if env file exists
ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  Warning: $ENV_FILE not found"
  echo "💡 Creating from example file..."
  
  if [ -f "${ENV_FILE}.example" ]; then
    cp "${ENV_FILE}.example" "$ENV_FILE"
    echo "✅ Created $ENV_FILE from example"
    echo "⚠️  IMPORTANT: Edit $ENV_FILE with your actual URLs before deploying!"
  else
    echo "❌ Error: ${ENV_FILE}.example not found"
    exit 1
  fi
fi

# Load environment variables
echo "📋 Loading environment from $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Show configuration
echo ""
echo "📡 Configuration:"
echo "  Environment: $REACT_APP_ENVIRONMENT"
echo "  Backend URL: ${REACT_APP_SOCKET_URL:-auto-detect}"
echo "  API URL: ${REACT_APP_API_URL:-auto-detect}"
echo "  WebSocket URL: ${REACT_APP_WS_URL:-auto-detect}"
echo ""

# Run build
echo "🔨 Running build..."
npm run build

echo ""
echo "✅ Build complete!"
echo "📦 Output directory: build/"
echo ""

# Environment-specific next steps
case $ENV in
  local)
    echo "Next steps:"
    echo "  npm start"
    ;;
  docker)
    echo "Next steps:"
    echo "  docker-compose build frontend"
    echo "  docker-compose up"
    ;;
  dev|stage|pod)
    echo "Next steps:"
    echo "  Deploy build/ directory to your hosting platform"
    echo "  Verify backend URLs in browser console"
    ;;
esac
