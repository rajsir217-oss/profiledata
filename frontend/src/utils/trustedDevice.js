const TRUSTED_DEVICE_ID_KEY = 'trustedDeviceId';
const TRUSTED_DEVICE_TOKEN_KEY = 'trustedDeviceToken';
const TRUSTED_DEVICE_TOKENS_KEY = 'trustedDeviceTokens';
const TRUSTED_DEVICE_APP_ID = 'profiledata-web';

const generateDeviceId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  const arr = new Uint8Array(16);
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const _getTokensMap = () => {
  try {
    return JSON.parse(localStorage.getItem(TRUSTED_DEVICE_TOKENS_KEY) || '{}');
  } catch (_) {
    return {};
  }
};

const _setTokensMap = (map) => {
  try {
    localStorage.setItem(TRUSTED_DEVICE_TOKENS_KEY, JSON.stringify(map));
  } catch (_) {}
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

export const getTrustedDeviceToken = (username = null) => {
  const map = _getTokensMap();
  if (username) {
    return map[username] || null;
  }
  return localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY) || null;
};

export const getTrustedUsernames = () => {
  return Object.keys(_getTokensMap());
};

export const setTrustedDeviceToken = (username, token) => {
  if (!token) return;
  try {
    localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
    if (username) {
      const map = _getTokensMap();
      map[username] = token;
      _setTokensMap(map);
    }
  } catch (_) {}
};

export const clearTrustedDeviceToken = (identifier = null) => {
  try {
    if (!identifier) {
      localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
      return;
    }

    const map = _getTokensMap();
    let tokenToRemove = null;

    if (map[identifier]) {
      // identifier is a username
      tokenToRemove = map[identifier];
      delete map[identifier];
    } else if (typeof identifier === 'string' && identifier.length > 0) {
      // identifier may be the token value itself
      tokenToRemove = identifier;
      for (const [u, t] of Object.entries(map)) {
        if (t === tokenToRemove) {
          delete map[u];
        }
      }
    }

    _setTokensMap(map);
    const generic = localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY);
    if (generic && generic === tokenToRemove) {
      localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
    }
  } catch (_) {}
};

export const clearAllTrustedDeviceTokens = () => {
  try {
    localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
    localStorage.removeItem(TRUSTED_DEVICE_TOKENS_KEY);
  } catch (_) {}
};
