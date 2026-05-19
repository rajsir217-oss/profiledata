import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';

const BIOMETRIC_FLAG_KEY = 'biometricLoginEnabled';
const BIOMETRIC_SERVER_KEY = 'l3v3lmatches';

export const isNativePlatform = () => {
  try {
    return typeof Capacitor !== 'undefined' && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
};

export const isBiometricEnabled = () => {
  try {
    return localStorage.getItem(BIOMETRIC_FLAG_KEY) === 'true';
  } catch (_) {
    return false;
  }
};

export const setBiometricEnabledFlag = (enabled) => {
  try {
    if (enabled) {
      localStorage.setItem(BIOMETRIC_FLAG_KEY, 'true');
    } else {
      localStorage.removeItem(BIOMETRIC_FLAG_KEY);
    }
  } catch (_) {
  }
};

export const isBiometricAvailable = async () => {
  if (!isNativePlatform()) return { isAvailable: false };
  try {
    return await NativeBiometric.isAvailable({ useFallback: true });
  } catch (e) {
    logger.debug('NativeBiometric.isAvailable failed', e);
    return { isAvailable: false };
  }
};

export const isCredentialSaved = async () => {
  if (!isNativePlatform()) return false;
  try {
    const res = await NativeBiometric.isCredentialsSaved({ server: BIOMETRIC_SERVER_KEY });
    return !!res?.isSaved;
  } catch (e) {
    logger.debug('NativeBiometric.isCredentialsSaved failed', e);
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

  setBiometricEnabledFlag(true);
  return { ok: true };
};

export const clearCredential = async () => {
  if (!isNativePlatform()) {
    setBiometricEnabledFlag(false);
    return;
  }

  try {
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER_KEY });
  } catch (e) {
    logger.debug('NativeBiometric.deleteCredentials failed', e);
  } finally {
    setBiometricEnabledFlag(false);
  }
};

export const biometricLogin = async () => {
  if (!isNativePlatform()) {
    return { ok: false, error: 'Not running on a native device.' };
  }

  try {
    const availability = await isBiometricAvailable();
    if (!availability?.isAvailable) {
      return { ok: false, error: 'Biometric authentication is not available on this device.' };
    }

    await NativeBiometric.verifyIdentity({
      reason: 'Authenticate to sign in',
      title: 'Sign in',
      subtitle: 'L3V3L Matches',
      description: '',
    });

    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER_KEY });
    const refreshToken = creds?.password;
    const storedUsername = creds?.username;

    if (!refreshToken) {
      return { ok: false, error: 'No biometric credential is stored on this device.' };
    }

    const refreshRes = await axios.post(
      `${getBackendUrl()}/api/auth/refresh-token`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const accessToken = refreshRes.data?.access_token;
    if (!accessToken) {
      return { ok: false, error: 'Failed to refresh session.' };
    }

    const meRes = await axios.get(`${getBackendUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = meRes.data?.user || meRes.data;

    return {
      ok: true,
      accessToken,
      refreshToken,
      user,
      username: user?.username || storedUsername || null,
    };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      return { ok: false, error: 'Biometric session expired. Please log in with password.' };
    }
    if (e?.message) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: 'Biometric login failed.' };
  }
};
