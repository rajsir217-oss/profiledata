#!/bin/bash

# Map Custom Domain to Cloud Run Services
# Domain: l3v3lmatches.com

set -e

echo "=========================================="
echo "🌐 Mapping Domain to Cloud Run Services"
echo "=========================================="
echo ""

PROJECT_ID="matrimonial-staging"
REGION="us-central1"
DOMAIN="l3v3lmatches.com"

echo "Domain: $DOMAIN"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Step 1: Map domain to frontend (www.l3v3lmatches.com)
echo "=========================================="
echo "Step 1: Mapping www.$DOMAIN to Frontend"
echo "=========================================="
echo ""

gcloud run domain-mappings create \
  --service matrimonial-frontend \
  --domain www.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "✅ www.$DOMAIN mapped to matrimonial-frontend"
echo ""

# Step 2: Map domain to frontend (root domain - optional)
echo "=========================================="
echo "Step 2: Mapping $DOMAIN to Frontend"
echo "=========================================="
echo ""

gcloud run domain-mappings create \
  --service matrimonial-frontend \
  --domain $DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "✅ $DOMAIN mapped to matrimonial-frontend"
echo ""

# Step 3: Map API subdomain to backend
echo "=========================================="
echo "Step 3: Mapping api.$DOMAIN to Backend"
echo "=========================================="
echo ""

gcloud run domain-mappings create \
  --service matrimonial-backend \
  --domain api.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID

echo ""
echo "✅ api.$DOMAIN mapped to matrimonial-backend"
echo ""

# Step 4: Show DNS records to configure
echo "=========================================="
echo "📋 DNS Configuration Required"
echo "=========================================="
echo ""
echo "You need to add these DNS records in Google Cloud DNS:"
echo ""
echo "Getting DNS records for www.$DOMAIN..."
gcloud run domain-mappings describe www.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.resourceRecords)"

echo ""
echo "Getting DNS records for $DOMAIN..."
gcloud run domain-mappings describe $DOMAIN \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.resourceRecords)"

echo ""
echo "Getting DNS records for api.$DOMAIN..."
gcloud run domain-mappings describe api.$DOMAIN \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.resourceRecords)"

echo ""
echo "=========================================="
echo "✅ Domain Mapping Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "  1. Copy the DNS records shown above"
echo "  2. Go to Cloud DNS: https://console.cloud.google.com/net-services/dns"
echo "  3. Select your DNS zone for l3v3lmatches.com"
echo "  4. Add the CNAME records"
echo "  5. Wait for DNS propagation (5-30 minutes)"
echo "  6. Access your app at:"
echo "     - https://www.$DOMAIN"
echo "     - https://$DOMAIN"
echo "     - https://api.$DOMAIN"
echo ""
echo "🔒 SSL certificates will be automatically provisioned by Google"
echo ""
