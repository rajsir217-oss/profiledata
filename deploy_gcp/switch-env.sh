#!/bin/bash

# Environment Switcher Script
# Usage: ./switch-env.sh [local|staging|production]

ENV=${1:-local}
BACKEND_DIR="fastapi_backend"

echo "🔄 Switching to $ENV environment..."

case $ENV in
  local)
    echo "📍 Setting up LOCAL environment"
    cp $BACKEND_DIR/.env.local $BACKEND_DIR/.env
    export APP_ENVIRONMENT=local
    export REACT_APP_ENVIRONMENT=local
    echo "✅ Switched to LOCAL environment"
    echo "   - API: http://localhost:8000"
    echo "   - Frontend: http://localhost:3000"
    echo "   - MongoDB: mongodb://localhost:27017"
    echo ""
    echo "📝 To start services:"
    echo "   ./bstart.sh  # Start backend"
    echo "   ./fstart.sh  # Start frontend"
    ;;
    
  staging)
    echo "🚧 Setting up STAGING environment"
    if [ -f "$BACKEND_DIR/.env.staging" ]; then
      cp $BACKEND_DIR/.env.staging $BACKEND_DIR/.env
      export APP_ENVIRONMENT=staging
      export REACT_APP_ENVIRONMENT=staging
      echo "✅ Switched to STAGING environment"
    else
      echo "❌ .env.staging not found. Please create it first."
      exit 1
    fi
    ;;
    
  production)
    echo "⚠️  PRODUCTION environment configuration"
    echo "    Production should be configured via:"
    echo "    - Google Cloud Run environment variables"
    echo "    - Google Secret Manager for sensitive data"
    echo ""
    echo "    Reference: .env.production"
    echo ""
    echo "    To deploy to production:"
    echo "    gcloud run deploy matrimonial-backend --source ."
    ;;
    
  test)
    echo "🧪 Setting up TEST environment"
    if [ -f "$BACKEND_DIR/.env.test" ]; then
      cp $BACKEND_DIR/.env.test $BACKEND_DIR/.env
      export APP_ENVIRONMENT=test
      echo "✅ Switched to TEST environment"
    else
      # Create a basic test env if it doesn't exist
      echo "Creating .env.test..."
      cp $BACKEND_DIR/.env.local $BACKEND_DIR/.env.test
      sed -i '' 's/matrimonialDB/matrimonialDB_test/g' $BACKEND_DIR/.env.test
      cp $BACKEND_DIR/.env.test $BACKEND_DIR/.env
      export APP_ENVIRONMENT=test
      echo "✅ Created and switched to TEST environment"
    fi
    ;;
    
  *)
    echo "❌ Unknown environment: $ENV"
    echo "   Available: local, staging, production, test"
    exit 1
    ;;
esac

echo ""
echo "🔍 Current configuration:"
echo "   APP_ENVIRONMENT=$APP_ENVIRONMENT"
echo "   Active .env: $BACKEND_DIR/.env"
