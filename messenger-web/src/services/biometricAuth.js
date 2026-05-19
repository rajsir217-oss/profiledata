import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const BIOMETRIC_SERVER_KEY = 'l3v3lmatches_messenger';

export const isNativePlatform = () => {
  try {
    return typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
};

export const isBiometricAvailable = async () => {
  if (!isNativePlatform()) return { isAvailable: false };
  try {
    return await NativeBiometric.isAvailable({ useFallback: true });
  } catch (_) {
    return { isAvailable: false };
  }
};

export const isCredentialSaved = async () => {
  if (!isNativePlatform()) return false;
  try {
    const res = await NativeBiometric.isCredentialsSaved({ server: BIOMETRIC_SERVER_KEY });
    return !!res?.isSaved;
  } catch (_) {
    return false;
  }
};

export const saveCredential = async ({ username, refreshToken }) => {
  if (!isNativePlatform()) return { ok: false, error: 'Not running on a native device.' };
  if (!username || !refreshToken) return { ok: false, error: 'Missing username or refresh token.' };

  const availability = await isBiometricAvailable();
  if (!availability?.isAvailable) {
    return { ok: false, error: 'Biometric authentication is not available on this device.' };
  }

  await NativeBiometric.setCredentials({
    username,
    password: refreshToken,
    server: BIOMETRIC_SERVER_KEY,
  });

  return { ok: true };
};

export const clearCredential = async () => {
  if (!isNativePlatform()) return;
  await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_KEY });
};

export const biometricGetRefreshToken = async () => {
  if (!isNativePlatform()) return { ok: false, error: 'Not running on a native device.' };

  try {
    const availability = await isBiometricAvailable();
    if (!availability?.isAvailable) {
      return { ok: false, error: 'Biometric authentication is not available on this device.' };
    }

    await NativeBiometric.verifyIdentity({
      reason: 'Authenticate to sign in',
      title: 'Sign in',
      subtitle: 'L3V3L Messenger',
      description: '',
    });

    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
    const refreshToken = creds?.password;
    if (!refreshToken) {
      return { ok: false, error: 'No biometric credential is stored on this device.' };
    }

    return { ok: true, refreshToken, username: creds?.username || null };
  } catch (e) {
    const msg = e?.message || 'Biometric authentication failed.';
    return { ok: false, error: msg };
  }
};
