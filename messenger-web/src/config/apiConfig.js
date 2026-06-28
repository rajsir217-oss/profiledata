// messenger-web/src/config/apiConfig.js
// Centralized API configuration for messenger web client

/**
 * Get the backend API URL based on hostname
 * @returns {string} Backend URL
 * 
 * Environment detection:
 * - Local dev (localhost): http://localhost:8000
 * - Production (messenger.l3v3lmatches.com): https://api.l3v3lmatches.com
 */
export const getBackendUrl = () => {
  const raw = process.env.MESSENGER_BACKEND_URL;
  const cleaned = String(raw || '').replace(/\/+$/, '');
  if (cleaned) return cleaned;

  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000';
      }
    }
  } catch (_) {
  }

  return '';
};

/**
 * Get the WebSocket URL
 * @returns {string} WebSocket URL
 */
export const getWsUrl = () => {
  const backendUrl = getBackendUrl();
  // Convert http to ws, https to wss
  return backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');
};

/**
 * Get the frontend URL
 * @returns {string} Frontend URL
 */
export const getFrontendUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  const raw = process.env.MESSENGER_FRONTEND_URL;
  return String(raw || '').replace(/\/+$/, '');
};

export const getTurnstileSiteKey = () => {
  const raw = process.env.MESSENGER_TURNSTILE_SITE_KEY;
  const cleaned = String(raw || '').trim();
  if (cleaned) return cleaned;
  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return '1x00000000000000000000AA';
      }
    }
  } catch (_) {
  }
  return undefined;
};

/**
 * Get the main app (web frontend) URL where user profiles live.
 * Used to open /profile/:username in a new tab from messenger-web.
 * @returns {string} Main app URL
 */
export const getMainAppUrl = () => {
  const raw = process.env.MESSENGER_MAIN_APP_URL;
  const cleaned = String(raw || '').replace(/\/+$/, '');
  if (cleaned) return cleaned;

  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
      }
    }
  } catch (_) {
  }

  // Production fallback for Capacitor builds where env var is not available
  return 'https://l3v3lmatches.com';
};

/**
 * API Endpoints configuration for messenger
 */
export const API_ENDPOINTS = {
  get BACKEND_URL() { return getBackendUrl(); },
  get WS_URL() { return getWsUrl(); },
  get MESSENGER_API() { return `${getBackendUrl()}/api/messenger`; },
  get AUTH_LOGIN() { return `${getBackendUrl()}/api/auth/login`; },
  get AUTH_ME() { return `${getBackendUrl()}/api/auth/me`; },
  get AUTH_LOGOUT() { return `${getBackendUrl()}/api/auth/logout`; },
};

const apiConfig = {
  getBackendUrl,
  getWsUrl,
  getFrontendUrl,
  getTurnstileSiteKey,
  API_ENDPOINTS
};

export default apiConfig;
