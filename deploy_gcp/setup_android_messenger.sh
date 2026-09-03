#!/bin/bash

##############################################
# 📱 Setup Messenger Android App - One-Time Setup
# This script installs Capacitor and creates
# the Android project structure for messenger-web
##############################################

set -e  # Exit on error

echo "=============================================="
echo "📱 L3V3L Messenger - Android Setup"
echo "=============================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running from correct directory
if [ ! -f "../messenger-web/package.json" ]; then
    echo "❌ Error: Must run from deploy_gcp directory"
    exit 1
fi

cd ../messenger-web

# Step 1: Check Node.js
echo -e "${BLUE}📋 Step 1: Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}${GREEN}✅ Node.js ${NODE_VERSION}${NC}"
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

# Step 3: Install dependencies
echo -e "${BLUE}📋 Step 3: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
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
        echo -e "${GREEN}✅ Setup complete! Use ./deploy_gcp/deploy-mobile-msg.sh --a to build/run.${NC}"
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

# Step 7: Build initial version
echo -e "${BLUE}📋 Step 6: Building messenger-web dist...${NC}"
npm run build
echo -e "${GREEN}✅ Messenger web app built${NC}"
echo ""

# Step 8: Sync to Android
echo -e "${BLUE}📋 Step 7: Syncing to Android...${NC}"
npx cap sync android
echo -e "${GREEN}✅ Synced to Android${NC}"
echo ""

# Step 9: Configure network security
echo -e "${BLUE}📋 Step 8: Configuring network security...${NC}"
cd ../deploy_gcp
chmod +x configure_android_network.sh
ANDROID_PROJECT_DIR=../messenger-web ./configure_android_network.sh > /dev/null 2>&1
cd ../messenger-web
echo -e "${GREEN}✅ Network security configured${NC}"
echo ""

echo "=============================================="
echo -e "${GREEN}🎉 Messenger Android Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "📁 Android project created at: messenger-web/android/"
echo ""
echo "Next steps:"
echo "  1. Run: ./deploy_gcp/deploy-mobile-msg.sh --a        (Build and run on emulator)"
echo "  2. Or:  npx cap open android                         (Open in Android Studio)"
echo ""
echo "For development with live reload:"
echo "  1. Create messenger-web/.env.local:"
echo "     MESSENGER_BACKEND_URL=http://10.0.2.2:8000"
echo "  2. Edit capacitor.config.json server.url to: http://10.0.2.2:3030"
echo "  3. Run: npm start (in one terminal)"
echo "  4. Run: ./deploy_gcp/deploy-mobile-msg.sh --a (in another terminal)"
echo ""
