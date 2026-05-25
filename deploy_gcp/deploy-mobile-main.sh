#!/bin/bash

##############################################
# 🤖 Build and Run Android App
# Builds React app and deploys to emulator
# Usage: ./deploy-mobile-main.sh [release]
##############################################

set -e  # Exit on error

show_usage() {
    cat << 'EOF'
Usage:
  ./deploy-mobile-main.sh [release]

Options:
  release           Build a release APK (default: debug)
  -h, --h, --help   Show this help

What it does:
  - Builds the web app (npm run build)
  - Copies/syncs Capacitor Android (cap copy/sync)
  - Builds an Android APK via Gradle (debug or release)
  - Copies the APK to your Desktop
  - (Optional) Uploads the RELEASE APK to GCS (if configured)
  - Installs + launches on an emulator (if available)
  - Restores your prior frontend config files after the build

Outputs:
  Debug:   ~/Desktop/L3V3L-Matrimony.apk
  Release: ~/Desktop/L3V3L-Matrimony-release.apk (or -signed)

Notes:
  - Run this from the deploy_gcp folder
  - ANDROID_HOME defaults to ~/Library/Android/sdk
  - Requires Java 21 (preferred) or Java 17
  - Optional GCS upload requires gsutil and these env vars:
      GCS_BUCKET_NAME
      ANDROID_APK_GCS_OBJECT   (example: mobile/android/l3v3lmatches-latest.apk)
EOF
}

ensure_java() {
    if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
        local current_major=""
        current_major="$("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1 | sed -E 's/.*version "([0-9]+).*/\1/' || true)"
        if [[ "$current_major" = "21" || "$current_major" = "17" ]]; then
            echo "ℹ️  Using existing JAVA_HOME (Java $current_major): $JAVA_HOME"
            export PATH="$JAVA_HOME/bin:$PATH"
            return 0
        fi
    fi

    local java_home=""
    for v in 21 17; do
        java_home="$(/usr/libexec/java_home -v "$v" 2>/dev/null || true)"
        if [[ -n "$java_home" && -x "$java_home/bin/java" ]]; then
            echo "ℹ️  Using Java $v at: $java_home"
            export JAVA_HOME="$java_home"
            export PATH="$JAVA_HOME/bin:$PATH"
            return 0
        fi
    done

    local as_jbr="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    if [[ -x "$as_jbr/bin/java" ]]; then
        echo "ℹ️  Using Android Studio JBR at: $as_jbr"
        export JAVA_HOME="$as_jbr"
        export PATH="$JAVA_HOME/bin:$PATH"
        return 0
    fi

    echo "❌ Java 21 or 17 not found. Install one of them and retry."
    echo "   brew install --cask temurin@21"
    echo "   brew install --cask temurin@17"
    exit 1
}

# Parse arguments
BUILD_TYPE="debug"
case "${1:-}" in
    "")
        ;;
    release)
        BUILD_TYPE="release"
        ;;
    -h|--h|--help)
        show_usage
        exit 0
        ;;
    *)
        echo "❌ Unknown argument: ${1}"
        echo ""
        show_usage
        exit 1
        ;;
esac

BUILD_TYPE_UPPER=$(echo "$BUILD_TYPE" | tr '[:lower:]' '[:upper:]')
echo "=============================================="
echo "🤖 L3V3L Matrimony - Build & Run Android"
echo "   Build Type: ${BUILD_TYPE_UPPER}"
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

# Load production env for build without mutating .env.local
set -a
. ./.env.production
set +a

# Production backend URL for Android APK
BACKEND_URL="${REACT_APP_BACKEND_URL:-https://matrimonial-backend-7cxoxmouuq-uc.a.run.app}"

# Save current configs for restoration after build
echo -e "${BLUE}📝 Configuring for production build...${NC}"
if [ -f ".env.local" ]; then
    cp .env.local .env.local.dev.backup
fi

if [ -f "capacitor.config.json" ]; then
    cp capacitor.config.json capacitor.config.json.dev.backup
    node -e "
      const fs = require('fs');
      const p = 'capacitor.config.json';
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      cfg.server = cfg.server || {};
      cfg.server.androidScheme = 'https';
      cfg.server.hostname = 'l3v3lmatches.com';
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
    "
fi

# Production environment is provided via exported variables from .env.production
echo -e "${GREEN}✅ Production env loaded (from .env.production)${NC}"

# Runtime config is intentionally not rewritten here; the build uses REACT_APP_* env vars.

# Check if Android project exists
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Android project not found${NC}"
    echo ""
    echo "Please run setup first:"
    echo "  cd deploy_gcp"
    echo "  ./setup_android.sh"
    exit 1
fi

# Set up Android SDK paths
if [ -z "$ANDROID_HOME" ]; then
    export ANDROID_HOME=$HOME/Library/Android/sdk
fi
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

ensure_java

# Check if emulator is available
echo -e "${BLUE}📋 Checking for Android emulators...${NC}"
EMULATOR_CMD="$ANDROID_HOME/emulator/emulator"
ADB_CMD="$ANDROID_HOME/platform-tools/adb"

EMULATOR_LIST=$($EMULATOR_CMD -list-avds 2>/dev/null || echo "")
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
RUNNING_DEVICES=$($ADB_CMD devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$RUNNING_DEVICES" -eq "0" ]; then
    echo -e "${YELLOW}⚠️  No emulator running${NC}"
    echo "Starting emulator..."
    
    # Get first available emulator
    FIRST_EMULATOR=$(echo "$EMULATOR_LIST" | head -n 1)
    echo "Launching: $FIRST_EMULATOR"
    
    # Start emulator in background
    $EMULATOR_CMD -avd "$FIRST_EMULATOR" -no-snapshot-load > /dev/null 2>&1 &
    EMULATOR_PID=$!
    
    echo -e "${BLUE}⏳ Waiting for emulator to boot...${NC}"
    echo "   (This may take 30-60 seconds)"
    
    # Wait for device to be ready
    $ADB_CMD wait-for-device
    
    # Wait for boot to complete
    while [ "$($ADB_CMD shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
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

# Build APK based on type
if [ "$BUILD_TYPE" = "release" ]; then
    echo -e "${YELLOW}🔐 Building RELEASE APK...${NC}"
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
    APK_NAME="L3V3L-Matrimony-release.apk"
    
    # Check for signed APK first
    if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        APK_NAME="L3V3L-Matrimony-release-signed.apk"
    fi
else
    echo -e "${BLUE}🔧 Building DEBUG APK...${NC}"
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
    APK_NAME="L3V3L-Matrimony.apk"
fi

if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}❌ Failed to build APK${NC}"
    echo "Expected: $APK_PATH"
    exit 1
fi

APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
echo -e "${GREEN}✅ APK built (Size: ${APK_SIZE})${NC}"
echo ""

# Copy APK to Desktop
echo -e "${BLUE}📋 Step 5: Copying APK to Desktop...${NC}"
cp "$APK_PATH" ~/Desktop/"$APK_NAME"
echo -e "${GREEN}✅ APK copied to ~/Desktop/${APK_NAME}${NC}"
echo ""

# Optional: Upload RELEASE APK to GCS for website download
if [ "$BUILD_TYPE" = "release" ]; then
    echo -e "${BLUE}☁️  Step 5b: Uploading RELEASE APK to GCS (optional)...${NC}"

    APK_BUCKET_NAME="${ANDROID_APK_GCS_BUCKET_NAME:-${GCS_BUCKET_NAME:-}}"
    if [ -z "${APK_BUCKET_NAME}" ] || [ -z "${ANDROID_APK_GCS_OBJECT:-}" ]; then
        echo -e "${YELLOW}⚠️  Skipping GCS upload (missing ANDROID_APK_GCS_BUCKET_NAME/GCS_BUCKET_NAME and/or ANDROID_APK_GCS_OBJECT env var)${NC}"
        echo ""
    elif ! command -v gsutil >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Skipping GCS upload (gsutil not found). Install gcloud/gsutil and retry.${NC}"
        echo ""
    else
        APK_OBJECT_PATH="${ANDROID_APK_GCS_OBJECT#/}"
        GCS_DEST="gs://${APK_BUCKET_NAME}/${APK_OBJECT_PATH}"
        echo "   Uploading: ${APK_PATH} -> ${GCS_DEST}"
        gsutil -q cp "$APK_PATH" "$GCS_DEST"
        echo -e "${GREEN}✅ Uploaded APK to ${GCS_DEST}${NC}"
        echo ""
    fi
fi

# Install on emulator (skip for release if no emulator)
echo -e "${BLUE}📲 Step 6: Installing on emulator...${NC}"
$ADB_CMD install -r "$APK_PATH"
echo -e "${GREEN}✅ App installed${NC}"
echo ""

# Launch app
echo -e "${BLUE}🚀 Step 7: Launching app...${NC}"
$ADB_CMD shell am start -n com.l3v3l.matrimony/.MainActivity
echo -e "${GREEN}✅ App launched${NC}"
echo ""

# Show logs
echo "=============================================="
echo -e "${GREEN}🎉 App Running on Emulator!${NC}"
echo "=============================================="
echo ""
echo "📱 App: L3V3L Matrimony"
echo "📦 APK: $APK_PATH"
echo "💾 Size: ${APK_SIZE}"
echo "📋 Desktop: ~/Desktop/${APK_NAME}"
echo ""
echo "🔍 Debug Tools:"
echo "   • Chrome DevTools: chrome://inspect"
echo "   • View logs: $ADB_CMD logcat | grep L3V3L"
echo "   • Stop app: $ADB_CMD shell am force-stop com.l3v3l.matrimony"
echo "   • Uninstall: $ADB_CMD uninstall com.l3v3l.matrimony"
echo ""
echo "♻️  Rebuild & redeploy:"
echo "   ./deploy-mobile-main.sh"
echo ""

# Restore development configs
cd ..
echo -e "${BLUE}📝 Restoring development configs...${NC}"

# Restore .env.local
if [ -f ".env.local.dev.backup" ]; then
    mv .env.local.dev.backup .env.local
    echo -e "${GREEN}✅ Development .env.local restored${NC}"
else
    cat > .env.local << EOF
# Local Development Environment
REACT_APP_ENVIRONMENT=local
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_API_URL=http://localhost:8000/api/users
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_FRONTEND_URL=http://localhost:3000
EOF
    echo -e "${GREEN}✅ Development .env.local created${NC}"
fi

# Restore capacitor.config.json
if [ -f "capacitor.config.json.dev.backup" ]; then
    mv capacitor.config.json.dev.backup capacitor.config.json
fi
echo ""

# Optional: Show live logs
read -p "Show live logs? (y/n): " SHOW_LOGS
if [ "$SHOW_LOGS" = "y" ] || [ "$SHOW_LOGS" = "Y" ]; then
    echo ""
    echo "📋 Live Logs (Ctrl+C to stop):"
    echo "----------------------------------------------"
    $ADB_CMD logcat | grep -i "matrimony\|chromium\|capacitor"
fi
