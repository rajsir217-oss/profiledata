/**
 * API Configuration for L3V3L Messenger
 * Mirrors the pattern from frontend/src/config/apiConfig.js
 */

import { Platform } from 'react-native';

const ENV = __DEV__ ? 'development' : 'production';

const CONFIG = {
  development: {
    // Android emulator uses 10.0.2.2 to reach host machine
    // iOS simulator uses localhost
    BASE_URL: Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://localhost:8000',
    WS_URL: Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://localhost:8000',
  },
  production: {
    BASE_URL: 'https://l3v3lmatches.com',
    WS_URL: 'https://l3v3lmatches.com',
  },
};

const current = CONFIG[ENV] || CONFIG.production;

export const API_BASE_URL = current.BASE_URL;
export const WS_URL = current.WS_URL;
export const MESSENGER_API = `${current.BASE_URL}/api/messenger`;

export default {
  API_BASE_URL,
  WS_URL,
  MESSENGER_API,
};
