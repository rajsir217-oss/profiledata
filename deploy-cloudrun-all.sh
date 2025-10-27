#!/bin/bash

# Full Cloud Run Deployment Script
# Deploys both backend and frontend to Google Cloud Run

set -e  # Exit on error

# Trap errors and restore local environment
trap 'echo ""; echo "❌ Deployment failed!"; echo "🔄 Restoring local environment..."; ./switch-environment.sh local; exit 1' ERR

echo "=========================================="
echo "🚀 Full Cloud Run Deployment"
echo "=========================================="
echo ""

# Step 1: Switch to production environment
echo "📝 Step 1: Switching to production environment..."
echo ""
./switch-environment.sh pod
echo ""

# Step 2: Run pre-deployment checks
echo "=========================================="
echo "📋 Step 2: Running Pre-Deployment Checks"
echo "=========================================="
echo ""
./pre-deploy-check.sh
echo ""

# Check if pre-deploy check passed
if [ $? -ne 0 ]; then
    echo "❌ Pre-deployment checks failed!"
    echo "Please fix the errors and try again."
    echo ""
    echo "Restoring local environment..."
    ./switch-environment.sh local
    exit 1
fi

# Step 3: Confirm deployment
echo "=========================================="
echo "🚀 Ready to Deploy"
echo "=========================================="
echo ""
echo "This will deploy:"
echo "  1. Backend to Cloud Run"
echo "  2. Frontend to Cloud Run"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    echo ""
    echo "Restoring local environment..."
    ./switch-environment.sh local
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

# Automatically switch back to local environment
echo "🔄 Restoring local environment..."
./switch-environment.sh local
echo ""

echo "=========================================="
echo "📝 Next Steps"
echo "=========================================="
echo "  1. Test your application at the URLs above"
echo "  2. Check logs: gcloud logging tail --limit=50"
echo "  3. Monitor: https://console.cloud.google.com/run"
echo ""
echo "✅ Local development environment restored"
echo ""
