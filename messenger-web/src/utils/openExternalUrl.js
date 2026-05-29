import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../services/biometricAuth';

/**
 * Open an external URL.
 * Uses Capacitor Browser plugin in native apps, window.open in web.
 * @param {string} url
 */
export const openExternalUrl = async (url) => {
  if (!url) return;

  if (isNativePlatform()) {
    try {
      await Browser.open({ url });
    } catch (err) {
      console.error('Browser.open failed:', err);
    }
  } else if (typeof window !== 'undefined' && window.open) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
