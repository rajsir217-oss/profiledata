import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const BIOMETRIC_SERVER_KEY = 'l3v3lmatches_messenger';

export const isNativePlatform = () => {
  try {
    return Platform.OS !== 'web';
  } catch (_) {
    return false;
  }
};

export const isBiometricAvailable = async () => {
  if (!isNativePlatform()) return { isAvailable: false };
  try {
    const type = await Keychain.getSupportedBiometryType();
    return { isAvailable: !!type };
  } catch (_) {
    return { isAvailable: false };
  }
};

export const isCredentialSaved = async () => {
  if (!isNativePlatform()) return false;
  try {
    return await Keychain.hasGenericPassword({ service: BIOMETRIC_SERVER_KEY });
  } catch (_) {
    return false;
  }
};

export const saveCredential = async ({
  username,
  refreshToken,
}: {
  username: string;
  refreshToken: string;
}): Promise<{ ok: boolean; error?: string }> => {
  if (!isNativePlatform()) return { ok: false, error: 'Not running on a native device.' };
  if (!username || !refreshToken) return { ok: false, error: 'Missing username or refresh token.' };

  const availability = await isBiometricAvailable();
  if (!availability?.isAvailable) {
    return { ok: false, error: 'Biometric authentication is not available on this device.' };
  }

  try {
    const res = await Keychain.setGenericPassword(username, refreshToken, {
      service: BIOMETRIC_SERVER_KEY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      authenticationPrompt: {
        title: 'Enable biometric login',
        cancel: 'Cancel',
      },
    });
    if (!res) {
      return { ok: false, error: 'Failed to save biometric credentials.' };
    }
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message || 'Failed to save biometric credentials.';
    return { ok: false, error: msg };
  }
};

export const clearCredential = async () => {
  if (!isNativePlatform()) return;
  try {
    await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVER_KEY });
  } catch (_) {
    // best-effort cleanup
  }
};

export const biometricGetRefreshToken = async () => {
  if (!isNativePlatform()) return { ok: false, error: 'Not running on a native device.' };

  try {
    const availability = await isBiometricAvailable();
    if (!availability?.isAvailable) {
      return { ok: false, error: 'Biometric authentication is not available on this device.' };
    }

    const credentials = await Keychain.getGenericPassword({
      service: BIOMETRIC_SERVER_KEY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: {
        title: 'Sign in',
        subtitle: 'Authenticate to access L3V3L Messenger',
        description: '',
        cancel: 'Cancel',
      },
    });

    if (!credentials) {
      return { ok: false, error: 'No biometric credential is stored on this device.' };
    }

    const refreshToken = credentials.password;
    if (!refreshToken) {
      return { ok: false, error: 'No biometric credential is stored on this device.' };
    }

    return { ok: true, refreshToken, username: credentials.username || null };
  } catch (e: any) {
    const msg = e?.message || 'Biometric authentication failed.';
    return { ok: false, error: msg };
  }
};
