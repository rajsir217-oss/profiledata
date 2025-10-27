#!/bin/bash

# Switch Environment Script
# Automatically updates config.js for local development or production deployment

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CONFIG_FILE="frontend/public/config.js"

# Show usage
show_usage() {
    echo "Usage: ./switch-environment.sh [local|pod]"
    echo ""
    echo "Environments:"
    echo "  local - Development on localhost (default)"
    echo "  pod   - Production deployment on GCP"
    exit 1
}

# Check if environment argument provided
if [ $# -eq 0 ]; then
    show_usage
fi

ENV=$1

case $ENV in
    local)
        echo -e "${BLUE}🔧 Switching to LOCAL environment...${NC}"
        cat > $CONFIG_FILE << 'EOF'
/**
 * Runtime Configuration
 * Auto-generated during deployment
 * 
 * NOTE: For local development, this is set to 'local'
 * For production deployment, this should be updated to 'pod' with GCP URLs
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'local',
  SOCKET_URL: 'http://localhost:8000',
  API_URL: 'http://localhost:8000/api/users',
  WS_URL: 'ws://localhost:8000',
  FRONTEND_URL: 'http://localhost:3000',
  ENABLE_NOTIFICATIONS: true,
  DEBUG: true
};
console.log('✅ Runtime config loaded:', window.RUNTIME_CONFIG.ENVIRONMENT);
EOF
        echo -e "${GREEN}✅ Config updated to LOCAL environment${NC}"
        echo -e "   SOCKET_URL: http://localhost:8000"
        echo -e "   DEBUG: true"
        ;;
    
    pod)
        echo -e "${BLUE}🚀 Switching to PRODUCTION (POD) environment...${NC}"
        cat > $CONFIG_FILE << 'EOF'
/**
 * Runtime Configuration
 * Auto-generated during deployment
 * 
 * NOTE: For local development, this is set to 'local'
 * For production deployment, this should be updated to 'pod' with GCP URLs
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'pod',
  SOCKET_URL: 'https://matrimonial-backend-458052696267.us-central1.run.app',
  API_URL: 'https://matrimonial-backend-458052696267.us-central1.run.app/api/users',
  WS_URL: 'wss://matrimonial-backend-458052696267.us-central1.run.app',
  FRONTEND_URL: 'https://profiledata-pod.ue.r.appspot.com',
  ENABLE_NOTIFICATIONS: true,
  DEBUG: false
};
console.log('✅ Runtime config loaded:', window.RUNTIME_CONFIG.ENVIRONMENT);
EOF
        echo -e "${GREEN}✅ Config updated to PRODUCTION environment${NC}"
        echo -e "   SOCKET_URL: https://matrimonial-backend-458052696267.us-central1.run.app"
        echo -e "   DEBUG: false"
        ;;
    
    *)
        echo -e "${RED}❌ Invalid environment: $ENV${NC}"
        show_usage
        ;;
esac

echo ""
echo -e "${YELLOW}💡 TIP: This file is now configured for $ENV${NC}"
echo -e "${YELLOW}   Run './switch-environment.sh local' before local development${NC}"
echo -e "${YELLOW}   Run './switch-environment.sh pod' before deployment${NC}"
