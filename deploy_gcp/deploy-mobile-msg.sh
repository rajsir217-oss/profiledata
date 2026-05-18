#!/bin/bash

set -euo pipefail

show_usage() {
  cat << 'EOF'
Usage:
  ./deploy-mobile-msg.sh [--a] [--i]

Options:
  --a, --android    Build/run Messenger on Android
  --i, --iphone     Build/run Messenger on iOS (simulator)
  -h, --help        Show this help

Notes:
  - This script targets the React Native app in ../messenger
  - Android requires:
      - Java 21
      - ANDROID_HOME (defaults to ~/Library/Android/sdk)
      - adb/emulator available on PATH
EOF
}

DO_ANDROID=false
DO_IOS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --a|--android)
      DO_ANDROID=true
      shift
      ;;
    --i|--iphone|--ios)
      DO_IOS=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      echo ""
      show_usage
      exit 1
      ;;
  esac
done

if [[ "$DO_ANDROID" != "true" && "$DO_IOS" != "true" ]]; then
  echo "❌ You must specify at least one of: --a (Android) or --i (iPhone/iOS)"
  echo ""
  show_usage
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG_DIR="$REPO_ROOT/messenger"

if [[ ! -f "$MSG_DIR/package.json" ]]; then
  echo "❌ Messenger project not found at: $MSG_DIR"
  exit 1
fi

ensure_java21() {
  local java21_home=""

  if [[ -d "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
    java21_home="/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  else
    java21_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  fi

  if [[ -z "$java21_home" || ! -d "$java21_home" ]]; then
    echo "❌ Java 21 not found. Install it first (recommended):"
    echo "   brew install openjdk@21"
    exit 1
  fi

  export JAVA_HOME="$java21_home"
  export PATH="$JAVA_HOME/bin:$PATH"
}

load_messenger_env() {
  local env_file="$MSG_DIR/.env.local"
  if [[ "${NODE_ENV:-}" = "production" ]]; then
    env_file="$MSG_DIR/.env.production"
  fi

  if [[ -f "$env_file" ]]; then
    set -a
    . "$env_file"
    set +a
  fi
}

ensure_android_paths() {
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi

  if [[ ! -d "$ANDROID_HOME" ]]; then
    echo "❌ ANDROID_HOME does not exist: $ANDROID_HOME"
    echo "   Install Android SDK (Android Studio or command-line tools)"
    exit 1
  fi

  export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
}

android_start_emulator_if_needed() {
  if adb devices 2>/dev/null | grep -q "device$"; then
    return 0
  fi

  local avds
  avds="$(emulator -list-avds 2>/dev/null || true)"
  if [[ -z "$avds" ]]; then
    echo "❌ No emulators found (emulator -list-avds empty)."
    echo "   Create an ARM64 emulator (arm64-v8a) and retry."
    exit 1
  fi

  local avd_name
  avd_name="$(echo "$avds" | head -n 1)"

  echo "ℹ️  No connected devices. Starting emulator: $avd_name"
  echo "   (If you're on Apple Silicon, ensure the AVD is arm64-v8a.)"

  emulator -avd "$avd_name" -no-snapshot-load >/dev/null 2>&1 &

  echo "⏳ Waiting for emulator to boot..."
  adb wait-for-device >/dev/null 2>&1 || true

  local boot_completed=""
  for _ in $(seq 1 90); do
    boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [[ "$boot_completed" = "1" ]]; then
      echo "✅ Emulator boot complete"
      return 0
    fi
    sleep 2
  done

  echo "⚠️  Emulator did not report boot complete in time. Continuing anyway."
}

run_android() {
  echo "=============================================="
  echo "🤖 Messenger (React Native) - Android"
  echo "=============================================="

  load_messenger_env
  ensure_java21
  ensure_android_paths

  if ! command -v adb >/dev/null 2>&1; then
    echo "❌ adb not found on PATH. Expected under: $ANDROID_HOME/platform-tools"
    exit 1
  fi

  if ! command -v emulator >/dev/null 2>&1; then
    echo "❌ emulator not found on PATH. Expected under: $ANDROID_HOME/emulator"
    exit 1
  fi

  adb start-server >/dev/null 2>&1 || true
  android_start_emulator_if_needed

  echo "🚀 Running: npm --prefix messenger run android"
  (cd "$REPO_ROOT" && npm --prefix messenger run android)
}

run_ios() {
  echo "=============================================="
  echo "🍎 Messenger (React Native) - iOS"
  echo "=============================================="

  load_messenger_env
  if ! command -v xcodebuild >/dev/null 2>&1; then
    echo "❌ Xcode not found (xcodebuild missing). Install Xcode first."
    exit 1
  fi

  echo "🔧 Installing CocoaPods (if needed)..."
  if [[ -d "$MSG_DIR/ios" ]]; then
    if [[ -f "$MSG_DIR/ios/Podfile" ]]; then
      if command -v pod >/dev/null 2>&1; then
        (cd "$MSG_DIR/ios" && pod install)
      else
        echo "❌ CocoaPods not installed (pod missing). Install it and retry."
        echo "   sudo gem install cocoapods"
        exit 1
      fi
    fi
  fi

  echo "🚀 Running: npm --prefix messenger run ios"
  (cd "$REPO_ROOT" && npm --prefix messenger run ios)
}

if [[ "$DO_ANDROID" = "true" ]]; then
  run_android
fi

if [[ "$DO_IOS" = "true" ]]; then
  run_ios
fi
