#!/bin/bash

# Cloud Run Deployment Script for L3V3L Matrimonial App
# This script deploys the app to Google Cloud Run

set -e  # Exit on error

echo "🚀 L3V3L Matrimonial - Cloud Run Deployment"
echo "==========================================="
echo ""

# Configuration
REGION="us-central1"
BACKEND_SERVICE="matrimonial-backend"
FRONTEND_SERVICE="matrimonial-frontend"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "📥 Install it with: brew install google-cloud-sdk"
    echo "   Or visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "🔐 Please login to Google Cloud..."
    gcloud auth login
fi

echo "✅ Logged in to Google Cloud"
echo ""

# Get or create project
if [ -f ".gcp_project_id" ]; then
    PROJECT_ID=$(cat .gcp_project_id)
    echo "📦 Using saved project ID: $PROJECT_ID"
else
    echo "❌ No GCP project configured"
    echo ""
    echo "Please run the project setup script first:"
    echo "   ./setup_gcp_project.sh"
    echo ""
    exit 1
fi

# Verify project exists and is accessible
if ! gcloud projects describe $PROJECT_ID &>/dev/null; then
    echo "❌ Project '$PROJECT_ID' not found or not accessible"
    echo ""
    echo "Please run the project setup script:"
    echo "   ./setup_gcp_project.sh"
    echo ""
    exit 1
fi

echo "✅ Using project: $PROJECT_ID"
echo ""

# Prompt for environment variables
echo "⚙️  Environment Configuration"
echo "=============================="
echo ""

read -p "📧 MongoDB Atlas connection string (mongodb+srv://...): " MONGODB_URL
read -p "🔴 Redis Cloud connection string (redis://...): " REDIS_URL
read -p "🔑 Secret key for JWT (press Enter for auto-generate): " SECRET_KEY

if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    echo "   Generated secret key: ${SECRET_KEY:0:20}..."
fi

echo ""
echo "📦 Configuration Summary:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   MongoDB: ${MONGODB_URL:0:30}..."
echo "   Redis: ${REDIS_URL:0:30}..."
echo "   Secret Key: ${SECRET_KEY:0:20}..."
echo ""

read -p "✅ Continue with deployment? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Set project
echo ""
echo "🔧 Setting up GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "🔌 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy Backend
echo ""
echo "🔨 Building and deploying backend..."
echo "   This may take 5-10 minutes..."
cd fastapi_backend

# Use Dockerfile.prod (gcloud auto-detects Dockerfile in current directory)
cp Dockerfile.prod Dockerfile

gcloud run deploy $BACKEND_SERVICE \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars="MONGODB_URL=$MONGODB_URL,REDIS_URL=$REDIS_URL,DATABASE_NAME=matrimonialDB,SECRET_KEY=$SECRET_KEY,ENVIRONMENT=production"

# Get backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format 'value(status.url)')
echo "✅ Backend deployed: $BACKEND_URL"

# Deploy Frontend
echo ""
echo "🔨 Building and deploying frontend..."
echo "   This may take 5-10 minutes..."
cd ../frontend

# Use Dockerfile.prod (gcloud auto-detects Dockerfile in current directory)
cp Dockerfile.prod Dockerfile

# Update frontend to use backend URL
echo "   Configuring frontend to use backend: $BACKEND_URL"

gcloud run deploy $FRONTEND_SERVICE \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60 \
  --set-env-vars="REACT_APP_API_URL=$BACKEND_URL/api/users,REACT_APP_SOCKET_URL=$BACKEND_URL"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format 'value(status.url)')

# Deployment complete!
echo ""
echo "============================================="
echo "✅ Deployment Complete!"
echo "============================================="
echo ""
echo "🌐 Your app is live at:"
echo "   Frontend: $FRONTEND_URL"
echo "   Backend:  $BACKEND_URL"
echo ""
echo "📧 Share this URL with your friends:"
echo "   👉 $FRONTEND_URL"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    gcloud run services logs tail $FRONTEND_SERVICE --region $REGION"
echo "   Update app:   Re-run this script"
echo "   Delete app:   gcloud run services delete $FRONTEND_SERVICE --region $REGION"
echo ""
echo "💡 Tips:"
echo "   - Login credentials: Use the admin/test users you created"
echo "   - First load may be slow (cold start)"
echo "   - Auto-scales based on traffic"
echo "   - Free tier: 2M requests/month"
echo ""
