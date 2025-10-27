#!/bin/bash

# Full Cloud Run Deployment Script
# Deploys both backend and frontend to Google Cloud Run

set -e  # Exit on error

echo "=========================================="
echo "🚀 Full Cloud Run Deployment"
echo "=========================================="
echo ""
echo "This will deploy:"
echo "  1. Backend to Cloud Run"
echo "  2. Frontend to Cloud Run"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 0
fi

echo ""
echo "=========================================="
echo "Step 1: Deploying Backend"
echo "=========================================="
./deploy_backend_simple.sh

echo ""
echo "=========================================="
echo "Step 2: Deploying Frontend"
echo "=========================================="
./deploy_frontend_simple.sh

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Your application is now live on Cloud Run!"
echo ""
echo "📝 Next Steps:"
echo "  1. Test your application"
echo "  2. Check logs: gcloud logging tail --limit=50"
echo "  3. Run './switch-environment.sh local' to restore local config"
echo ""
