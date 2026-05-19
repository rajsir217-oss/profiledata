jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

jest.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: {
    isAvailable: jest.fn(),
    isCredentialsSaved: jest.fn(),
    setCredentials: jest.fn(),
    deleteCredentials: jest.fn(),
    verifyIdentity: jest.fn(),
    getCredentials: jest.fn(),
  },
}));

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../config/apiConfig', () => ({
  getBackendUrl: () => 'https://example.test',
}));

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

import {
  isBiometricAvailable,
  isCredentialSaved,
  isNativePlatform,
  saveCredential,
  biometricLogin,
} from './biometricAuth';

describe('biometricAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('isNativePlatform returns false when Capacitor reports non-native', () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    expect(isNativePlatform()).toBe(false);
  });

  test('isBiometricAvailable returns isAvailable:false on non-native', async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    const res = await isBiometricAvailable();
    expect(res).toEqual({ isAvailable: false });
  });

  test('isBiometricAvailable proxies NativeBiometric.isAvailable when native', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    NativeBiometric.isAvailable.mockResolvedValue({ isAvailable: true });
    const res = await isBiometricAvailable();
    expect(res).toEqual({ isAvailable: true });
  });

  test('isCredentialSaved returns false on non-native', async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    const res = await isCredentialSaved();
    expect(res).toBe(false);
  });

  test('saveCredential rejects missing username/refreshToken', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    const res = await saveCredential({ username: '', refreshToken: '' });
    expect(res.ok).toBe(false);
  });

  test('biometricLogin refreshes access token and loads /me', async () => {
    Capacitor.isNativePlatform.mockReturnValue(true);
    NativeBiometric.isAvailable.mockResolvedValue({ isAvailable: true });
    NativeBiometric.verifyIdentity.mockResolvedValue(undefined);
    NativeBiometric.getCredentials.mockResolvedValue({ username: 'u', password: 'rt' });

    axios.post.mockResolvedValue({ data: { access_token: 'at' } });
    axios.get.mockResolvedValue({ data: { user: { username: 'u' } } });

    const res = await biometricLogin();
    expect(res.ok).toBe(true);
    expect(res.accessToken).toBe('at');
    expect(res.refreshToken).toBe('rt');
    expect(res.user.username).toBe('u');
  });
});
