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

  if [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
    export ANDROID_SDK_ROOT="$ANDROID_HOME"
  fi

  if [[ ! -d "$ANDROID_HOME" ]]; then
    echo "❌ ANDROID_HOME does not exist: $ANDROID_HOME"
    echo "   Install Android SDK (Android Studio or command-line tools)"
    exit 1
  fi

  if [[ ! -d "$ANDROID_SDK_ROOT" ]]; then
    echo "❌ ANDROID_SDK_ROOT does not exist: $ANDROID_SDK_ROOT"
    exit 1
  fi

  export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
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

  local avd_dir="$HOME/.android/avd/${avd_name}.avd"
  local arch=""
  if [[ -f "$avd_dir/config.ini" ]]; then
    arch="$(grep -E "^abi\.type" "$avd_dir/config.ini" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || true)"
  fi

  local image_sysdir=""
  if [[ -f "$avd_dir/config.ini" ]]; then
    image_sysdir="$(grep -E "^image\.sysdir\.1" "$avd_dir/config.ini" 2>/dev/null | cut -d'=' -f2 | tr -d ' ' || true)"
  fi
  if [[ -n "$image_sysdir" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
    local image_dir="$ANDROID_SDK_ROOT/$image_sysdir"
    if [[ ! -d "$image_dir" ]]; then
      echo "❌ Missing AVD system image directory: $image_dir"
      if command -v sdkmanager >/dev/null 2>&1; then
        if [[ "$image_sysdir" == system-images/android-35/google_apis_playstore/arm64-v8a/* ]]; then
          echo "   Install it with: sdkmanager --install \"system-images;android-35;google_apis_playstore;arm64-v8a\""
        else
          echo "   Install the required system image via: sdkmanager --list"
        fi
      else
        echo "   sdkmanager not found on PATH. Expected under: $ANDROID_HOME/cmdline-tools/latest/bin"
      fi
      exit 1
    fi
  fi
  if [[ -n "$arch" ]]; then
    echo "ℹ️  AVD architecture: $arch"
    if [[ "$arch" == "x86" || "$arch" == "x86_64" ]]; then
      echo "⚠️  Warning: AVD is $arch. On Apple Silicon this may fail or be very slow."
      echo "   Recommended: create an arm64-v8a AVD."
    fi
  fi

  echo "ℹ️  No connected devices. Starting emulator: $avd_name"

  emulator -avd "$avd_name" -no-snapshot-load &
  local emulator_pid=$!

  echo "⏳ Waiting for emulator to boot (PID $emulator_pid)..."

  sleep 3
  if ! kill -0 $emulator_pid 2>/dev/null; then
    echo "❌ Emulator process exited immediately (check output above for crash reason)."
    exit 1
  fi

  adb wait-for-device >/dev/null 2>&1 || true

  local boot_completed=""
  for _ in $(seq 1 120); do
    boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [[ "$boot_completed" = "1" ]]; then
      echo "✅ Emulator boot complete"
      return 0
    fi
    if ! kill -0 $emulator_pid 2>/dev/null; then
      echo "❌ Emulator process died during boot."
      exit 1
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
