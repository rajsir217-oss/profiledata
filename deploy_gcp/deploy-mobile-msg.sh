#!/bin/bash

set -euo pipefail

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Load centralized configuration
. "$SCRIPT_DIR/deploy.config.sh"

# Parse command-line arguments
for arg in "$@"; do
  case $arg in
    --non-interactive)
      NON_INTERACTIVE=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
  esac
done

MSG_DIR="${MSG_DIR:-$REPO_ROOT/messenger}"
MSG_WEB_DIR="${MSG_WEB_DIR:-$REPO_ROOT/messenger-web}"

show_usage() {
  cat << 'EOF'
Usage:
  ./deploy-mobile-msg.sh [--a] [--release] [--rn-android] [--i]

Options:
  --a, --android    Build/run Messenger Web (Capacitor) on Android
  --release         Build release APK (instead of debug) for shipping
  --rn-android      Build/run Messenger (React Native) on Android (legacy)
  --i, --iphone     Build/run Messenger (React Native) on iOS (simulator) (legacy)
  -h, --h, --help   Show this help

Notes:
  - Android defaults to the Capacitor app in ../messenger-web
  - Android requires:
      - Java 21
      - ANDROID_HOME (defaults to ~/Library/Android/sdk)
      - adb/emulator available on PATH
  - Release APKs are saved to messenger-web/android/app/build/outputs/apk/release/
  - Optional GCS upload requires gsutil and these env vars:
      GCS_BUCKET_NAME
      ANDROID_APK_MSGR_GCS_BUCKET_NAME
      ANDROID_APK_MSGR_GCS_OBJECT   (example: mobile/android/l3v3lmatchesMsgr-latest.apk)
EOF
}

DO_CAP_ANDROID=false
DO_RN_ANDROID=false
DO_RN_IOS=false
BUILD_TYPE="debug"

# Cleanup old APKs, keeping only the 3 most recent
cleanup_old_apks() {
  local apk_dir="$1"
  local apk_prefix="$2"
  
  if [[ ! -d "$apk_dir" ]]; then
    return
  fi
  
  # Count APKs matching the prefix
  local apk_count=$(ls -1 "$apk_dir"/${apk_prefix}-*.apk 2>/dev/null | wc -l)
  
  if [[ $apk_count -le 3 ]]; then
    return
  fi
  
  echo "🧹 Cleaning up old APKs (keeping 3 most recent)..."
  
  # List APKs sorted by modification time (newest first), skip first 3, delete the rest
  ls -t "$apk_dir"/${apk_prefix}-*.apk 2>/dev/null | tail -n +4 | while read -r old_apk; do
    if [[ -f "$old_apk" ]]; then
      echo "   Removing: $(basename "$old_apk")"
      rm -f "$old_apk"
    fi
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --a|--android)
      DO_CAP_ANDROID=true
      shift
      ;;
    --release)
      BUILD_TYPE="release"
      shift
      ;;
    --rn-android)
      DO_RN_ANDROID=true
      shift
      ;;
    --i|--iphone|--ios)
      DO_RN_IOS=true
      shift
      ;;
    -h|--h|--help)
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

if [[ "$DO_CAP_ANDROID" != "true" && "$DO_RN_ANDROID" != "true" && "$DO_RN_IOS" != "true" ]]; then
  echo "❌ You must specify at least one of: --a (Capacitor Android), --rn-android (RN Android), or --i (RN iOS)"
  echo ""
  show_usage
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MSG_DIR="$REPO_ROOT/messenger"
MSG_WEB_DIR="$REPO_ROOT/messenger-web"

ensure_java() {
  local java_home=""

  # Prefer Java 21 first (required by Capacitor Android), then 17 as fallback.
  for v in 21 17; do
    java_home="$(/usr/libexec/java_home -v "$v" 2>/dev/null || true)"
    if [[ -n "$java_home" && -d "$java_home" ]]; then
      echo "ℹ️  Using Java $v at: $java_home"
      export JAVA_HOME="$java_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return 0
    fi
  done

  echo "❌ Java 21 or 17 not found. Install one of them:"
  echo "   brew install --cask temurin@21    # recommended for Capacitor"
  echo "   brew install --cask temurin@17"
  exit 1
}

# Kill any process listening on the given TCP port (host machine).
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "🧹 Killing process(es) on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

# Kill any stale Metro / react-native start / packager processes.
kill_stale_metro() {
  echo "🧹 Killing any stale Metro / react-native packager processes..."
  pkill -f "react-native start" 2>/dev/null || true
  pkill -f "metro" 2>/dev/null || true
  kill_port 8081
}

# Kill any stale webpack dev server processes.
kill_stale_webpack() {
  echo "🧹 Killing any stale webpack dev server processes..."
  pkill -f "webpack serve" 2>/dev/null || true
  pkill -f "webpack-dev-server" 2>/dev/null || true
  kill_port 3030
}

# Configure adb reverse mappings so the emulator can reach host services
# at the same port numbers via "localhost".
setup_adb_reverse() {
  if ! command -v adb >/dev/null 2>&1; then
    return 0
  fi
  if ! adb devices | grep -q "device$"; then
    return 0
  fi
  echo "🔌 Setting up adb reverse for ports 8081 (Metro), 3030 (messenger-web), 8000 (backend), 3000 (main app)"
  # Clear any prior (possibly bad) mappings, then set fresh ones.
  adb reverse --remove-all >/dev/null 2>&1 || true
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  adb reverse tcp:3030 tcp:3030 >/dev/null 2>&1 || true
  adb reverse tcp:8000 tcp:8000 >/dev/null 2>&1 || true
  adb reverse tcp:3000 tcp:3000 >/dev/null 2>&1 || true
  adb reverse --list 2>/dev/null | sed 's/^/    /'
}

load_messenger_env() {
  local env_file="$MSG_DIR/.env.local"
  if [[ "${NODE_ENV:-}" = "production" ]] || [[ "${BUILD_TYPE:-}" = "release" ]]; then
    env_file="$MSG_DIR/.env.production"
  fi

  if [[ -f "$env_file" ]]; then
    set -a
    . "$env_file"
    set +a
  fi

  # Load backend env for APK GCS configuration (allow unbound vars for production secrets)
  local backend_env_file="$REPO_ROOT/fastapi_backend/.env.production"
  if [[ -f "$backend_env_file" ]]; then
    set +u  # Temporarily disable nounset for env loading
    set -a
    . "$backend_env_file"
    set +a
    set -u  # Re-enable nounset
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

ensure_capacitor_android_launcher_icons() {
  local src_png="$REPO_ROOT/frontend/public/logo512.png"
  local res_dir="$MSG_WEB_DIR/android/app/src/main/res"
  local backup_root="$MSG_WEB_DIR/android/app/src/main/res_toberemoved"

  if [[ ! -f "$src_png" ]]; then
    echo "⚠️  Launcher icon source not found: $src_png"
    return 0
  fi

  if ! command -v sips >/dev/null 2>&1; then
    echo "⚠️  sips not found; skipping launcher icon generation"
    return 0
  fi

  local mipmap_dirs=(mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi)
  local mipmap_sizes=(48 72 96 144 192)
  local icon_files=(ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png)

  mkdir -p "$backup_root"
  shopt -s nullglob

  for i in "${!mipmap_dirs[@]}"; do
    local out_dir="$res_dir/${mipmap_dirs[$i]}"
    local size="${mipmap_sizes[$i]}"
    local backup_dir="$backup_root/${mipmap_dirs[$i]}"

    if [[ ! -d "$out_dir" ]]; then
      echo "⚠️  Missing Android res dir: $out_dir"
      continue
    fi

    mkdir -p "$backup_dir"

    for old in "$out_dir"/*.toberemoved*; do
      local old_base
      old_base="$(basename "$old")"
      local old_dest="$backup_dir/$old_base"
      if [[ -e "$old_dest" ]]; then
        old_dest="$backup_dir/$old_base.$(date +%Y%m%d-%H%M%S)"
      fi
      mv "$old" "$old_dest"
    done

    for f in "${icon_files[@]}"; do
      local target="$out_dir/$f"
      if [[ -f "$target" ]]; then
        local moved="$backup_dir/${f}.toberemoved"
        if [[ -e "$moved" ]]; then
          moved="$backup_dir/${f}.toberemoved.$(date +%Y%m%d-%H%M%S)"
        fi
        mv "$target" "$moved"
      fi
      sips -z "$size" "$size" "$src_png" --out "$target" >/dev/null 2>&1
    done
  done
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

  if [[ ! -f "$MSG_DIR/package.json" ]]; then
    echo "❌ Messenger (React Native) project not found at: $MSG_DIR"
    exit 1
  fi

  load_messenger_env
  ensure_java
  ensure_android_paths

  if ! command -v adb >/dev/null 2>&1; then
    echo "❌ adb not found on PATH. Expected under: $ANDROID_HOME/platform-tools"
    exit 1
  fi

  if ! command -v emulator >/dev/null 2>&1; then
    echo "❌ emulator not found on PATH. Expected under: $ANDROID_HOME/emulator"
    exit 1
  fi

  # Clean slate: kill any old Metro / packager processes (port 8081).
  kill_stale_metro

  adb start-server >/dev/null 2>&1 || true
  android_start_emulator_if_needed

  # Now that a device is up, configure port forwarding for Metro + backend.
  setup_adb_reverse

  # Start Metro in the background (with cache reset) so the app can fetch JS.
  echo "🟢 Starting Metro (background) with --reset-cache..."
  local metro_log="$REPO_ROOT/messenger/metro.log"
  : > "$metro_log"
  (
    cd "$REPO_ROOT" || exit 1
    nohup npm --prefix messenger start -- --reset-cache >>"$metro_log" 2>&1 &
    echo "$!" > "$REPO_ROOT/messenger/.metro.pid"
    disown || true
  )
  local METRO_PID
  METRO_PID="$(cat "$REPO_ROOT/messenger/.metro.pid" 2>/dev/null || echo '?')"
  echo "    Metro PID: $METRO_PID (logs: messenger/metro.log)"

  # Wait briefly for Metro to come up.
  for _ in $(seq 1 20); do
    if curl -fsS http://localhost:8081/status >/dev/null 2>&1; then
      echo "✅ Metro ready on :8081"
      break
    fi
    sleep 1
  done

  echo "🚀 Running: npm --prefix messenger run android"
  (cd "$REPO_ROOT" && npm --prefix messenger run android)
}

run_capacitor_android() {
  echo "=============================================="
  echo "🤖 Messenger Web (Capacitor) - Android ($BUILD_TYPE)"
  echo "=============================================="

  if [[ ! -f "$MSG_WEB_DIR/package.json" ]]; then
    echo "❌ Messenger Web project not found at: $MSG_WEB_DIR"
    exit 1
  fi

  load_messenger_env
  ensure_java
  ensure_android_paths
  ensure_capacitor_android_launcher_icons

  # Track and increment build number
  local build_num_file="$REPO_ROOT/messenger-web/.build-number"
  local build_num=1
  if [[ -f "$build_num_file" ]]; then
    build_num=$(cat "$build_num_file")
  fi
  local new_build_num=$((build_num + 1))
  echo "$new_build_num" > "$build_num_file"
  echo "📦 Build number: $new_build_num (previous: $build_num)"

  # Update versionCode in Gradle config
  local gradle_file="$MSG_WEB_DIR/android/app/build.gradle"
  if [[ -f "$gradle_file" ]]; then
    # Read current versionCode from build.gradle
    local current_version=$(grep "versionCode" "$gradle_file" | head -1 | awk '{print $2}')
    if [[ -n "$current_version" ]]; then
      sed -i.bak "s/versionCode $current_version/versionCode $new_build_num/" "$gradle_file"
      rm -f "${gradle_file}.bak"
      echo "✅ Updated versionCode to $new_build_num in build.gradle"
    else
      echo "⚠️  Could not find versionCode in build.gradle"
    fi
  fi

  # Configure capacitor.config.json for debug vs release
  # Debug: server.url enables live reload from webpack dev server
  # Release: Remove server block to use bundled dist/ assets + production backend
  local capacitor_config="$MSG_WEB_DIR/capacitor.config.json"
  local capacitor_config_backup="$MSG_WEB_DIR/capacitor.config.json.bak"
  local capacitor_assets_config="$MSG_WEB_DIR/android/app/src/main/assets/capacitor.config.json"
  local capacitor_assets_config_backup="$MSG_WEB_DIR/android/app/src/main/assets/capacitor.config.json.bak"
  if [[ -f "$capacitor_config" ]]; then
    cp "$capacitor_config" "$capacitor_config_backup"
    if [[ -f "$capacitor_assets_config" ]]; then
      cp "$capacitor_assets_config" "$capacitor_assets_config_backup"
    fi
    if [[ "$BUILD_TYPE" == "release" ]]; then
      echo "📦 Release build: Setting server.hostname so CAPTCHA uses production domain (no server.url)"
      node -e "
        const fs = require('fs');
        const cfg = JSON.parse(fs.readFileSync('$capacitor_config'));
        cfg.server = {
          androidScheme: 'https',
          hostname: 'l3v3lmatches.com'
        };
        fs.writeFileSync('$capacitor_config', JSON.stringify(cfg, null, 2));
        if (fs.existsSync('$capacitor_assets_config')) {
          fs.writeFileSync('$capacitor_assets_config', JSON.stringify(cfg, null, 2));
        }
      "
    else
      echo "🔧 Debug build: Setting server.url for live reload from webpack dev server"
      node -e "
        const fs = require('fs');
        const cfg = JSON.parse(fs.readFileSync('$capacitor_config'));
        cfg.server = { androidScheme: 'http', cleartext: true, url: 'http://10.0.2.2:3030' };
        fs.writeFileSync('$capacitor_config', JSON.stringify(cfg, null, 2));
        if (fs.existsSync('$capacitor_assets_config')) {
          fs.writeFileSync('$capacitor_assets_config', JSON.stringify(cfg, null, 2));
        }
      "
    fi
  fi

  # For release builds, we just build the APK without running on emulator
  if [[ "$BUILD_TYPE" == "release" ]]; then
    echo "🏗️  Building release APK..."
    
    # Check if gradle.properties exists for signing
    local gradle_props="$MSG_WEB_DIR/android/gradle.properties"
    if [[ -f "$gradle_props" ]]; then
      echo "📋 Using signing configuration from gradle.properties"
    else
      echo "⚠️  gradle.properties not found, release build will use debug keystore"
      echo "   Copy gradle.properties.template to gradle.properties and fill in keystore details"
    fi
    
    # Use Gradle directly for release builds to properly handle signing
    echo "🏗️  Building messenger-web dist (production)..."
    (cd "$MSG_WEB_DIR" && npm run build)

    if ! command -v npx >/dev/null 2>&1; then
      echo "❌ npx not found on PATH. Install Node.js (npm) and retry."
      exit 1
    fi

    echo "🔄 Copying web assets + capacitor config into Android project..."
    (cd "$MSG_WEB_DIR" && npx cap copy android)

    if grep -q "10\.0\.2\.2:3030" "$capacitor_assets_config" 2>/dev/null; then
      echo "❌ Release build still contains server.url=10.0.2.2:3030 in Android assets config"
      exit 1
    fi

    echo "🧹 Cleaning Android build to avoid stale merged assets..."
    (cd "$MSG_WEB_DIR/android" && ./gradlew clean)

    echo "🔨 Running Gradle assembleRelease..."
    (cd "$MSG_WEB_DIR/android" && ./gradlew assembleRelease)

    local merged_release_config="$MSG_WEB_DIR/android/app/build/intermediates/assets/release/mergeReleaseAssets/capacitor.config.json"
    if [[ -f "$merged_release_config" ]] && grep -q "10\.0\.2\.2:3030" "$merged_release_config"; then
      echo "❌ Release build merged assets still contain server.url=10.0.2.2:3030"
      echo "   Check: $merged_release_config"
      exit 1
    fi
    
    local apk_path="$MSG_WEB_DIR/android/app/build/outputs/apk/release/msgr-app-release-${new_build_num}.apk"
    if [[ -f "$apk_path" ]]; then
      if command -v unzip >/dev/null 2>&1; then
        if unzip -p "$apk_path" assets/capacitor.config.json 2>/dev/null | grep -q "10\.0\.2\.2:3030"; then
          echo "❌ Release APK contains dev server URL (10.0.2.2:3030) in assets/capacitor.config.json"
          exit 1
        fi
      fi
      echo "✅ Release APK built: $apk_path"

      local desktop_apk_name="L3V3L-Messenger-release.apk"
      cp "$apk_path" ~/Desktop/"$desktop_apk_name"
      echo "✅ APK copied to ~/Desktop/${desktop_apk_name}"

      echo "☁️  Uploading RELEASE APK to GCS (optional)..."
      # Load backend env for APK GCS configuration (allow unbound vars for production secrets)
      set +u  # Temporarily disable nounset for env loading
      set -a
      . "$REPO_ROOT/fastapi_backend/.env.production"
      set +a
      set -u  # Re-enable nounset
      local APK_BUCKET_NAME="${ANDROID_APK_MSGR_GCS_BUCKET_NAME:-${ANDROID_APK_GCS_BUCKET_NAME:-${GCS_BUCKET_NAME:-}}}"
      local APK_OBJECT_PATH_RAW="${ANDROID_APK_MSGR_GCS_OBJECT:-${ANDROID_APK_GCS_OBJECT:-}}"
      if [[ -z "${APK_BUCKET_NAME}" || -z "${APK_OBJECT_PATH_RAW}" ]]; then
        echo "⚠️  Skipping GCS upload (missing ANDROID_APK_MSGR_GCS_BUCKET_NAME/GCS_BUCKET_NAME and/or ANDROID_APK_MSGR_GCS_OBJECT env var)"
      elif ! command -v gsutil >/dev/null 2>&1; then
        echo "⚠️  Skipping GCS upload (gsutil not found). Install gcloud/gsutil and retry."
      else
        local APK_OBJECT_PATH="${APK_OBJECT_PATH_RAW#/}"
        local GCS_DEST="gs://${APK_BUCKET_NAME}/${APK_OBJECT_PATH}"
        echo "   Uploading: ${apk_path} -> ${GCS_DEST}"
        gsutil -q cp "$apk_path" "$GCS_DEST"
        echo "✅ Uploaded APK to ${GCS_DEST}"
      fi
    else
      echo "⚠️  APK not found at expected path, listing output directory:"
      ls -la "$MSG_WEB_DIR/android/app/build/outputs/apk/release/" 2>/dev/null || echo "Directory not found"
    fi
    
    # Keep only 3 most recent release APKs
    cleanup_old_apks "$MSG_WEB_DIR/android/app/build/outputs/apk/release" "msgr-app-release"
    
    # Restore original capacitor config
    if [[ -f "$capacitor_config_backup" ]]; then
      mv "$capacitor_config_backup" "$capacitor_config"
    fi
    if [[ -f "$capacitor_assets_config_backup" ]]; then
      mv "$capacitor_assets_config_backup" "$capacitor_assets_config"
    fi
    return
  fi

  # Debug builds: run on emulator
  if ! command -v adb >/dev/null 2>&1; then
    echo "❌ adb not found on PATH. Expected under: $ANDROID_HOME/platform-tools"
    exit 1
  fi

  if ! command -v emulator >/dev/null 2>&1; then
    echo "❌ emulator not found on PATH. Expected under: $ANDROID_HOME/emulator"
    exit 1
  fi

  kill_stale_webpack

  adb start-server >/dev/null 2>&1 || true
  android_start_emulator_if_needed

  # Configure port forwarding so the app can reach host backend at localhost:8000 if needed.
  setup_adb_reverse

  echo "🟢 Starting messenger-web dev server (background)..."
  local webpack_log="$REPO_ROOT/messenger-web/webpack.log"
  : > "$webpack_log"
  (
    cd "$REPO_ROOT" || exit 1
    nohup npm --prefix messenger-web start -- --host 0.0.0.0 >>"$webpack_log" 2>&1 &
    echo "$!" > "$REPO_ROOT/messenger-web/.webpack.pid"
    disown || true
  )
  local WEB_PID
  WEB_PID="$(cat "$REPO_ROOT/messenger-web/.webpack.pid" 2>/dev/null || echo '?')"
  echo "    Dev server PID: $WEB_PID (logs: messenger-web/webpack.log)"

  # Wait briefly for the dev server to come up.
  for _ in $(seq 1 30); do
    if curl -fsS http://localhost:3030/ >/dev/null 2>&1; then
      echo "✅ messenger-web dev server ready on :3030"
      break
    fi
    sleep 1
  done

  if ! command -v npx >/dev/null 2>&1; then
    echo "❌ npx not found on PATH. Install Node.js (npm) and retry."
    exit 1
  fi

  # Use Gradle directly to build debug APK with our custom naming
  echo "� Running Gradle assembleDebug..."
  (cd "$MSG_WEB_DIR/android" && ./gradlew assembleDebug)
  
  # Find and install the renamed debug APK
  local debug_apk_path="$MSG_WEB_DIR/android/app/build/outputs/apk/debug/msgr-app-debug-${new_build_num}.apk"
  if [[ -f "$debug_apk_path" ]]; then
    echo "📦 Installing $debug_apk_path to emulator..."
    adb install -r "$debug_apk_path"
    echo "🚀 Launching app..."
    adb shell am start -n ${MSGR_APP_PACKAGE}.debug/${MSGR_APP_PACKAGE}.MainActivity
    echo "✅ Debug APK installed and launched"
  else
    echo "⚠️  Debug APK not found at expected path: $debug_apk_path"
    ls -la "$MSG_WEB_DIR/android/app/build/outputs/apk/debug/" 2>/dev/null || echo "Directory not found"
  fi
  
  # Keep only 3 most recent debug APKs
  cleanup_old_apks "$MSG_WEB_DIR/android/app/build/outputs/apk/debug" "msgr-app-debug"
  
  # Restore original capacitor config
  if [[ -f "$capacitor_config_backup" ]]; then
    mv "$capacitor_config_backup" "$capacitor_config"
  fi
  if [[ -f "$capacitor_assets_config_backup" ]]; then
    mv "$capacitor_assets_config_backup" "$capacitor_assets_config"
  fi
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

if [[ "$DO_CAP_ANDROID" = "true" ]]; then
  run_capacitor_android
fi

if [[ "$DO_RN_ANDROID" = "true" ]]; then
  run_android
fi

if [[ "$DO_RN_IOS" = "true" ]]; then
  run_ios
fi
