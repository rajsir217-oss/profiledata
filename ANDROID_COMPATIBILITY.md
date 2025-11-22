# Android App Compatibility Guide

## 1. Capacitor Configuration
The project is already set up with Capacitor (`frontend/android` exists).
*   **Config File:** `frontend/capacitor.config.json`
    *   Ensure `webDir` is set to `build`.
    *   Ensure `server.url` matches your dev server (e.g., `http://192.168.x.x:3000`) for live reload, or is removed for production builds.
    *   **Critical:** Android by default blocks cleartext HTTP. You must configure `android:usesCleartextTraffic="true"` in `AndroidManifest.xml` for development with a local backend.

## 2. Responsive Design Checklist
To ensure a native-like feel on Android:

### Viewport
*   Ensure `public/index.html` has:
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    ```
    This prevents accidental zooming on inputs.

### Navigation
*   **Bottom Tabs:** Consider adding a mobile-only bottom navigation bar for key sections (Dashboard, Search, Messages, Profile).
*   **Back Button:** Handle hardware back button events in Capacitor:
    ```javascript
    import { App } from '@capacitor/app';
    App.addListener('backButton', ({ canGoBack }) => {
      if(!canGoBack){ App.exitApp(); } else { window.history.back(); }
    });
    ```

### Touch Interactions
*   **Active States:** Ensure `:active` CSS states provide immediate feedback.
*   **Safe Areas:** Account for the notch/status bar using `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.

## 3. Feature Compatibility
*   **Push Notifications:** The backend has FCM keys in `config.py`. Ensure `@capacitor/push-notifications` is installed and configured in the Android project.
*   **Camera/Photos:** Usage of `<input type="file">` works, but `@capacitor/camera` provides a better native experience for profile picture uploads.
*   **Geolocation:** If location services are used, use `@capacitor/geolocation` instead of the web API for better permission handling on Android.

## 4. Build & Deploy
1.  **Build Frontend:** `npm run build`
2.  **Sync Capacitor:** `npx cap sync android`
3.  **Open Android Studio:** `npx cap open android`
4.  **Run:** Select your emulator or connected device and run.

## 5. Debugging
*   Use Chrome Remote Debugging (`chrome://inspect`) to debug the WebView on the Android device/emulator. This allows you to see the console and inspect elements just like on the web.
