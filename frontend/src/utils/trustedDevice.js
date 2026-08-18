const TRUSTED_DEVICE_ID_KEY = 'trustedDeviceId';
const TRUSTED_DEVICE_TOKEN_KEY = 'trustedDeviceToken';
const TRUSTED_DEVICE_APP_ID = 'profiledata-web';

const generateDeviceId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getTrustedDeviceAppId = () => TRUSTED_DEVICE_APP_ID;

export const getOrCreateTrustedDeviceId = () => {
  let deviceId = localStorage.getItem(TRUSTED_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(TRUSTED_DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const getTrustedDeviceContext = () => ({
  deviceId: getOrCreateTrustedDeviceId(),
  appId: TRUSTED_DEVICE_APP_ID,
  platform: navigator.userAgent,
  deviceName: `${navigator.platform || 'web'} browser`,
});

export const getTrustedDeviceToken = () => localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY);

export const setTrustedDeviceToken = (token) => {
  if (!token) return;
  localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
};

export const clearTrustedDeviceToken = () => {
  localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
};
