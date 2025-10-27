#!/bin/bash

# GCP Secrets Management Script
# Securely store sensitive credentials in Google Secret Manager

set -e

echo "🔐 GCP Secret Manager Setup"
echo "============================"
echo ""

PROJECT_ID="profiledata-438623"
BACKEND_SERVICE="matrimonial-backend"
REGION="us-central1"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📋 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID
echo ""

# Function to create or update a secret
create_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    # Check if secret exists
    if gcloud secrets describe $SECRET_NAME &>/dev/null; then
        echo -e "${YELLOW}Updating existing secret: $SECRET_NAME${NC}"
        echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=-
    else
        echo -e "${BLUE}Creating new secret: $SECRET_NAME${NC}"
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=-
    fi
}

# Function to grant access to Cloud Run
grant_access() {
    local SECRET_NAME=$1
    
    # Get Cloud Run service account
    SERVICE_ACCOUNT=$(gcloud run services describe $BACKEND_SERVICE \
        --region $REGION \
        --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null)
    
    if [ -z "$SERVICE_ACCOUNT" ]; then
        SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"
    fi
    
    echo -e "${BLUE}Granting access to: $SERVICE_ACCOUNT${NC}"
    gcloud secrets add-iam-policy-binding $SECRET_NAME \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
}

echo "This script will help you securely store sensitive credentials."
echo "You can skip any secret by pressing Enter."
echo ""

# JWT Secret Key
echo -e "${BLUE}1. JWT Secret Key${NC}"
read -sp "Enter SECRET_KEY (or press Enter to skip): " SECRET_KEY
echo ""
if [ ! -z "$SECRET_KEY" ]; then
    create_secret "jwt-secret-key" "$SECRET_KEY"
    grant_access "jwt-secret-key"
    echo -e "${GREEN}✅ JWT secret stored${NC}"
fi
echo ""

# SMTP Password
echo -e "${BLUE}2. SMTP Configuration${NC}"
read -p "Enter SMTP_USER (email): " SMTP_USER
if [ ! -z "$SMTP_USER" ]; then
    create_secret "smtp-user" "$SMTP_USER"
    grant_access "smtp-user"
fi

read -sp "Enter SMTP_PASSWORD: " SMTP_PASSWORD
echo ""
if [ ! -z "$SMTP_PASSWORD" ]; then
    create_secret "smtp-password" "$SMTP_PASSWORD"
    grant_access "smtp-password"
    echo -e "${GREEN}✅ SMTP credentials stored${NC}"
fi
echo ""

# Twilio (Optional)
echo -e "${BLUE}3. Twilio SMS Configuration (Optional)${NC}"
read -p "Enter TWILIO_ACCOUNT_SID (or press Enter to skip): " TWILIO_SID
if [ ! -z "$TWILIO_SID" ]; then
    create_secret "twilio-account-sid" "$TWILIO_SID"
    grant_access "twilio-account-sid"
    
    read -sp "Enter TWILIO_AUTH_TOKEN: " TWILIO_TOKEN
    echo ""
    create_secret "twilio-auth-token" "$TWILIO_TOKEN"
    grant_access "twilio-auth-token"
    
    read -p "Enter TWILIO_FROM_PHONE: " TWILIO_PHONE
    create_secret "twilio-from-phone" "$TWILIO_PHONE"
    grant_access "twilio-from-phone"
    
    echo -e "${GREEN}✅ Twilio credentials stored${NC}"
fi
echo ""

# Update Cloud Run service to use secrets
echo -e "${BLUE}🔧 Updating Cloud Run service to use secrets...${NC}"

UPDATE_CMD="gcloud run services update $BACKEND_SERVICE --region $REGION"

if [ ! -z "$SECRET_KEY" ]; then
    UPDATE_CMD="$UPDATE_CMD --update-secrets=SECRET_KEY=jwt-secret-key:latest"
fi

if [ ! -z "$SMTP_USER" ]; then
    UPDATE_CMD="$UPDATE_CMD --update-secrets=SMTP_USER=smtp-user:latest"
fi

if [ ! -z "$SMTP_PASSWORD" ]; then
    UPDATE_CMD="$UPDATE_CMD --update-secrets=SMTP_PASSWORD=smtp-password:latest"
fi

if [ ! -z "$TWILIO_SID" ]; then
    UPDATE_CMD="$UPDATE_CMD --update-secrets=TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_FROM_PHONE=twilio-from-phone:latest"
fi

if [ "$UPDATE_CMD" != "gcloud run services update $BACKEND_SERVICE --region $REGION" ]; then
    eval $UPDATE_CMD
    echo -e "${GREEN}✅ Cloud Run service updated with secrets${NC}"
else
    echo -e "${YELLOW}⚠️ No secrets to update${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}🎉 Secrets Configuration Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "📋 Stored Secrets:"
gcloud secrets list --format="table(name,createTime)"
echo ""
echo "🔒 Your secrets are now securely stored in Google Secret Manager"
echo "   and accessible only by your Cloud Run service."
echo ""
