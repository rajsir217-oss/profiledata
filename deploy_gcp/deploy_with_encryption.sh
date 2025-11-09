#!/bin/bash
# deploy_with_encryption.sh - Production deployment script with encryption setup
# Usage: ./deploy_with_encryption.sh [--setup-encryption] [--rotate-key]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="profiledata-438623"
REGION="us-central1"
SERVICE_NAME="matrimonial-backend"
SERVICE_ACCOUNT="matrimonial-backend@${PROJECT_ID}.iam.gserviceaccount.com"

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}   ProfileData Production Deployment${NC}"
echo -e "${BLUE}   With PII Encryption Setup${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Parse arguments
SETUP_ENCRYPTION=false
ROTATE_KEY=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --setup-encryption) SETUP_ENCRYPTION=true ;;
        --rotate-key) ROTATE_KEY=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Function: Generate encryption key
generate_encryption_key() {
    echo -e "${BLUE}🔐 Generating new encryption key...${NC}"
    cd ../fastapi_backend
    KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    cd ../deploy_gcp
    echo "$KEY"
}

# Function: Setup encryption in GCP Secret Manager
setup_encryption() {
    echo -e "${YELLOW}📋 Setting up PII encryption in production...${NC}"
    echo ""
    
    # Check if secret already exists
    if gcloud secrets describe ENCRYPTION_KEY --project=$PROJECT_ID &>/dev/null; then
        echo -e "${YELLOW}⚠️  ENCRYPTION_KEY secret already exists!${NC}"
        echo -e "${YELLOW}   Use --rotate-key to change it safely.${NC}"
        echo ""
        return 1
    fi
    
    # Generate key
    echo -e "${BLUE}1. Generating new encryption key...${NC}"
    NEW_KEY=$(generate_encryption_key)
    
    # Confirm with user
    echo -e "${GREEN}Generated key: ${NEW_KEY}${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  CRITICAL: Save this key in a secure location NOW!${NC}"
    echo -e "${YELLOW}   - Password manager (1Password, LastPass)${NC}"
    echo -e "${YELLOW}   - Encrypted vault${NC}"
    echo -e "${YELLOW}   - Team secure documentation${NC}"
    echo ""
    read -p "Have you saved the key? (yes/no): " SAVED
    
    if [ "$SAVED" != "yes" ]; then
        echo -e "${RED}❌ Aborted. Please save the key before continuing.${NC}"
        exit 1
    fi
    
    # Create secret in GCP
    echo -e "${BLUE}2. Creating secret in GCP Secret Manager...${NC}"
    echo -n "$NEW_KEY" | gcloud secrets create ENCRYPTION_KEY \
        --data-file=- \
        --replication-policy="automatic" \
        --project=$PROJECT_ID
    
    echo -e "${GREEN}✅ Secret created successfully${NC}"
    
    # Grant access to Cloud Run service account
    echo -e "${BLUE}3. Granting access to Cloud Run service account...${NC}"
    gcloud secrets add-iam-policy-binding ENCRYPTION_KEY \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
    
    echo -e "${GREEN}✅ Service account access granted${NC}"
    echo ""
}

# Function: Rotate encryption key
rotate_encryption_key() {
    echo -e "${YELLOW}🔄 Rotating encryption key (ADVANCED OPERATION)...${NC}"
    echo ""
    echo -e "${RED}⚠️  WARNING: This is a complex operation!${NC}"
    echo -e "${RED}   You must decrypt all data with old key and re-encrypt with new key.${NC}"
    echo -e "${RED}   See KEY_ROTATION_GUIDE.md for detailed instructions.${NC}"
    echo ""
    read -p "Have you read KEY_ROTATION_GUIDE.md and prepared? (yes/no): " PREPARED
    
    if [ "$PREPARED" != "yes" ]; then
        echo -e "${YELLOW}Please read KEY_ROTATION_GUIDE.md first.${NC}"
        exit 1
    fi
    
    # Generate new key
    echo -e "${BLUE}1. Generating new encryption key...${NC}"
    NEW_KEY=$(generate_encryption_key)
    
    echo -e "${GREEN}New key: ${NEW_KEY}${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Save this NEW key securely!${NC}"
    echo ""
    read -p "Saved new key? (yes/no): " SAVED
    
    if [ "$SAVED" != "yes" ]; then
        echo -e "${RED}❌ Aborted.${NC}"
        exit 1
    fi
    
    # Create new version of secret
    echo -e "${BLUE}2. Creating new version in Secret Manager...${NC}"
    echo -n "$NEW_KEY" | gcloud secrets versions add ENCRYPTION_KEY \
        --data-file=- \
        --project=$PROJECT_ID
    
    echo -e "${GREEN}✅ New key version created${NC}"
    echo ""
    echo -e "${YELLOW}📋 NEXT STEPS (MANUAL):${NC}"
    echo -e "1. Run key rotation migration script"
    echo -e "2. Verify all data is re-encrypted"
    echo -e "3. Restart Cloud Run service"
    echo -e "4. Disable old secret version"
    echo ""
    echo -e "See KEY_ROTATION_GUIDE.md for detailed steps."
}

# Function: Deploy to Cloud Run
deploy_to_cloud_run() {
    echo -e "${BLUE}🚀 Deploying to Cloud Run...${NC}"
    
    cd ..
    
    # Build and deploy
    echo -e "${BLUE}Building Docker image...${NC}"
    gcloud builds submit \
        --config=deploy_gcp/cloudbuild.yaml \
        --project=$PROJECT_ID
    
    echo -e "${BLUE}Deploying to Cloud Run...${NC}"
    gcloud run services update $SERVICE_NAME \
        --update-secrets=ENCRYPTION_KEY=ENCRYPTION_KEY:latest \
        --region=$REGION \
        --project=$PROJECT_ID
    
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    
    cd deploy_gcp
}

# Function: Verify encryption is working
verify_encryption() {
    echo -e "${BLUE}🔍 Verifying encryption setup...${NC}"
    
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(status.url)')
    
    echo -e "${BLUE}Testing health check endpoint...${NC}"
    RESPONSE=$(curl -s "${SERVICE_URL}/health/encryption")
    
    if echo "$RESPONSE" | grep -q '"encryption_enabled":true'; then
        echo -e "${GREEN}✅ Encryption is enabled and working!${NC}"
        echo "$RESPONSE" | python3 -m json.tool
    else
        echo -e "${RED}❌ Encryption verification failed!${NC}"
        echo "$RESPONSE"
        exit 1
    fi
}

# Main execution flow
main() {
    echo -e "${BLUE}Project: ${PROJECT_ID}${NC}"
    echo -e "${BLUE}Region: ${REGION}${NC}"
    echo -e "${BLUE}Service: ${SERVICE_NAME}${NC}"
    echo ""
    
    # Handle encryption setup
    if [ "$SETUP_ENCRYPTION" = true ]; then
        setup_encryption
        echo ""
    fi
    
    # Handle key rotation
    if [ "$ROTATE_KEY" = true ]; then
        rotate_encryption_key
        exit 0  # Don't deploy when rotating, user must run migration first
    fi
    
    # Normal deployment
    echo -e "${YELLOW}📦 Starting deployment process...${NC}"
    echo ""
    
    # Check if encryption key exists
    if ! gcloud secrets describe ENCRYPTION_KEY --project=$PROJECT_ID &>/dev/null; then
        echo -e "${RED}❌ ENCRYPTION_KEY not found in Secret Manager!${NC}"
        echo -e "${YELLOW}Run with --setup-encryption first:${NC}"
        echo -e "   ./deploy_with_encryption.sh --setup-encryption"
        exit 1
    fi
    
    deploy_to_cloud_run
    
    echo ""
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"
    verify_encryption
    
    echo ""
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}   ✅ Deployment Successful!${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo -e "1. Test profile updates in production"
    echo -e "2. Verify PII data is encrypted in MongoDB"
    echo -e "3. Monitor logs for any decryption errors"
    echo -e "4. Backup encryption key in secure location"
    echo ""
    echo -e "${BLUE}Service URL:${NC}"
    gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format='value(status.url)'
    echo ""
}

# Run main
main
