#!/bin/bash
set -e  # Exit on error

clear

echo "🚀 Starting L3V3L Messenger..."
echo "================================"

# Parse args
MODE="web"
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--android)
            MODE="android"
            shift
            ;;
        -i|--ios)
            MODE="ios"
            shift
            ;;
        -w|--web)
            MODE="web"
            shift
            ;;
        -h|--help)
            echo "Usage: mstart.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -w, --web       Start web preview on http://localhost:3030 (default)"
            echo "  -a, --android   Run on Android emulator (requires Android Studio + ANDROID_HOME)"
            echo "  -i, --ios       Run on iOS simulator (requires Xcode)"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if backend is running
echo "🔍 Checking backend..."
if ! curl -s http://localhost:8000/docs >/dev/null 2>&1; then
    echo "⚠️  Backend not detected on http://localhost:8000"
    echo "   Start backend first: ./bstart.sh"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Backend is running"
fi
echo ""

case $MODE in
    web)
        # Use messenger-web — standalone React 18 + react-native-web app
        WEB_DIR="$(dirname "$0")/messenger-web"
        cd "$WEB_DIR"

        # Install deps if needed
        if [ ! -d "node_modules" ]; then
            echo "📦 Installing web dependencies..."
            npm install --legacy-peer-deps
            if [ $? -ne 0 ]; then
                echo "❌ Failed to install dependencies"
                exit 1
            fi
        fi

        # Kill any existing processes on port 3030
        echo "🔍 Checking for existing processes on port 3030..."
        if lsof -ti:3030 >/dev/null 2>&1; then
            echo "⚠️  Killing existing process on port 3030..."
            lsof -ti:3030 | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        echo "✅ Port 3030 is available"
        echo ""
        echo "📋 Configuration:"
        echo "   Mode: Web Preview (React 18 + react-native-web)"
        echo "   Backend URL: http://localhost:8000"
        echo "   Messenger URL: http://localhost:3030"
        echo ""
        echo "✅ Starting messenger on http://localhost:3030"
        echo ""
        echo "Press Ctrl+C to stop..."
        echo "================================"
        echo ""
        npm start
        ;;
    android|ios)
        # Use messenger — React Native mobile app
        MOBILE_DIR="$(dirname "$0")/messenger"
        cd "$MOBILE_DIR"

        if [ ! -d "node_modules" ]; then
            echo "📦 Installing mobile dependencies..."
            npm install --legacy-peer-deps
            if [ $? -ne 0 ]; then
                echo "❌ Failed to install dependencies"
                exit 1
            fi
        fi

        if [ "$MODE" = "android" ]; then
            echo "📱 Starting on Android..."
            if [ -z "$ANDROID_HOME" ]; then
                echo "❌ ANDROID_HOME not set. Install Android Studio and set ANDROID_HOME."
                exit 1
            fi
            npm run android
        else
            echo "🍎 Starting on iOS..."
            if ! command -v xcodebuild >/dev/null 2>&1; then
                echo "❌ Xcode not found. Install Xcode from the App Store."
                exit 1
            fi
            if [ ! -d "ios/Pods" ]; then
                echo "📦 Running pod install..."
                (cd ios && bundle install && bundle exec pod install)
            fi
            npm run ios
        fi
        ;;
esac
