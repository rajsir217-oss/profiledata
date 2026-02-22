#!/bin/bash

echo "🚀 Deploying WorkType Search Changes to Production"
echo "================================================="

# Backend deployment
echo "1. Deploying backend changes..."
cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend

# Check if gcloud is configured
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud not found. Please install Google Cloud SDK."
    exit 1
fi

# Get the project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No gcloud project configured. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📍 Using project: $PROJECT_ID"

# Deploy backend to Cloud Run
echo "📦 Building and deploying backend..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/matrimonial-backend .

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy matrimonial-backend \
  --image gcr.io/$PROJECT_ID/matrimonial-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="MONGODB_URL=$(grep MONGODB_URL .env.production | cut -d'=' -f2-)" \
  --set-env-vars="JWT_SECRET=$(grep JWT_SECRET .env.production | cut -d'=' -f2-)" \
  --set-env-vars="EMAIL_FROM=$(grep EMAIL_FROM .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_HOST=$(grep SMTP_HOST .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_PORT=$(grep SMTP_PORT .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_USER=$(grep SMTP_USER .env.production | cut -d'=' -f2-)" \
  --set-env-vars="SMTP_PASSWORD=$(grep SMTP_PASSWORD .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_ACCOUNT_SID=$(grep TWILIO_ACCOUNT_SID .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_AUTH_TOKEN=$(grep TWILIO_AUTH_TOKEN .env.production | cut -d'=' -f2-)" \
  --set-env-vars="TWILIO_FROM_PHONE=$(grep TWILIO_FROM_PHONE .env.production | cut -d'=' -f2-)" \
  --set-env-vars="FRONTEND_URL=https://l3v3lmatches.com"

# Get the new backend URL
BACKEND_URL=$(gcloud run services describe matrimonial-backend --platform managed --region us-central1 --format='value(status.url)')
echo "✅ Backend deployed at: $BACKEND_URL"

# Frontend deployment (if needed)
echo ""
echo "2. Checking if frontend needs update..."
cd /Users/rajsiripuram02/opt/appsrc/profiledata/frontend

# Update runtime config for frontend
cat > public/config.js << EOF
window.RUNTIME_CONFIG = {
  SOCKET_URL: "$BACKEND_URL",
  API_URL: "$BACKEND_URL/api/users"
};
EOF

echo "✅ Runtime config updated"

# Deploy frontend
echo "📦 Building and deploying frontend..."
npm run build

gcloud builds submit --tag gcr.io/$PROJECT_ID/matrimonial-frontend .

gcloud run deploy matrimonial-frontend \
  --image gcr.io/$PROJECT_ID/matrimonial-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

echo ""
echo "================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================="
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: https://l3v3lmatches.com"
echo ""
echo "📝 Next Steps:"
echo "1. Wait 2-3 minutes for deployment to fully propagate"
echo "2. Test the occupation search at https://l3v3lmatches.com/search"
echo "3. Check that occupation dropdown shows 29 standard categories"
