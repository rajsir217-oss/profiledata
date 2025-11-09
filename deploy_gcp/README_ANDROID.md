# 📱 L3V3L Matrimony - Android App Development

Complete guide for building and testing the Android version of L3V3L Matrimony.

---

## 🚀 Quick Start

### First Time Setup (Run Once)

```bash
cd deploy_gcp
chmod +x setup_android.sh build_android.sh build_android_dev.sh android_emulator.sh
./setup_android.sh
```

This will:
- Install Capacitor packages
- Create Android project structure
- Configure build files
- Build initial version

### Build & Run on Emulator

```bash
./build_android.sh
```

---

## 📋 Available Scripts

### `setup_android.sh`
**One-time setup** - Installs Capacitor and creates Android project.

```bash
./setup_android.sh
```

**What it does:**
- ✅ Checks Node.js and Android SDK
- ✅ Installs Capacitor packages
- ✅ Creates `frontend/android/` directory
- ✅ Updates `.gitignore` and `.gcloudignore`
- ✅ Builds and syncs initial version

---

### `build_android.sh`
**Production build** - Builds React app and deploys to emulator.

```bash
./build_android.sh
```

**What it does:**
- ✅ Starts emulator if not running
- ✅ Builds React production bundle
- ✅ Copies web assets to Android
- ✅ Syncs native dependencies
- ✅ Builds APK
- ✅ Installs on emulator
- ✅ Launches app

**Output:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

### `build_android_dev.sh`
**Development mode** - Uses live React dev server with hot reload.

```bash
# Terminal 1: Start React dev server
cd frontend
npm start

# Terminal 2: Build and run in dev mode
cd deploy_gcp
./build_android_dev.sh
```

**Benefits:**
- ⚡ Live reload - changes update instantly
- 🔍 React DevTools available
- 🐛 Full Chrome debugging

**Note:** Configures app to connect to `http://10.0.2.2:3000` (Android emulator's localhost)

---

### `android_emulator.sh`
**Emulator management** - Control Android emulator.

```bash
# Start emulator
./android_emulator.sh start

# Stop emulator
./android_emulator.sh stop

# Restart emulator
./android_emulator.sh restart

# Show status
./android_emulator.sh status

# List available emulators
./android_emulator.sh list

# Show live logs
./android_emulator.sh logs

# Install APK manually
./android_emulator.sh install

# Uninstall app
./android_emulator.sh uninstall
```

---

## 🔧 Development Workflow

### Option 1: Production Build (Slower, Stable)

```bash
# 1. Make changes to React code
vim frontend/src/components/Dashboard.js

# 2. Build and deploy
./build_android.sh

# 3. Test on emulator
# App launches automatically
```

**When to use:** Testing production-like builds, final testing before release.

---

### Option 2: Dev Mode (Faster, Hot Reload)

```bash
# Terminal 1: Start React dev server
cd frontend
npm start
# ✅ Server running on http://localhost:3000

# Terminal 2: Build and run in dev mode
cd deploy_gcp
./build_android_dev.sh
# ✅ App launches, connected to dev server

# Terminal 1: Make changes
# Edit files in frontend/src/
# ⚡ Changes auto-reload in emulator!
```

**When to use:** Active development, rapid iteration, debugging.

---

## 🐛 Debugging

### Chrome DevTools

1. Open Chrome browser
2. Navigate to: `chrome://inspect`
3. Find "L3V3L Matrimony" under "Remote Target"
4. Click **"Inspect"**
5. Full DevTools available! (Console, Network, Elements, etc.)

### View Logs

```bash
# Option 1: Using our script
./android_emulator.sh logs

# Option 2: Direct adb
adb logcat | grep -i "matrimony\|chromium"

# Option 3: Android Studio
# Open: View → Tool Windows → Logcat
```

### Common Issues

**App shows blank screen:**
```bash
# Check server URL in capacitor.config.json
# For dev: "url": "http://10.0.2.2:3000"
# For prod: "url": "https://l3v3lmatches.com"
```

**"Failed to connect to server":**
```bash
# Make sure React dev server is running
cd frontend
npm start

# Or switch to production mode
mv capacitor.config.json.backup capacitor.config.json
./build_android.sh
```

**Emulator won't start:**
```bash
# Check available emulators
./android_emulator.sh list

# Restart emulator
./android_emulator.sh restart
```

---

## 📦 Building for Release

### Debug APK (for testing)

```bash
./build_android.sh
# Output: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

**Can be installed on any device for testing** (no signing required).

### Release APK (for Google Play Store)

```bash
cd frontend/android

# Build release APK
./gradlew assembleRelease

# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

**Needs to be signed** before uploading to Play Store.

### Signing for Play Store

1. **Create keystore (one-time):**

```bash
keytool -genkey -v -keystore l3v3l-release.keystore \
  -alias l3v3l -keyalg RSA -keysize 2048 -validity 10000
```

2. **Create `keystore.properties`:**

```bash
cd frontend/android
cat > keystore.properties << EOF
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=l3v3l
storeFile=../l3v3l-release.keystore
EOF
```

3. **Update `app/build.gradle`:**

Add before `android {`:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Add inside `android {`:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile file(keystoreProperties['storeFile'])
        storePassword keystoreProperties['storePassword']
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

4. **Build signed APK:**

```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk (SIGNED!)
```

---

## 📱 Testing Checklist

Before releasing, test:

- [ ] **App launches** - Shows splash screen, loads correctly
- [ ] **Login/Register** - Authentication works
- [ ] **Navigation** - All menu items accessible
- [ ] **Search** - Can search and view profiles
- [ ] **Messages** - Can send/receive messages
- [ ] **Profile** - Can view and edit profile
- [ ] **Images** - Photos load correctly
- [ ] **Notifications** - Push notifications work (if enabled)
- [ ] **Offline** - App handles no network gracefully
- [ ] **Rotation** - Landscape/portrait both work
- [ ] **Back button** - Android back button works correctly
- [ ] **Deep links** - Share links open in app
- [ ] **Performance** - Smooth scrolling, no lag

---

## 🔐 Security Notes

### DO NOT Commit:
- ❌ `*.keystore` files
- ❌ `keystore.properties`
- ❌ `frontend/android/` (build artifacts)

### DO Commit:
- ✅ `capacitor.config.json`
- ✅ Build scripts (`*.sh`)
- ✅ This README

---

## 📊 File Structure

```
profiledata/
├── frontend/
│   ├── android/              ← Android project (git ignored)
│   │   ├── app/
│   │   │   ├── src/
│   │   │   └── build.gradle
│   │   └── build/
│   │       └── outputs/apk/  ← APK files here
│   ├── src/                  ← React source code
│   ├── build/                ← React production build
│   └── capacitor.config.json ← Capacitor configuration
└── deploy_gcp/
    ├── setup_android.sh      ← One-time setup
    ├── build_android.sh      ← Production build
    ├── build_android_dev.sh  ← Development build
    ├── android_emulator.sh   ← Emulator management
    └── README_ANDROID.md     ← This file
```

---

## 🆘 Help & Troubleshooting

### Get Status
```bash
./android_emulator.sh status
```

### View Logs
```bash
./android_emulator.sh logs
```

### Reset Everything
```bash
# Uninstall app
./android_emulator.sh uninstall

# Remove Android project
rm -rf frontend/android

# Start fresh
./setup_android.sh
```

### Need Help?
- Check Chrome DevTools: `chrome://inspect`
- View logs: `./android_emulator.sh logs`
- Restart emulator: `./android_emulator.sh restart`
- Check Android Studio: `npx cap open android`

---

## 📚 Resources

- **Capacitor Docs:** https://capacitorjs.com/docs
- **Android Developer Guide:** https://developer.android.com/guide
- **React Native Performance:** https://reactnative.dev/docs/performance

---

**🎉 Happy Building!**
