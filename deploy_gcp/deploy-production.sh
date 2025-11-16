#!/bin/bash

# Production Deployment Script
# Deploys frontend and backend services to matrimonial-staging project
# Domain l3v3lmatches.com is managed via Cloud DNS in this project
#
# Usage:
#   ./deploy-production.sh [--show-logs=true|false]
#
# Options:
#   --show-logs=true   (default) Display all logs (LOG_LEVEL=INFO)
#   --show-logs=false  Show only critical errors (LOG_LEVEL=ERROR)
#
# Environment variable:
#   SHOW_LOGS=true|false

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
PROJECT="matrimonial-staging"
DOMAIN="l3v3lmatches.com"
REGION="us-central1"

# Parse command-line arguments
SHOW_LOGS="${SHOW_LOGS:-true}"  # Default to true

for arg in "$@"; do
  case $arg in
    --show-logs=*)
      SHOW_LOGS="${arg#*=}"
      shift
      ;;
    --no-logs)
      SHOW_LOGS="false"
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

# Determine log level based on SHOW_LOGS
if [[ "$SHOW_LOGS" == "false" ]]; then
  LOG_LEVEL="ERROR"
  LOG_MODE="PRODUCTION (errors only)"
else
  LOG_LEVEL="INFO"
  LOG_MODE="VERBOSE (all logs)"
fi

echo "============================================="
echo "🚀 Production Deployment"
echo "============================================="
echo ""
echo "Project:     $PROJECT"
echo "Domain:      $DOMAIN"
echo "Region:      $REGION"
echo "Log Level:   $LOG_LEVEL ($LOG_MODE)"
echo ""
echo "============================================="
echo ""

# Function to check project access
check_project_access() {
    local project=$1
    echo "🔍 Checking access to $project..."
    
    if gcloud projects describe "$project" &>/dev/null; then
        echo "   ✅ Access confirmed"
        return 0
    else
        echo "   ❌ No access to $project"
        echo ""
        echo "Please ensure you have access to: $PROJECT"
        exit 1
    fi
}

# Function to verify DNS
verify_dns() {
    echo ""
    echo "🌐 Verifying DNS configuration..."
    
    gcloud config set project "$PROJECT" &>/dev/null
    
    local dns_records=$(gcloud dns record-sets list \
        --zone=l3v3lmatches-zone \
        --name="$DOMAIN." \
        --type=A \
        --format="get(rrdatas)" 2>/dev/null || echo "")
    
    if [[ -z "$dns_records" ]]; then
        echo "   ❌ DNS A records not found!"
        echo ""
        echo "Check DNS zone in Google Cloud Console"
        exit 1
    fi
    
    echo "   ✅ DNS A records configured"
}

# Function to verify domain mapping
verify_domain_mapping() {
    echo ""
    echo "🔗 Verifying domain mapping..."
    
    gcloud config set project "$PROJECT" &>/dev/null
    
    local mapping=$(gcloud beta run domain-mappings describe \
        --domain "$DOMAIN" \
        --region "$REGION" \
        --format="get(metadata.name)" 2>/dev/null || echo "")
    
    if [[ -z "$mapping" ]]; then
        echo "   ⚠️  Domain mapping not found"
        echo ""
        read -p "Create domain mapping now? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            gcloud beta run domain-mappings create \
                --service matrimonial-frontend \
                --domain "$DOMAIN" \
                --region "$REGION" \
                --project "$PROJECT"
            echo "   ✅ Domain mapping created"
        else
            echo "   ⚠️  Continuing without domain mapping..."
        fi
    else
        echo "   ✅ Domain mapping exists"
    fi
}

# Check access to project
check_project_access "$PROJECT"

# Verify DNS configuration
verify_dns

# Ask what to deploy
echo ""
echo "What would you like to deploy?"
echo ""
echo "  1) Backend only"
echo "  2) Frontend only"
echo "  3) Both (recommended)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying Backend..."
        echo "   Log Level: $LOG_LEVEL"
        cd "$PROJECT_ROOT"
        LOG_LEVEL="$LOG_LEVEL" ./deploy_gcp/deploy_backend_simple.sh
        
        echo ""
        echo "🗄️  Running Database Migrations..."
        cd "$PROJECT_ROOT/fastapi_backend"
        python3 migrations/run_migrations.py || echo "⚠️  Migration warnings (non-fatal)"
        ;;
    2)
        echo ""
        echo "📦 Deploying Frontend..."
        echo "   Log Level: $LOG_LEVEL"
        cd "$PROJECT_ROOT"
        LOG_LEVEL="$LOG_LEVEL" ./deploy_gcp/deploy_frontend_full.sh
        ;;
    3)
        echo ""
        echo "📦 Deploying Backend..."
        echo "   Log Level: $LOG_LEVEL"
        cd "$PROJECT_ROOT"
        LOG_LEVEL="$LOG_LEVEL" ./deploy_gcp/deploy_backend_simple.sh
        
        echo ""
        echo "🗄️  Running Database Migrations..."
        cd "$PROJECT_ROOT/fastapi_backend"
        python3 migrations/run_migrations.py || echo "⚠️  Migration warnings (non-fatal)"
        
        echo ""
        echo "📦 Deploying Frontend..."
        echo "   Log Level: $LOG_LEVEL"
        cd "$PROJECT_ROOT"
        LOG_LEVEL="$LOG_LEVEL" ./deploy_gcp/deploy_frontend_full.sh
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Verify domain mapping after deployment
verify_domain_mapping

echo ""
echo "============================================="
echo "✅ Deployment Complete!"
echo "============================================="
echo ""
echo "Your site should be live at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Cloud Run URLs (for testing):"

gcloud config set project "$PROJECT" &>/dev/null

FRONTEND_URL=$(gcloud run services describe matrimonial-frontend \
    --region "$REGION" \
    --format='value(status.url)' 2>/dev/null || echo "Not deployed")

BACKEND_URL=$(gcloud run services describe matrimonial-backend \
    --region "$REGION" \
    --format='value(status.url)' 2>/dev/null || echo "Not deployed")

echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $BACKEND_URL"
echo ""

# Check SSL certificate status
echo "🔒 Checking SSL certificate status..."
CERT_STATUS=$(gcloud beta run domain-mappings describe \
    --domain "$DOMAIN" \
    --region "$REGION" \
    --format='value(status.conditions[1].message)' 2>/dev/null || echo "Unknown")

if [[ "$CERT_STATUS" == *"provisioned"* ]] || [[ "$CERT_STATUS" == *"Ready"* ]]; then
    echo "   ✅ SSL certificate ready"
elif [[ "$CERT_STATUS" == *"pending"* ]]; then
    echo "   ⏳ SSL certificate provisioning (5-30 minutes)"
    echo "      Certificate status: $CERT_STATUS"
else
    echo "   ⚠️  SSL certificate status: $CERT_STATUS"
fi

echo ""
echo "If you encounter issues:"
echo "  1. Check DNS: dig $DOMAIN +short"
echo "  2. Flush cache: sudo dscacheutil -flushcache"
echo "  3. Fix DNS: ./deploy_gcp/fix-domain-dns.sh"
echo "  4. See docs: DEPLOYMENT_ARCHITECTURE.md"
echo ""
