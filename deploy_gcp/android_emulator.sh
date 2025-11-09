#!/bin/bash

##############################################
# 📱 Android Emulator Manager
# Start, stop, and manage Android emulators
##############################################

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_usage() {
    echo "Usage: ./android_emulator.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start     - Start emulator"
    echo "  stop      - Stop emulator"
    echo "  restart   - Restart emulator"
    echo "  status    - Show emulator status"
    echo "  list      - List available emulators"
    echo "  logs      - Show app logs"
    echo "  install   - Install APK on emulator"
    echo "  uninstall - Uninstall app from emulator"
    echo ""
}

list_emulators() {
    echo -e "${BLUE}📱 Available Emulators:${NC}"
    emulator -list-avds
}

start_emulator() {
    echo -e "${BLUE}🚀 Starting emulator...${NC}"
    
    # Get first available emulator
    EMULATOR_NAME=$(emulator -list-avds | head -n 1)
    
    if [ -z "$EMULATOR_NAME" ]; then
        echo -e "${RED}❌ No emulators found${NC}"
        echo "Create one in Android Studio first"
        exit 1
    fi
    
    echo "Starting: $EMULATOR_NAME"
    emulator -avd "$EMULATOR_NAME" -no-snapshot-load &
    
    echo -e "${BLUE}⏳ Waiting for boot...${NC}"
    adb wait-for-device
    
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
        echo -n "."
    done
    echo ""
    echo -e "${GREEN}✅ Emulator started${NC}"
}

stop_emulator() {
    echo -e "${BLUE}🛑 Stopping emulator...${NC}"
    adb emu kill
    echo -e "${GREEN}✅ Emulator stopped${NC}"
}

restart_emulator() {
    stop_emulator
    sleep 2
    start_emulator
}

show_status() {
    echo -e "${BLUE}📊 Emulator Status:${NC}"
    echo ""
    
    # Running devices
    echo "Running devices:"
    adb devices
    echo ""
    
    # App status
    echo "L3V3L Matrimony app:"
    if adb shell pm list packages | grep -q "com.l3v3l.matrimony"; then
        echo -e "${GREEN}✅ Installed${NC}"
        
        # Check if running
        if adb shell pidof com.l3v3l.matrimony > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Running${NC}"
        else
            echo -e "${YELLOW}⏸  Not running${NC}"
        fi
    else
        echo -e "${RED}❌ Not installed${NC}"
    fi
}

show_logs() {
    echo -e "${BLUE}📋 Live Logs (Ctrl+C to stop):${NC}"
    echo "----------------------------------------------"
    adb logcat | grep -i "matrimony\|chromium\|capacitor\|console"
}

install_apk() {
    APK_PATH="../frontend/android/app/build/outputs/apk/debug/app-debug.apk"
    
    if [ ! -f "$APK_PATH" ]; then
        echo -e "${RED}❌ APK not found${NC}"
        echo "Build first: ./build_android.sh"
        exit 1
    fi
    
    echo -e "${BLUE}📲 Installing APK...${NC}"
    adb install -r "$APK_PATH"
    echo -e "${GREEN}✅ Installed${NC}"
}

uninstall_app() {
    echo -e "${BLUE}🗑️  Uninstalling app...${NC}"
    adb uninstall com.l3v3l.matrimony
    echo -e "${GREEN}✅ Uninstalled${NC}"
}

# Main script
case "$1" in
    start)
        start_emulator
        ;;
    stop)
        stop_emulator
        ;;
    restart)
        restart_emulator
        ;;
    status)
        show_status
        ;;
    list)
        list_emulators
        ;;
    logs)
        show_logs
        ;;
    install)
        install_apk
        ;;
    uninstall)
        uninstall_app
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
