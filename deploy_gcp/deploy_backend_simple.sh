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
GCS_BUCKET="matrimonial-uploads-matrimonial-staging"

# Production environment variables
# Sensitive values (MONGODB_URL, REDIS_URL, etc.) are stored in Secret Manager
echo "✅ Production environment variables configured"

# Use LOG_LEVEL from environment or default to WARNING for production
LOG_LEVEL="${LOG_LEVEL:-WARNING}"

echo "======================================"
echo "🚀 Simple Backend Deployment"
echo "======================================"
echo ""
echo "Project:   $PROJECT_ID"
echo "Service:   $SERVICE_NAME"
echo "Region:    $REGION"
echo "Log Level: $LOG_LEVEL"
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
  --min-instances 1 \
  --max-instances 3 \
  --concurrency 80 \
  --no-cpu-throttling \
  --liveness-probe=httpGet.path=/health,httpGet.port=8080,initialDelaySeconds=180,periodSeconds=60,timeoutSeconds=15,failureThreshold=5 \
  --set-env-vars "\
ENV=production,\
DATABASE_NAME=matrimonialDB,\
FRONTEND_URL=https://l3v3lmatches.com,\
BACKEND_URL=https://matrimonial-backend-7cxoxmouuq-uc.a.run.app,\
APP_URL=https://l3v3lmatches.com,\
USE_GCS=true,\
GCS_BUCKET_NAME=$GCS_BUCKET,\
GCS_PROJECT_ID=$PROJECT_ID,\
ALGORITHM=HS256,\
ACCESS_TOKEN_EXPIRE_MINUTES=30,\
EMAIL_PROVIDER=resend,\
SMTP_HOST=smtp.gmail.com,\
SMTP_PORT=587,\
FROM_EMAIL=noreply@l3v3lmatches.com,\
FROM_NAME=L3V3L MATCHES,\
SMS_PROVIDER=simpletexting,\
ENABLE_NOTIFICATIONS=true,\
ENABLE_SCHEDULER=true,\
ENABLE_WEBSOCKETS=true,\
DEBUG_MODE=false,\
LOG_LEVEL=$LOG_LEVEL,\
AI_PROVIDER=groq,\
CLOVER_ENVIRONMENT=production" \
  --set-secrets "\
MONGODB_URL=MONGODB_URL:latest,\
REDIS_URL=REDIS_URL:latest,\
SECRET_KEY=SECRET_KEY:latest,\
ENCRYPTION_KEY=ENCRYPTION_KEY:latest,\
RESEND_API_KEY=RESEND_API_KEY:latest,\
SMTP_USER=SMTP_USER:latest,\
SMTP_PASSWORD=SMTP_PASSWORD:latest,\
SIMPLETEXTING_API_TOKEN=SIMPLETEXTING_API_TOKEN:latest,\
SIMPLETEXTING_ACCOUNT_PHONE=SIMPLETEXTING_ACCOUNT_PHONE:latest,\
GROQ_API_KEY=GROQ_API_KEY:latest,\
GEMINI_API_KEY=GEMINI_API_KEY:latest,\
STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,\
STRIPE_PUBLISHABLE_KEY=STRIPE_PUBLISHABLE_KEY:latest,\
STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,\
TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY:latest,\
PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID:latest,\
PAYPAL_CLIENT_SECRET=PAYPAL_CLIENT_SECRET:latest,\
FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,\
FIREBASE_PRIVATE_KEY_ID=FIREBASE_PRIVATE_KEY_ID:latest,\
FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,\
FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,\
FIREBASE_CLIENT_ID=FIREBASE_CLIENT_ID:latest,\
FIREBASE_CERT_URL=FIREBASE_CERT_URL:latest,\
CLOVER_MERCHANT_ID=CLOVER_MERCHANT_ID:latest,\
CLOVER_PRIVATE_TOKEN=CLOVER_PRIVATE_TOKEN:latest,\
CLOVER_PUBLIC_KEY=CLOVER_PUBLIC_KEY:latest"

echo ""
echo "✅ Backend deployment complete!"
echo ""

# Get the actual deployed URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(status.url)")

echo "Service URL: $BACKEND_URL"

# ============================================================================
# IMPORTANT: Recommend frontend redeployment
# Skip this prompt if called from deploy-production.sh (SKIP_FRONTEND_PROMPT=true)
# ============================================================================
if [[ "$SKIP_FRONTEND_PROMPT" != "true" ]]; then
  echo ""
  echo "⚠️  IMPORTANT: You may need to redeploy frontend to clear caches"
  echo ""
  echo "To deploy frontend (clears CDN cache and rebuilds React app):"
  echo "  cd $PROJECT_ROOT/deploy_gcp"
  echo "  ./deploy-production.sh"
  echo "  Choose: 2 (Frontend only)"
  echo ""
  read -p "Deploy frontend now? (y/N): " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying frontend..."
    cd "$PROJECT_ROOT"
    LOG_LEVEL="$LOG_LEVEL" ./deploy_gcp/deploy_frontend_full.sh
  else
    echo "⏭️  Skipping frontend deployment"
    echo "   You can deploy it later with: ./deploy_gcp/deploy-production.sh"
  fi
fi

echo ""
echo "============================================================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "============================================================================"
echo ""

# URLs are now set in initial deployment (lines 64-66)
# No need for separate update
echo "✅ Backend configured:"
echo "   BACKEND_URL: https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
echo "   FRONTEND_URL: https://l3v3lmatches.com"
echo "   APP_URL: https://l3v3lmatches.com"
echo ""

# Validate critical environment variables
echo "🔍 Validating critical environment variables..."
VALIDATION_FAILED=false

# Get all env vars in a format we can parse
ENV_VARS=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(spec.template.spec.containers[0].env)")

# Check GCS bucket
if echo "$ENV_VARS" | grep -q "GCS_BUCKET_NAME.*matrimonial-uploads-matrimonial-staging"; then
    echo "   ✅ GCS_BUCKET_NAME: matrimonial-uploads-matrimonial-staging"
else
    echo "   ❌ GCS_BUCKET_NAME not configured correctly"
    VALIDATION_FAILED=true
fi

# Check SMS provider
if echo "$ENV_VARS" | grep -q "SMS_PROVIDER.*simpletexting"; then
    echo "   ✅ SMS_PROVIDER: simpletexting"
else
    echo "   ❌ SMS_PROVIDER not configured"
    VALIDATION_FAILED=true
fi

# Check if SMS secrets are configured
if echo "$ENV_VARS" | grep -q "SIMPLETEXTING_API_TOKEN" && echo "$ENV_VARS" | grep -q "SIMPLETEXTING_ACCOUNT_PHONE"; then
    echo "   ✅ SMS secrets configured"
else
    echo "   ❌ SMS secrets not configured"
    VALIDATION_FAILED=true
fi

# Check FRONTEND_URL for CORS
if echo "$ENV_VARS" | grep -q "FRONTEND_URL.*l3v3lmatches.com"; then
    echo "   ✅ FRONTEND_URL: https://l3v3lmatches.com (CORS enabled)"
else
    echo "   ❌ FRONTEND_URL not configured correctly - CORS will fail!"
    VALIDATION_FAILED=true
fi

# Check ENV is production
if echo "$ENV_VARS" | grep -q "ENV.*production"; then
    echo "   ✅ ENV: production (using production CORS origins)"
else
    echo "   ❌ ENV not set to production - CORS may use dev settings!"
    VALIDATION_FAILED=true
fi

if [[ "$VALIDATION_FAILED" == "true" ]]; then
    echo ""
    echo "⚠️  Validation warnings detected!"
    echo "   Review configuration and re-deploy if needed"
else
    echo ""
    echo "✅ All critical configurations validated successfully!"
fi
echo ""

# Restore local environment
echo "🔄 Restoring local environment configuration..."
if [ -f "$SCRIPT_DIR/switch-env.sh" ]; then
    bash "$SCRIPT_DIR/switch-env.sh" local
    echo "✅ Local environment restored - you can now run local backend with ./bstart.sh"
else
    echo "⚠️  switch-env.sh not found, manually run: ./switch-env.sh local"
fi
