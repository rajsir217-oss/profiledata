#!/bin/bash

# Deploy Everything - Simple and Clean
# This script deploys both frontend and backend

set -e

echo "=========================================="
echo "🚀 Complete Deployment"
echo "=========================================="
echo ""

# Deploy backend first
echo "📦 Step 1: Deploying Backend..."
chmod +x deploy_backend_simple.sh
./deploy_backend_simple.sh

echo ""
echo "⏸️  Waiting 10 seconds for backend to stabilize..."
sleep 10

# Deploy frontend
echo ""
echo "📦 Step 2: Deploying Frontend..."
chmod +x deploy_frontend_simple.sh
./deploy_frontend_simple.sh

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Your URLs:"
echo ""
echo "Backend:"
gcloud run services describe matrimonial-backend \
  --region us-central1 \
  --format "value(status.url)"
echo ""
echo "Frontend:"
gcloud run services describe matrimonial-frontend \
  --region us-central1 \
  --format "value(status.url)"
echo ""
echo "📖 Next: See DEPLOY_FROM_SCRATCH.md for testing instructions"
