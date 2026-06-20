import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '../services/biometricAuth';

/**
 * Open an external URL.
 * Uses Capacitor Browser plugin in native apps, window.open in web.
 * @param {string} url
 * @param {string} [target='_blank']
 */
export const openExternalUrl = async (url, target = '_blank') => {
  if (!url) return;

  if (isNativePlatform()) {
    try {
      await Browser.open({ url });
    } catch (err) {
      console.error('Browser.open failed:', err);
    }
  } else if (typeof window !== 'undefined' && window.open) {
    const features = 'noopener,noreferrer';
    window.open(url, target, features);
  }
};
