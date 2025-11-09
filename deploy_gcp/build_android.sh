#!/bin/bash

##############################################
# 🤖 Build and Run Android App
# Builds React app and deploys to emulator
##############################################

set -e  # Exit on error

echo "=============================================="
echo "🤖 L3V3L Matrimony - Build & Run Android"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running from correct directory
if [ ! -f "../frontend/package.json" ]; then
    echo "❌ Error: Must run from deploy_gcp directory"
    exit 1
fi

cd ../frontend

# Check if Android project exists
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Android project not found${NC}"
    echo ""
    echo "Please run setup first:"
    echo "  cd deploy_gcp"
    echo "  ./setup_android.sh"
    exit 1
fi

# Check if emulator is available
echo -e "${BLUE}📋 Checking for Android emulators...${NC}"
EMULATOR_LIST=$(emulator -list-avds 2>/dev/null || echo "")
if [ -z "$EMULATOR_LIST" ]; then
    echo -e "${RED}❌ No Android emulators found${NC}"
    echo "Please create an emulator in Android Studio first."
    exit 1
fi
echo -e "${GREEN}✅ Found emulators:${NC}"
echo "$EMULATOR_LIST" | sed 's/^/   /'
echo ""

# Check if emulator is already running
echo -e "${BLUE}📋 Checking running devices...${NC}"
RUNNING_DEVICES=$(adb devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$RUNNING_DEVICES" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  No emulator running${NC}"
    echo "Starting emulator..."
    
    # Get first available emulator
    FIRST_EMULATOR=$(echo "$EMULATOR_LIST" | head -n 1)
    echo "Launching: $FIRST_EMULATOR"
    
    # Start emulator in background
    emulator -avd "$FIRST_EMULATOR" -no-snapshot-load > /dev/null 2>&1 &
    EMULATOR_PID=$!
    
    echo -e "${BLUE}⏳ Waiting for emulator to boot...${NC}"
    echo "   (This may take 30-60 seconds)"
    
    # Wait for device to be ready
    adb wait-for-device
    
    # Wait for boot to complete
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
        echo -n "."
    done
    echo ""
    echo -e "${GREEN}✅ Emulator booted${NC}"
else
    echo -e "${GREEN}✅ Emulator already running${NC}"
fi
echo ""

# Build React app
echo -e "${BLUE}📦 Step 1: Building React app...${NC}"
echo "   Running: npm run build"
npm run build
BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
echo -e "${GREEN}✅ React app built (Size: ${BUILD_SIZE})${NC}"
echo ""

# Copy to Android
echo -e "${BLUE}📲 Step 2: Copying web assets to Android...${NC}"
npx cap copy android
echo -e "${GREEN}✅ Web assets copied${NC}"
echo ""

# Sync native code
echo -e "${BLUE}🔄 Step 3: Syncing native dependencies...${NC}"
npx cap sync android
echo -e "${GREEN}✅ Native code synced${NC}"
echo ""

# Build and install APK
echo -e "${BLUE}🏗️  Step 4: Building and installing APK...${NC}"
cd android

# Clean previous build (optional, uncomment if needed)
# ./gradlew clean

# Build debug APK
./gradlew assembleDebug

if [ ! -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    echo -e "${RED}❌ Failed to build APK${NC}"
    exit 1
fi

APK_SIZE=$(du -h app/build/outputs/apk/debug/app-debug.apk | cut -f1)
echo -e "${GREEN}✅ APK built (Size: ${APK_SIZE})${NC}"
echo ""

# Install on emulator
echo -e "${BLUE}📲 Step 5: Installing on emulator...${NC}"
adb install -r app/build/outputs/apk/debug/app-debug.apk
echo -e "${GREEN}✅ App installed${NC}"
echo ""

# Launch app
echo -e "${BLUE}🚀 Step 6: Launching app...${NC}"
adb shell am start -n com.l3v3l.matrimony/.MainActivity
echo -e "${GREEN}✅ App launched${NC}"
echo ""

# Show logs
echo "=============================================="
echo -e "${GREEN}🎉 App Running on Emulator!${NC}"
echo "=============================================="
echo ""
echo "📱 App: L3V3L Matrimony"
echo "📦 APK: app/build/outputs/apk/debug/app-debug.apk"
echo "💾 Size: ${APK_SIZE}"
echo ""
echo "🔍 Debug Tools:"
echo "   • Chrome DevTools: chrome://inspect"
echo "   • View logs: adb logcat | grep L3V3L"
echo "   • Stop app: adb shell am force-stop com.l3v3l.matrimony"
echo "   • Uninstall: adb uninstall com.l3v3l.matrimony"
echo ""
echo "♻️  Rebuild & redeploy:"
echo "   ./build_android.sh"
echo ""

# Optional: Show live logs
read -p "Show live logs? (y/n): " SHOW_LOGS
if [ "$SHOW_LOGS" = "y" ] || [ "$SHOW_LOGS" = "Y" ]; then
    echo ""
    echo "📋 Live Logs (Ctrl+C to stop):"
    echo "----------------------------------------------"
    adb logcat | grep -i "matrimony\|chromium\|capacitor"
fi
