/**
 * API Configuration for L3V3L Messenger
 * Mirrors the pattern from frontend/src/config/apiConfig.js
 */

const ENV = __DEV__ ? 'development' : 'production';

let _cachedProcessEnv = null;

const getProcessEnv = () => {
  try {
    if (typeof process === 'undefined' || !process) return null;
    const env = process.env;
    if (!env) return null;
    if (typeof env === 'object') return env;
    if (typeof env === 'string') {
      if (_cachedProcessEnv) return _cachedProcessEnv;
      try {
        _cachedProcessEnv = JSON.parse(env);
        return _cachedProcessEnv;
      } catch (_) {
        return null;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
};

const readOverride = (key) => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis[key] === 'string') {
      return globalThis[key];
    }
  } catch (_) {}
  try {
    const env = getProcessEnv();
    if (env && typeof env[key] === 'string') {
      return env[key];
    }
  } catch (_) {}
  return null;
};

const DEFAULT_BASE_URL =
  readOverride('MESSENGER_BACKEND_URL') ||
  (typeof process !== 'undefined' && process?.env ? process.env.MESSENGER_BACKEND_URL : null) ||
  readOverride('__L3V3L_MESSENGER_DEFAULT_BASE_URL__') ||
  (typeof process !== 'undefined' && process?.env ? process.env.__L3V3L_MESSENGER_DEFAULT_BASE_URL__ : null);

const DEFAULT_WS_URL =
  readOverride('MESSENGER_WS_URL') ||
  (typeof process !== 'undefined' && process?.env ? process.env.MESSENGER_WS_URL : null) ||
  readOverride('__L3V3L_MESSENGER_DEFAULT_WS_URL__') ||
  (typeof process !== 'undefined' && process?.env ? process.env.__L3V3L_MESSENGER_DEFAULT_WS_URL__ : null) ||
  DEFAULT_BASE_URL;

const DEV_BASE_URL = readOverride('__L3V3L_MESSENGER_DEV_BASE_URL__') || null;
const DEV_WS_URL = readOverride('__L3V3L_MESSENGER_DEV_WS_URL__') || null;

const CONFIG = {
  development: {
    BASE_URL: DEV_BASE_URL || DEFAULT_BASE_URL,
    WS_URL: DEV_WS_URL || DEV_BASE_URL || DEFAULT_WS_URL,
  },
  production: {
    BASE_URL: DEFAULT_BASE_URL,
    WS_URL: DEFAULT_WS_URL,
  },
};

const current = CONFIG[ENV] || CONFIG.production;

const cleanUrl = (url) => String(url || '').replace(/\/+$/, '');

export const API_BASE_URL = cleanUrl(current.BASE_URL);
export const WS_URL = cleanUrl(current.WS_URL);
export const MESSENGER_API = `${API_BASE_URL}/api/messenger`;

export default {
  API_BASE_URL,
  WS_URL,
  MESSENGER_API,
};
