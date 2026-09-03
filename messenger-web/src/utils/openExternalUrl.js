import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../services/biometricAuth';
import logger from './logger';

const namedWindows = {};

/**
 * Open an external URL.
 * Uses Capacitor Browser plugin in native apps, window.open in web.
 * @param {string} url
 * @param {string} [target='_blank']
 * @param {boolean} [forceExternal=false] - Force external browser on Android
 */
export const openExternalUrl = async (url, target = '_blank', forceExternal = false) => {
  if (!url) return;

  if (isNativePlatform()) {
    try {
      // Always use Capacitor Browser plugin for native platforms
      // The forceExternal parameter is ignored since window.open doesn't work reliably in Capacitor
      await Browser.open({ url });
    } catch (err) {
      logger.error('Browser.open failed:', err);
    }
  } else if (typeof window !== 'undefined' && window.open) {
    // Reuse an already-open named tab when possible. We must NOT touch
    // `location.href` directly (the main app is cross-origin from
    // messenger-web, so that throws a SecurityError). Instead we let the
    // browser navigate the named target for us — calling window.open with
    // the same name reuses that tab natively, even cross-origin.
    //
    // Also avoid the 'noopener' feature: it forces a brand-new browsing
    // context on every call (returns null), which caused a fresh tab to
    // spawn on each click.
    if (target && target !== '_blank' && namedWindows[target] && !namedWindows[target].closed) {
      const existing = window.open(url, target);
      if (existing) {
        namedWindows[target] = existing;
        try {
          existing.focus();
        } catch (_) {
          // Focus may be blocked cross-origin — safe to ignore.
        }
        return;
      }
    }

    const win = window.open(url, target);
    if (win && target && target !== '_blank') {
      namedWindows[target] = win;
    }
  }
};
