#!/bin/bash

# Add DNS Records for Cloud Run Domain Mappings

set -e

DOMAIN="l3v3lmatches.com"
ZONE_NAME="l3v3lmatches-zone"
PROJECT_ID="matrimonial-staging"

echo "=========================================="
echo "📋 Adding DNS Records"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Zone: $ZONE_NAME"
echo "Project: $PROJECT_ID"
echo ""

# Record 1: WWW CNAME
echo "Adding www CNAME record..."
gcloud dns record-sets create www.$DOMAIN. \
  --zone=$ZONE_NAME \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=$PROJECT_ID

echo "✅ www.$DOMAIN → ghs.googlehosted.com."
echo ""

# Record 2: Root domain A records
echo "Adding root domain A records..."
gcloud dns record-sets create $DOMAIN. \
  --zone=$ZONE_NAME \
  --type=A \
  --ttl=300 \
  --rrdatas="216.239.32.21,216.239.34.21,216.239.36.21,216.239.38.21" \
  --project=$PROJECT_ID

echo "✅ $DOMAIN → 216.239.32.21 (+ 3 more IPs)"
echo ""

# Record 3: API CNAME
echo "Adding api CNAME record..."
gcloud dns record-sets create api.$DOMAIN. \
  --zone=$ZONE_NAME \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=$PROJECT_ID

echo "✅ api.$DOMAIN → ghs.googlehosted.com."
echo ""

echo "=========================================="
echo "✅ All DNS Records Added!"
echo "=========================================="
echo ""
echo "DNS records added:"
echo "  1. www.$DOMAIN → ghs.googlehosted.com"
echo "  2. $DOMAIN → 216.239.32.21, 216.239.34.21, 216.239.36.21, 216.239.38.21"
echo "  3. api.$DOMAIN → ghs.googlehosted.com"
echo ""
echo "Next steps:"
echo "  1. Wait 5-15 minutes for DNS propagation"
echo "  2. Check: https://dnschecker.org/#A/l3v3lmatches.com"
echo "  3. Wait for SSL certificates (15 min - 2 hours)"
echo "  4. Check status: gcloud beta run domain-mappings list --region=us-central1"
echo "  5. Your app will be live at:"
echo "     - https://www.l3v3lmatches.com"
echo "     - https://l3v3lmatches.com"
echo "     - https://api.l3v3lmatches.com"
echo ""
