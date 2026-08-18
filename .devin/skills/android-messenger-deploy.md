---
description: Deploy the L3V3L Matches Messenger Android app via Capacitor or React Native.
---

# Skill: Deploy Android Messenger

## App identity

- App name: **L3V3L Matches Messenger**
- Android package ID / iOS bundle ID: `com.l3v3lmessenger`
- The existing React Native messenger lives at `messenger/`.
- The Capacitor-evaluated web messenger lives at `messenger-web/` (React 18 + webpack 5, build output `dist/`).

## Development mode

Capacitor live reload from the webpack dev server:

```javascript
// capacitor.config or equivalent
server: { url: 'http://10.0.2.2:3030' }
```

Backend reach from the emulator:

```bash
adb reverse tcp:8000 tcp:8000
```

This is already set up in `deploy_gcp/deploy-mobile-msg.sh`.

## Production mode

Bundle the static `messenger-web/dist/` output inside the app.

## Coexistence with React Native

The Capacitor app and the RN app share the package ID `com.l3v3lmessenger`. The Capacitor app will overwrite the RN app on the emulator.

Reinstall the RN app if needed:

```bash
./deploy-mobile-msg.sh --a
```

## Launcher icon generation

Before regenerating Android launcher icons, move old icons and any `*.toberemoved*` artifacts out of `android/app/src/main/res/mipmap-*/`.

Use a backup directory outside `res/`:

```bash
android/app/src/main/res_toberemoved/<density>/
```

AAPT requires resource filenames to end with `.png` or `.xml`; `*.toberemoved*` inside `res/` causes Gradle resource merge failures.

This is handled in `deploy_gcp/deploy-mobile-msg.sh` in `ensure_capacitor_android_launcher_icons()`.

## APK download configuration

The backend endpoint `/api/mobile/android/apk-url` accepts `app=main|msgr`.

Env vars for messenger APK:
- `ANDROID_APK_MSGR_GCS_BUCKET_NAME`
- `ANDROID_APK_MSGR_GCS_OBJECT`

Legacy fallback:
- `ANDROID_APK_GCS_BUCKET_NAME`
- `ANDROID_APK_GCS_OBJECT`

`deploy_backend_simple.sh` injects both main and messenger vars into Cloud Run.

## Future iOS

Requires Xcode + CocoaPods. Defer until Capacitor proves out on Android.
