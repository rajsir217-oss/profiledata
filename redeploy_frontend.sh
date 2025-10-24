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

# Create .env file (not .env.production - React reads .env during build)
cat > .env << EOF
REACT_APP_API_URL=${BACKEND_URL}/api/users
REACT_APP_SOCKET_URL=${BACKEND_URL}
EOF

echo "✅ Created .env with backend URL"
echo ""

# Create Dockerfile that includes .env
cat > Dockerfile << 'DOCKERFILE_END'
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source and .env
COPY . .

# Build with environment variables from .env
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
rm .env
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
