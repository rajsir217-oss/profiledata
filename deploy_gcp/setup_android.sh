#!/bin/bash

##############################################
# 📱 Setup Android App - One-Time Setup
# This script installs Capacitor and creates
# the Android project structure
##############################################

set -e  # Exit on error

echo "=============================================="
echo "📱 L3V3L Matrimony - Android Setup"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "../frontend/package.json" ]; then
    echo "❌ Error: Must run from deploy_gcp directory"
    exit 1
fi

cd ../frontend

# Step 1: Check Node.js
echo -e "${BLUE}📋 Step 1: Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION}${NC}"
echo ""

# Step 2: Check Android SDK
echo -e "${BLUE}📋 Step 2: Checking Android SDK...${NC}"
if [ -z "$ANDROID_HOME" ]; then
    echo -e "${YELLOW}⚠️  ANDROID_HOME not set${NC}"
    echo "Setting ANDROID_HOME to default location..."
    export ANDROID_HOME=$HOME/Library/Android/sdk
fi

if [ ! -d "$ANDROID_HOME" ]; then
    echo "❌ Android SDK not found at $ANDROID_HOME"
    echo "Please install Android Studio first."
    exit 1
fi
echo -e "${GREEN}✅ Android SDK: $ANDROID_HOME${NC}"
echo ""

# Step 3: Install Capacitor dependencies
echo -e "${BLUE}📋 Step 3: Installing Capacitor packages...${NC}"
npm install --save --legacy-peer-deps @capacitor/core @capacitor/cli @capacitor/android

# Also install useful plugins
npm install --save --legacy-peer-deps @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard

echo -e "${GREEN}✅ Capacitor packages installed${NC}"
echo ""

# Step 4: Check if Android already exists
if [ -d "android" ]; then
    echo -e "${YELLOW}⚠️  Android project already exists${NC}"
    read -p "Do you want to remove and recreate it? (yes/no): " RECREATE
    if [ "$RECREATE" = "yes" ]; then
        echo "🗑️  Removing existing Android project..."
        rm -rf android
    else
        echo "Keeping existing Android project..."
        echo ""
        echo -e "${GREEN}✅ Setup complete! Use ./build_android.sh to build and run.${NC}"
        exit 0
    fi
fi

# Step 5: Add Android platform
echo -e "${BLUE}📋 Step 4: Creating Android project...${NC}"
npx cap add android

if [ ! -d "android" ]; then
    echo "❌ Failed to create Android project"
    exit 1
fi
echo -e "${GREEN}✅ Android project created${NC}"
echo ""

# Step 6: Update gitignore
echo -e "${BLUE}📋 Step 5: Updating .gitignore...${NC}"
if ! grep -q "android/" .gitignore 2>/dev/null; then
    cat >> .gitignore << EOF

# Android (Capacitor)
android/
ios/
*.keystore
*.jks
EOF
    echo -e "${GREEN}✅ .gitignore updated${NC}"
else
    echo "✓ .gitignore already configured"
fi
echo ""

# Step 7: Update .gcloudignore
echo -e "${BLUE}📋 Step 6: Updating .gcloudignore...${NC}"
if [ -f ".gcloudignore" ]; then
    if ! grep -q "android/" .gcloudignore; then
        cat >> .gcloudignore << EOF

# Mobile apps (Capacitor) - not needed for web deployment
android/
ios/
capacitor.config.json
capacitor.config.ts
*.keystore
*.jks
EOF
        echo -e "${GREEN}✅ .gcloudignore updated${NC}"
    else
        echo "✓ .gcloudignore already configured"
    fi
fi
echo ""

# Step 8: Build initial version
echo -e "${BLUE}📋 Step 7: Building initial React app...${NC}"
npm run build
echo -e "${GREEN}✅ React app built${NC}"
echo ""

# Step 9: Sync to Android
echo -e "${BLUE}📋 Step 8: Syncing to Android...${NC}"
npx cap sync android
echo -e "${GREEN}✅ Synced to Android${NC}"
echo ""

echo "=============================================="
echo -e "${GREEN}🎉 Android Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "📁 Android project created at: frontend/android/"
echo ""
echo "Next steps:"
echo "  1. Run: ./build_android.sh        (Build and run on emulator)"
echo "  2. Or:  npx cap open android      (Open in Android Studio)"
echo ""
echo "For development with live reload:"
echo "  1. Edit capacitor.config.json"
echo "  2. Change server.url to: http://10.0.2.2:3000"
echo "  3. Run: npm start (in one terminal)"
echo "  4. Run: ./build_android.sh (in another terminal)"
echo ""
