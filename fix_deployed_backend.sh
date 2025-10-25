#!/bin/bash
# Fix Deployed Backend - Add MongoDB and Environment Variables

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Fix Deployed Backend - Add MongoDB Connection       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
BACKEND_SERVICE="matrimonial-backend"
FRONTEND_SERVICE="matrimonial-frontend"
REGION="us-central1"

# Get current service URLs
echo -e "${YELLOW}Step 1: Getting service URLs${NC}"
echo "======================================"
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format="value(status.url)" 2>/dev/null || echo "")
FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}❌ Backend service not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend URL: $BACKEND_URL${NC}"
echo -e "${GREEN}✅ Frontend URL: $FRONTEND_URL${NC}"

# Ask for MongoDB URL
echo ""
echo -e "${YELLOW}Step 2: MongoDB Configuration${NC}"
echo "======================================"
echo ""
echo "You need a remote MongoDB URL. Choose one:"
echo ""
echo "1. MongoDB Atlas (Recommended - FREE)"
echo "   - Run: ./migrate_mongodb_to_cloud.sh"
echo "   - Or set up at: https://www.mongodb.com/cloud/atlas/register"
echo ""
echo "2. Already have MongoDB URL"
echo ""

read -p "Do you have a MongoDB URL ready? (y/n): " has_mongodb

if [ "$has_mongodb" != "y" ]; then
    echo ""
    echo -e "${YELLOW}📝 Please set up MongoDB first:${NC}"
    echo ""
    echo "Quick MongoDB Atlas Setup (5 minutes):"
    echo "1. Go to: https://www.mongodb.com/cloud/atlas/register"
    echo "2. Create FREE cluster (M0 Sandbox)"
    echo "3. Create database user"
    echo "4. Get connection string"
    echo ""
    echo "Or run this script to migrate your local data:"
    echo "  ./migrate_mongodb_to_cloud.sh"
    echo ""
    echo "Then run this script again!"
    exit 0
fi

echo ""
read -p "Enter MongoDB connection URL: " MONGODB_URL

if [ -z "$MONGODB_URL" ]; then
    echo -e "${RED}❌ No MongoDB URL provided${NC}"
    exit 1
fi

# Test MongoDB connection
echo ""
echo "Testing MongoDB connection..."
if mongosh "$MONGODB_URL" --eval "db.version()" --quiet > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MongoDB connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Could not test MongoDB connection${NC}"
    echo "This might be OK if mongosh is not installed locally"
    read -p "Continue anyway? (y/n): " continue_anyway
    if [ "$continue_anyway" != "y" ]; then
        exit 0
    fi
fi

# Optional: Redis URL
echo ""
echo -e "${YELLOW}Step 3: Redis Configuration (Optional)${NC}"
echo "======================================"
echo ""
read -p "Enter Redis URL (press Enter to skip): " REDIS_URL

if [ -z "$REDIS_URL" ]; then
    REDIS_URL="redis://localhost:6379"
    echo -e "${YELLOW}⏭️  Skipping Redis (some features may not work)${NC}"
fi

# Optional: SMTP Configuration
echo ""
echo -e "${YELLOW}Step 4: Email Configuration (Optional)${NC}"
echo "======================================"
echo ""
read -p "Configure email notifications? (y/n): " configure_email

if [ "$configure_email" = "y" ]; then
    read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
    read -p "SMTP Port (e.g., 587): " SMTP_PORT
    read -p "SMTP User: " SMTP_USER
    read -p "SMTP Password: " SMTP_PASSWORD
    read -p "From Email: " FROM_EMAIL
    read -p "From Name: " FROM_NAME
    EMAIL_VARS="SMTP_HOST=$SMTP_HOST,SMTP_PORT=$SMTP_PORT,SMTP_USER=$SMTP_USER,SMTP_PASSWORD=$SMTP_PASSWORD,FROM_EMAIL=$FROM_EMAIL,FROM_NAME=$FROM_NAME"
else
    EMAIL_VARS=""
fi

# Update backend service
echo ""
echo -e "${YELLOW}Step 5: Updating Backend Service${NC}"
echo "======================================"

ENV_VARS="MONGODB_URL=$MONGODB_URL,DATABASE_NAME=matrimonialDB,REDIS_URL=$REDIS_URL,FRONTEND_URL=$FRONTEND_URL"

if [ -n "$EMAIL_VARS" ]; then
    ENV_VARS="$ENV_VARS,$EMAIL_VARS"
fi

echo "Updating environment variables..."
gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --set-env-vars "$ENV_VARS" \
    --quiet

echo -e "${GREEN}✅ Backend updated${NC}"

# Wait for deployment
echo ""
echo "Waiting for backend to restart..."
sleep 10

# Test backend
echo ""
echo -e "${YELLOW}Step 6: Testing Backend${NC}"
echo "======================================"

echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health" || echo "failed")

if [ "$HEALTH_RESPONSE" != "failed" ]; then
    echo -e "${GREEN}✅ Backend is responding!${NC}"
    echo "Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ Backend is not responding yet${NC}"
    echo "Check logs: gcloud run services logs read $BACKEND_SERVICE --region $REGION"
fi

# Update frontend if needed
echo ""
echo -e "${YELLOW}Step 7: Update Frontend Configuration${NC}"
echo "======================================"

echo "The frontend needs to know the backend URL."
echo "Current backend URL: $BACKEND_URL"
echo ""

read -p "Update frontend environment? (y/n): " update_frontend

if [ "$update_frontend" = "y" ]; then
    gcloud run services update "$FRONTEND_SERVICE" \
        --region "$REGION" \
        --set-env-vars "REACT_APP_API_URL=$BACKEND_URL" \
        --quiet
    echo -e "${GREEN}✅ Frontend updated${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║           🎉 UPDATE COMPLETE! 🎉                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}📊 Configuration Summary:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "🌐 Frontend:  ${GREEN}$FRONTEND_URL${NC}"
echo -e "🔧 Backend:   ${GREEN}$BACKEND_URL${NC}"
echo -e "🗄️  MongoDB:   ${GREEN}Configured${NC}"
echo -e "🔴 Redis:     ${GREEN}${REDIS_URL}${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Visit frontend: $FRONTEND_URL"
echo "2. Try logging in!"
echo "3. If issues, check logs:"
echo "   gcloud run services logs read $BACKEND_SERVICE --region $REGION"

echo ""
echo -e "${GREEN}✅ Your app should be working now!${NC}"
