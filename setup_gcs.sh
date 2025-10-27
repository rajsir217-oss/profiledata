#!/bin/bash

# Setup Google Cloud Storage for Photo Uploads
# This script creates a GCS bucket and configures permissions

set -e

echo "🚀 Setting up Google Cloud Storage for Photo Uploads"
echo "===================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project ID
echo "📋 Step 1: Get GCP Project ID"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No GCP project set${NC}"
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✅ Using project: $PROJECT_ID${NC}"
echo ""

# Set bucket name
BUCKET_NAME="matrimonial-uploads-${PROJECT_ID}"
REGION="us-central1"

echo "📦 Step 2: Create GCS Bucket"
echo "Bucket name: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Check if bucket exists
if gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
    echo -e "${YELLOW}⚠️  Bucket already exists${NC}"
else
    # Create bucket
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME/
    echo -e "${GREEN}✅ Bucket created${NC}"
fi
echo ""

# Make bucket public
echo "🌍 Step 3: Make Bucket Public (for profile photos)"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME/
echo -e "${GREEN}✅ Bucket is now public${NC}"
echo ""

# Get frontend URL
echo "🔗 Step 4: Configure CORS"
read -p "Enter your frontend URL (e.g., https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app): " FRONTEND_URL

if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app"
    echo "Using default: $FRONTEND_URL"
fi

# Create CORS config
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["$FRONTEND_URL", "http://localhost:3000"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://$BUCKET_NAME/
rm /tmp/cors.json
echo -e "${GREEN}✅ CORS configured${NC}"
echo ""

# Grant Cloud Run permissions
echo "🔐 Step 5: Grant Cloud Run Permissions"
SERVICE_ACCOUNT=$(gcloud run services describe matrimonial-backend \
  --region $REGION \
  --format 'value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo "")

if [ -z "$SERVICE_ACCOUNT" ]; then
    echo -e "${YELLOW}⚠️  Cloud Run service not found${NC}"
    echo "Deploy your backend first, then run this script again"
    SERVICE_ACCOUNT="NOT_SET"
else
    # Grant storage admin role
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$SERVICE_ACCOUNT" \
      --role="roles/storage.objectAdmin" \
      --condition=None \
      --quiet
    echo -e "${GREEN}✅ Permissions granted to: $SERVICE_ACCOUNT${NC}"
fi
echo ""

# Get backend URL (needed for Step 6)
BACKEND_URL=$(gcloud run services describe matrimonial-backend \
  --region $REGION \
  --format 'value(status.url)' 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo -e "${YELLOW}⚠️  Backend not deployed yet${NC}"
    BACKEND_URL="https://matrimonial-backend-XXXXX-uc.a.run.app"
fi

# Create .env.production update
echo "📝 Step 6: Environment Variables"
echo ""
echo "Add these to your .env.production or Cloud Run secrets:"
echo "================================================================"
echo "USE_GCS=true"
echo "GCS_BUCKET_NAME=$BUCKET_NAME"
echo "GCS_PROJECT_ID=$PROJECT_ID"
echo "BACKEND_URL=$BACKEND_URL"
echo "================================================================"
echo ""

# Save to file
cat > fastapi_backend/.env.gcs << EOF
# Google Cloud Storage Configuration
# Copy these to .env.production or set as Cloud Run secrets

USE_GCS=true
GCS_BUCKET_NAME=$BUCKET_NAME
GCS_PROJECT_ID=$PROJECT_ID
BACKEND_URL=$BACKEND_URL
EOF

echo -e "${GREEN}✅ Configuration saved to: fastapi_backend/.env.gcs${NC}"
echo ""

# Migration instructions
echo "📤 Step 7: Migrate Existing Photos (Optional)"
echo ""
if [ -d "fastapi_backend/uploads" ] && [ "$(ls -A fastapi_backend/uploads 2>/dev/null)" ]; then
    echo "Found existing photos in uploads/ directory"
    read -p "Do you want to migrate them to GCS now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Uploading files..."
        gsutil -m cp -r fastapi_backend/uploads/* gs://$BUCKET_NAME/uploads/
        echo -e "${GREEN}✅ Photos migrated to GCS${NC}"
        
        # Count files
        FILE_COUNT=$(gsutil ls gs://$BUCKET_NAME/uploads/ | wc -l)
        echo "Total files in GCS: $FILE_COUNT"
    else
        echo "Skipped migration. You can migrate later with:"
        echo "gsutil -m cp -r fastapi_backend/uploads/* gs://$BUCKET_NAME/uploads/"
    fi
else
    echo "No existing photos found in uploads/ directory"
fi
echo ""

# Deployment instructions
echo "🚢 Step 8: Deploy Updated Backend"
echo ""
echo "Now deploy your backend with the new changes:"
echo ""
echo "cd fastapi_backend"
echo "gcloud builds submit --config cloudbuild.yaml"
echo ""
echo "Or set environment variables directly:"
echo ""
echo "gcloud run services update matrimonial-backend \\"
echo "  --region $REGION \\"
echo "  --set-env-vars USE_GCS=true,GCS_BUCKET_NAME=$BUCKET_NAME,GCS_PROJECT_ID=$PROJECT_ID,BACKEND_URL=$BACKEND_URL"
echo ""

echo "================================================================"
echo -e "${GREEN}✅ GCS Setup Complete!${NC}"
echo "================================================================"
echo ""
echo "📊 Summary:"
echo "  • Bucket: gs://$BUCKET_NAME"
echo "  • Region: $REGION"
echo "  • Public Access: Enabled"
echo "  • CORS: Configured"
echo "  • Service Account: $SERVICE_ACCOUNT"
echo ""
echo "🔗 View bucket: https://console.cloud.google.com/storage/browser/$BUCKET_NAME"
echo ""
echo "Next steps:"
echo "  1. Deploy backend with updated code"
echo "  2. Set environment variables (USE_GCS=true, etc.)"
echo "  3. Test photo upload on production"
echo "  4. Monitor GCS usage in GCP Console"
echo ""
echo "📖 For detailed instructions, see: GCS_PHOTO_UPLOAD_FIX.md"
