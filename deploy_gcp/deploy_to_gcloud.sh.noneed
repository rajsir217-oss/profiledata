#!/bin/bash
# Complete Google Cloud Deployment Script
# Deploys Backend, Frontend, and migrates MongoDB data

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Google Cloud Deployment - Matrimonial App          ║"
echo "║   Backend + Frontend + MongoDB Migration             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
PROJECT_ID="matrimonial-prod"
REGION="us-central1"
BACKEND_SERVICE="matrimonial-backend"
FRONTEND_SERVICE="matrimonial-frontend"

# Step 1: Export MongoDB
echo -e "${YELLOW}Step 1: Export Local MongoDB${NC}"
echo "======================================"
read -p "Export local MongoDB data? (y/n): " export_mongo
if [ "$export_mongo" = "y" ]; then
    chmod +x export_mongodb.sh
    ./export_mongodb.sh
    echo -e "${GREEN}✅ MongoDB exported${NC}"
else
    echo -e "${YELLOW}⏭️  Skipped MongoDB export${NC}"
fi

# Step 2: MongoDB Atlas Setup
echo ""
echo -e "${YELLOW}Step 2: MongoDB Atlas Setup${NC}"
echo "======================================"
echo "1. Go to: https://www.mongodb.com/cloud/atlas/register"
echo "2. Create FREE cluster (M0 Sandbox)"
echo "3. Create database user"
echo "4. Get connection string"
echo ""
read -p "Have you created MongoDB Atlas cluster? (y/n): " atlas_ready
if [ "$atlas_ready" != "y" ]; then
    echo -e "${RED}❌ Please create MongoDB Atlas cluster first${NC}"
    echo "See GOOGLE_CLOUD_DEPLOYMENT.md for detailed instructions"
    exit 1
fi

read -p "Enter MongoDB Atlas connection string: " MONGODB_URL
echo -e "${GREEN}✅ MongoDB Atlas configured${NC}"

# Step 3: Import MongoDB Data
echo ""
echo -e "${YELLOW}Step 3: Import Data to MongoDB Atlas${NC}"
echo "======================================"
read -p "Import local data to Atlas? (y/n): " import_data
if [ "$import_data" = "y" ]; then
    echo "Finding latest backup..."
    LATEST_BACKUP=$(ls -t mongodb_backup_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo -e "${RED}❌ No backup found! Run ./export_mongodb.sh first${NC}"
        exit 1
    fi
    
    echo "Found: $LATEST_BACKUP"
    echo "Extracting..."
    tar -xzf "$LATEST_BACKUP"
    
    BACKUP_DIR=$(basename "$LATEST_BACKUP" .tar.gz)
    echo "Importing to Atlas..."
    
    mongorestore \
        --uri="$MONGODB_URL" \
        --db matrimonialDB \
        "$BACKUP_DIR/matrimonialDB/" \
        --drop
    
    echo -e "${GREEN}✅ Data imported to Atlas${NC}"
    
    # Cleanup
    rm -rf "$BACKUP_DIR"
else
    echo -e "${YELLOW}⏭️  Skipped data import${NC}"
fi

# Step 4: Redis Setup
echo ""
echo -e "${YELLOW}Step 4: Redis Setup${NC}"
echo "======================================"
echo "Option 1: Redis Cloud (FREE) - https://redis.io/cloud/"
echo "Option 2: Skip Redis for now"
echo ""
read -p "Enter Redis URL (or press Enter to skip): " REDIS_URL
if [ -z "$REDIS_URL" ]; then
    REDIS_URL="redis://localhost:6379"
    echo -e "${YELLOW}⏭️  Using default Redis URL (will fail in cloud)${NC}"
else
    echo -e "${GREEN}✅ Redis configured${NC}"
fi

# Step 5: GCP Setup
echo ""
echo -e "${YELLOW}Step 5: Google Cloud Setup${NC}"
echo "======================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud SDK not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Not logged in to Google Cloud"
    read -p "Login now? (y/n): " do_login
    if [ "$do_login" = "y" ]; then
        gcloud auth login
    else
        echo -e "${RED}❌ Must be logged in to continue${NC}"
        exit 1
    fi
fi

# Check/Create project
echo "Checking project..."
if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "Project '$PROJECT_ID' not found"
    read -p "Create project '$PROJECT_ID'? (y/n): " create_project
    if [ "$create_project" = "y" ]; then
        gcloud projects create "$PROJECT_ID" --name="Matrimonial App"
        echo -e "${GREEN}✅ Project created${NC}"
    else
        read -p "Enter existing project ID: " PROJECT_ID
    fi
fi

# Set active project
gcloud config set project "$PROJECT_ID"
echo -e "${GREEN}✅ Using project: $PROJECT_ID${NC}"

# Enable APIs
echo ""
echo "Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com \
    --quiet

echo -e "${GREEN}✅ APIs enabled${NC}"

# Step 6: Create Secrets
echo ""
echo -e "${YELLOW}Step 6: Store Secrets${NC}"
echo "======================================"

# Store MongoDB URL
echo -n "$MONGODB_URL" | gcloud secrets create mongodb-url --data-file=- --replication-policy="automatic" || \
    echo -n "$MONGODB_URL" | gcloud secrets versions add mongodb-url --data-file=-
echo -e "${GREEN}✅ MongoDB URL stored${NC}"

# Store Redis URL
echo -n "$REDIS_URL" | gcloud secrets create redis-url --data-file=- --replication-policy="automatic" || \
    echo -n "$REDIS_URL" | gcloud secrets versions add redis-url --data-file=-
echo -e "${GREEN}✅ Redis URL stored${NC}"

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" || \
    echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
echo -e "${GREEN}✅ JWT secret generated and stored${NC}"

# Step 7: Deploy Backend
echo ""
echo -e "${YELLOW}Step 7: Deploy Backend${NC}"
echo "======================================"

cd fastapi_backend

echo "Building and deploying backend to Cloud Run..."
gcloud run deploy "$BACKEND_SERVICE" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --set-secrets MONGODB_URL=mongodb-url:latest,REDIS_URL=redis-url:latest,SECRET_KEY=jwt-secret:latest \
    --set-env-vars DATABASE_NAME=matrimonialDB,FRONTEND_URL=https://matrimonial-frontend-${PROJECT_ID}.run.app \
    --quiet

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format="value(status.url)")
echo -e "${GREEN}✅ Backend deployed!${NC}"
echo -e "${BLUE}🌐 Backend URL: $BACKEND_URL${NC}"

cd ..

# Step 8: Deploy Frontend
echo ""
echo -e "${YELLOW}Step 8: Deploy Frontend${NC}"
echo "======================================"

cd frontend

# Create production .env
cat > .env.production << EOF
REACT_APP_API_URL=$BACKEND_URL
REACT_APP_WS_URL=${BACKEND_URL/https/wss}
EOF

echo "Building and deploying frontend to Cloud Run..."
gcloud run deploy "$FRONTEND_SERVICE" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --quiet

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format="value(status.url)")
echo -e "${GREEN}✅ Frontend deployed!${NC}"
echo -e "${BLUE}🌐 Frontend URL: $FRONTEND_URL${NC}"

cd ..

# Step 9: Update Backend with Frontend URL
echo ""
echo -e "${YELLOW}Step 9: Update CORS Configuration${NC}"
echo "======================================"

gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --update-env-vars FRONTEND_URL="$FRONTEND_URL" \
    --quiet

echo -e "${GREEN}✅ CORS updated${NC}"

# Step 10: Summary
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║           🎉 DEPLOYMENT SUCCESSFUL! 🎉                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "🌐 Frontend:  ${GREEN}$FRONTEND_URL${NC}"
echo -e "🔧 Backend:   ${GREEN}$BACKEND_URL${NC}"
echo -e "🗄️  MongoDB:   ${GREEN}MongoDB Atlas${NC}"
echo -e "🔴 Redis:     ${GREEN}Configured${NC}"
echo -e "📦 Project:   ${GREEN}$PROJECT_ID${NC}"
echo -e "🌍 Region:    ${GREEN}$REGION${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Visit your app: $FRONTEND_URL"
echo "2. Test the backend: $BACKEND_URL/docs"
echo "3. Check logs: gcloud run services logs read $BACKEND_SERVICE --region $REGION"
echo "4. Monitor in console: https://console.cloud.google.com/run"

echo ""
echo -e "${YELLOW}💰 Estimated Cost:${NC}"
echo "- Within free tier for low traffic"
echo "- Monitor usage: https://console.cloud.google.com/billing"

echo ""
echo -e "${GREEN}✅ All done! Your app is live on Google Cloud!${NC}"
