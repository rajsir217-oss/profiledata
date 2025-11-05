#!/bin/bash

# Step 1: Create Cloud DNS Zone for l3v3lmatches.com

set -e

DOMAIN="l3v3lmatches.com"
PROJECT_ID="matrimonial-staging"
ZONE_NAME="l3v3lmatches-zone"

echo "=========================================="
echo "🌐 Creating Cloud DNS Zone"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Project: $PROJECT_ID"
echo "Zone Name: $ZONE_NAME"
echo ""

# Create the DNS zone
echo "Creating DNS zone..."
gcloud dns managed-zones create $ZONE_NAME \
  --dns-name="$DOMAIN." \
  --description="DNS zone for $DOMAIN" \
  --project=$PROJECT_ID

echo ""
echo "✅ DNS zone created successfully!"
echo ""

# Get the name servers
echo "=========================================="
echo "📋 Name Servers for Your Domain"
echo "=========================================="
echo ""
echo "Copy these name servers and add them to Google Domains:"
echo ""

gcloud dns managed-zones describe $ZONE_NAME \
  --project=$PROJECT_ID \
  --format="value(nameServers)"

echo ""
echo "=========================================="
echo "✅ Next Steps"
echo "=========================================="
echo ""
echo "1. Go to https://domains.google.com"
echo "2. Click on $DOMAIN"
echo "3. Navigate to DNS settings"
echo "4. Click 'Use custom name servers'"
echo "5. Paste the 4 name servers shown above"
echo "6. Click Save"
echo "7. Wait 5-30 minutes for DNS propagation"
echo "8. Run: ./2-map-domains.sh"
echo ""
