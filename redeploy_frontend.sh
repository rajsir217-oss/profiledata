#!/bin/bash

# Quick script to redeploy frontend with correct backend URL

set -e

echo "🔄 Redeploying Frontend with Correct Backend URL"
echo "================================================"
echo ""

# Backend URL
BACKEND_URL="https://matrimonial-backend-7cxoxmouuq-uc.a.run.app"
PROJECT_ID="matrimonial-staging"
REGION="us-central1"
FRONTEND_SERVICE="matrimonial-frontend"

echo "📦 Configuration:"
echo "   Backend URL: $BACKEND_URL"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Navigate to frontend
cd frontend

# Create runtime config.js with production URLs
cat > public/config.js << EOF
// Runtime configuration - DO NOT COMMIT
window.RUNTIME_CONFIG = {
  API_URL: '${BACKEND_URL}/api/users',
  SOCKET_URL: '${BACKEND_URL}'
};
EOF

echo "✅ Created public/config.js with backend URL"
echo ""

# Create Dockerfile
cat > Dockerfile << 'DOCKERFILE_END'
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source (including public/config.js)
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built app
COPY --from=builder /app/build ./build

# Expose port
EXPOSE 8080

# Serve the app
CMD ["serve", "-s", "build", "-l", "8080"]
DOCKERFILE_END

echo "✅ Created Dockerfile"
echo ""

echo "🔨 Building and deploying frontend..."
echo "   This may take 5-10 minutes..."
echo ""

# Deploy
gcloud run deploy $FRONTEND_SERVICE \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 60

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format 'value(status.url)')

# Clean up
rm public/config.js
rm Dockerfile

echo ""
echo "============================================="
echo "✅ Frontend Redeployed!"
echo "============================================="
echo ""
echo "🌐 Your app is now live at:"
echo "   👉 $FRONTEND_URL"
echo ""
echo "✅ Frontend should now connect to backend correctly!"
echo ""
