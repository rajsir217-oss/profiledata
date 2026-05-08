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
  // Runtime hostname detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: messenger.l3v3lmatches.com
    if (hostname === 'messenger.l3v3lmatches.com') {
      return 'https://api.l3v3lmatches.com';
    }
    
    // Local dev: localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  
  // Fallback based on NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return 'https://api.l3v3lmatches.com';
  }
  
  // Development fallback
  return 'http://localhost:8000';
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
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://messenger.l3v3lmatches.com';
  }
  
  return 'http://localhost:3000';
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
  API_ENDPOINTS
};

export default apiConfig;
