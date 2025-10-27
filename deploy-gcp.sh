#!/bin/bash

# GCP Deployment Script
# Deploys both backend and frontend to Google Cloud Platform

set -e  # Exit on error

echo "🚀 Google Cloud Platform Deployment"
echo "===================================="
echo ""

# Configuration
PROJECT_ID="profiledata-438623"
BACKEND_SERVICE="matrimonial-backend"
FRONTEND_SERVICE="matrimonial-frontend"
REGION="us-central1"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if user is logged in
echo -e "${BLUE}🔐 Checking GCP authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo -e "${RED}❌ Not logged in to GCP${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Set project
echo -e "${BLUE}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID
echo ""

# Ask what to deploy
echo "What would you like to deploy?"
echo "1) Backend only"
echo "2) Frontend only"
echo "3) Both (full deployment)"
echo "4) Update environment variables only"
read -p "Enter choice (1-4): " DEPLOY_CHOICE
echo ""

# Function to deploy backend
deploy_backend() {
    echo -e "${BLUE}🔧 Deploying Backend to Cloud Run...${NC}"
    echo "================================================"
    
    cd fastapi_backend
    
    # Create Dockerfile if it doesn't exist
    if [ ! -f "Dockerfile" ]; then
        echo -e "${YELLOW}⚠️ Dockerfile not found, creating one...${NC}"
        cat > Dockerfile << 'EOF'
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "main:socket_app", "--host", "0.0.0.0", "--port", "8080"]
EOF
    fi
    
    # Deploy to Cloud Run
    echo -e "${BLUE}📦 Building and deploying backend...${NC}"
    gcloud run deploy $BACKEND_SERVICE \
        --source . \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --min-instances 0 \
        --max-instances 10 \
        --memory 1Gi \
        --cpu 1 \
        --timeout 300 \
        --port 8080
    
    # Get backend URL
    BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
    echo -e "${GREEN}✅ Backend deployed to: $BACKEND_URL${NC}"
    echo ""
    
    cd ..
}

# Function to deploy frontend
deploy_frontend() {
    echo -e "${BLUE}🎨 Deploying Frontend to App Engine...${NC}"
    echo "================================================"
    
    cd frontend
    
    # Get backend URL if deploying frontend separately
    if [ -z "$BACKEND_URL" ]; then
        BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)' 2>/dev/null || echo "")
    fi
    
    if [ -z "$BACKEND_URL" ]; then
        echo -e "${RED}❌ Backend URL not found. Deploy backend first!${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}📝 Creating production environment file...${NC}"
    cat > .env.production << EOF
REACT_APP_ENVIRONMENT=production
REACT_APP_API_URL=$BACKEND_URL/api/users
REACT_APP_SOCKET_URL=$BACKEND_URL
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF
    
    # Build frontend
    echo -e "${BLUE}🔨 Building frontend...${NC}"
    REACT_APP_ENVIRONMENT=production npm run build
    
    # Create app.yaml if it doesn't exist
    if [ ! -f "app.yaml" ]; then
        echo -e "${YELLOW}⚠️ app.yaml not found, creating one...${NC}"
        cat > app.yaml << 'EOF'
runtime: nodejs20
service: default
instance_class: F2

handlers:
  - url: /static
    static_dir: build/static
    secure: always

  - url: /(.*\.(json|ico|js|txt))$
    static_files: build/\1
    upload: build/.*\.(json|ico|js|txt)$
    secure: always

  - url: /.*
    static_files: build/index.html
    upload: build/index.html
    secure: always

automatic_scaling:
  min_instances: 0
  max_instances: 10
EOF
    fi
    
    # Deploy to App Engine
    echo -e "${BLUE}📦 Deploying to App Engine...${NC}"
    gcloud app deploy --quiet
    
    # Get frontend URL
    FRONTEND_URL=$(gcloud app browse --no-launch-browser 2>&1 | grep -o 'https://[^[:space:]]*')
    echo -e "${GREEN}✅ Frontend deployed to: $FRONTEND_URL${NC}"
    echo ""
    
    cd ..
}

# Function to update environment variables
update_env_vars() {
    echo -e "${BLUE}🔧 Updating Backend Environment Variables...${NC}"
    echo "================================================"
    
    # Get current backend URL
    BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
    
    # Get frontend URL (App Engine default service)
    FRONTEND_URL="https://profiledata-pod.ue.r.appspot.com"
    
    echo "Current URLs:"
    echo "  Backend:  $BACKEND_URL"
    echo "  Frontend: $FRONTEND_URL"
    echo ""
    
    # Read production configuration
    source fastapi_backend/.env.production
    
    echo -e "${BLUE}Setting environment variables...${NC}"
    gcloud run services update $BACKEND_SERVICE \
        --region $REGION \
        --set-env-vars \
            MONGODB_URL="$MONGODB_URL",\
            DATABASE_NAME="$DATABASE_NAME",\
            REDIS_URL="$REDIS_URL",\
            BACKEND_URL="$BACKEND_URL",\
            FRONTEND_URL="$FRONTEND_URL",\
            APP_URL="$FRONTEND_URL",\
            USE_GCS="true",\
            GCS_BUCKET_NAME="matrimonial-images-prod",\
            GCS_PROJECT_ID="$PROJECT_ID",\
            SMTP_HOST="smtp.gmail.com",\
            SMTP_PORT="587",\
            FROM_EMAIL="noreply@l3v3l.com",\
            FROM_NAME="L3V3L Dating",\
            ENABLE_NOTIFICATIONS="true",\
            ENABLE_SCHEDULER="true",\
            ENABLE_WEBSOCKETS="true",\
            DEBUG_MODE="false",\
            LOG_LEVEL="INFO"
    
    echo -e "${GREEN}✅ Environment variables updated${NC}"
    echo ""
}

# Execute based on choice
case $DEPLOY_CHOICE in
    1)
        deploy_backend
        ;;
    2)
        deploy_frontend
        ;;
    3)
        deploy_backend
        deploy_frontend
        ;;
    4)
        update_env_vars
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Summary
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "📋 Deployment Summary:"
echo ""

if [ ! -z "$BACKEND_URL" ]; then
    echo -e "  ${BLUE}Backend:${NC}  $BACKEND_URL"
    echo -e "  ${BLUE}API Docs:${NC} $BACKEND_URL/docs"
fi

if [ ! -z "$FRONTEND_URL" ]; then
    echo -e "  ${BLUE}Frontend:${NC} $FRONTEND_URL"
fi

echo ""
echo "📝 Next Steps:"
echo "  1. Test the deployed application"
echo "  2. Check logs: gcloud logging tail"
echo "  3. Monitor: https://console.cloud.google.com"
echo ""
echo "🔒 To set sensitive secrets (recommended):"
echo "  ./set-gcp-secrets.sh"
echo ""
