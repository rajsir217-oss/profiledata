#!/bin/bash

##############################################
# ⚡ Quick Android Build - No Emulator Start
# Assumes emulator is already running
##############################################

set -e

echo "🚀 L3V3L Quick Android Build"
echo ""

# Set up paths
if [ -z "$ANDROID_HOME" ]; then
    export ANDROID_HOME=$HOME/Library/Android/sdk
fi

# Set JAVA_HOME to Android Studio's bundled JDK
if [ -z "$JAVA_HOME" ]; then
    export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

ADB="$ANDROID_HOME/platform-tools/adb"

cd ../frontend

# Check if device is connected
echo "📱 Checking devices..."
DEVICES=$($ADB devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$DEVICES" -eq "0" ]; then
    echo "❌ No devices found"
    echo "" 
    echo "Please start your emulator first:"
    echo "1. Open Android Studio"
    echo "2. Click Device Manager"
    echo "3. Start Pixel 9 emulator"
    echo ""
    echo "Or run: ./deploy-mobile-main.sh (auto-starts emulator)"
    exit 1
fi

echo "✅ Device connected"
echo ""

# Load production env for Android build without mutating .env.local
echo "⚙️  Loading production environment from .env.production..."
set -a
. ./.env.production
set +a

# Build React
echo "📦 Building React app..."
npm run build > /dev/null 2>&1
echo "✅ Built"

# Sync
echo "🔄 Syncing..."
npx cap sync android > /dev/null 2>&1
echo "✅ Synced"

# Build APK
echo "🏗️  Building APK..."
cd android
./gradlew assembleDebug > /dev/null 2>&1
echo "✅ APK built"

# Install
echo "📲 Installing..."
$ADB install -r app/build/outputs/apk/debug/app-debug.apk > /dev/null 2>&1
echo "✅ Installed"

# Launch
echo "🚀 Launching..."
$ADB shell am start -n com.l3v3l.matrimony/.MainActivity > /dev/null 2>&1
echo "✅ Launched"

echo ""
echo "🎉 Done! App running on emulator"
echo ""
echo "🔍 Debug: chrome://inspect"
