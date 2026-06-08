#!/bin/bash

echo "🚀 Redeploying backend with workType search fix..."

cd /Users/rajsiripuram02/opt/appsrc/profiledata/fastapi_backend

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
echo "📍 Using project: $PROJECT_ID"

# Build and deploy backend
echo "📦 Building backend..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/matrimonial-backend .

echo "🚀 Deploying backend..."
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

echo ""
echo "⏳ Waiting for deployment to propagate..."
sleep 30

echo ""
echo "🧪 Testing the fixed search..."
curl -s "$BACKEND_URL/api/users/search/occupation-options" | jq '.options | contains(["Doctor"])'

echo ""
echo "✅ Backend redeployment complete!"
echo "Please test the search at: https://l3v3lmatches.com/search"
