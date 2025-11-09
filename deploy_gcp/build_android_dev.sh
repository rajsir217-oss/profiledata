#!/bin/bash

##############################################
# 🔥 Build Android App - Development Mode
# Uses live React dev server for hot reload
##############################################

set -e  # Exit on error

echo "=============================================="
echo "🔥 L3V3L Matrimony - Android Dev Mode"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd ../frontend

# Check if Android project exists
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Android project not found${NC}"
    echo "Run: ./setup_android.sh"
    exit 1
fi

# Backup original config
echo -e "${BLUE}📋 Configuring for development mode...${NC}"
if [ ! -f "capacitor.config.json.backup" ]; then
    cp capacitor.config.json capacitor.config.json.backup
fi

# Update config to use localhost
cat > capacitor.config.json << 'EOF'
{
  "appId": "com.l3v3l.matrimony",
  "appName": "L3V3L Matrimony (Dev)",
  "webDir": "build",
  "bundledWebRuntime": false,
  "server": {
    "url": "http://10.0.2.2:3000",
    "cleartext": true,
    "androidScheme": "http"
  },
  "android": {
    "allowMixedContent": true,
    "captureInput": true,
    "webContentsDebuggingEnabled": true
  }
}
EOF

echo -e "${GREEN}✅ Configured for dev mode (server: http://10.0.2.2:3000)${NC}"
echo ""

# Check if React dev server is running
echo -e "${BLUE}📋 Checking React dev server...${NC}"
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  React dev server not running on port 3000${NC}"
    echo ""
    echo "Please start React dev server first:"
    echo "  cd frontend"
    echo "  npm start"
    echo ""
    read -p "Press Enter when dev server is running, or Ctrl+C to cancel..."
fi
echo -e "${GREEN}✅ Dev server detected${NC}"
echo ""

# Sync to Android
echo -e "${BLUE}🔄 Syncing to Android...${NC}"
npx cap sync android
echo -e "${GREEN}✅ Synced${NC}"
echo ""

# Run on emulator
echo -e "${BLUE}🚀 Launching on emulator...${NC}"
npx cap run android

echo ""
echo "=============================================="
echo -e "${GREEN}🔥 Dev Mode Active!${NC}"
echo "=============================================="
echo ""
echo "✨ Live reload enabled!"
echo "   Edit React code → Saves automatically refresh app"
echo ""
echo "🔍 Debug:"
echo "   • Chrome DevTools: chrome://inspect"
echo "   • React DevTools: Available in Chrome"
echo ""
echo "🔄 To switch back to production mode:"
echo "   mv capacitor.config.json.backup capacitor.config.json"
echo ""
