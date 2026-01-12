// frontend/src/config/apiConfig.js
// Centralized API configuration

/**
 * POD Configuration (for deployment script compatibility)
 * These are modified by deploy script at build time
 * Only use POD config in production - don't fallback to production URLs in dev
 */
const POD_CONFIG = {
  backend: process.env.REACT_APP_POD_BACKEND_URL || 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app' || null,
  api: process.env.REACT_APP_POD_API_URL || 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/users' || null,
  ws: process.env.REACT_APP_POD_WS_URL || 'wss://matrimonial-backend-7cxoxmouuq-uc.a.run.app' || null
};

/**
 * Get the backend API URL based on environment
 * @returns {string} Backend URL without /api/users suffix
 * 
 * Environment variables (set in .env.local, .env.production, etc.):
 * - REACT_APP_BACKEND_URL: Full backend URL (e.g., http://localhost:8000)
 * - REACT_APP_POD_BACKEND_URL: POD backend URL (set by deployment script)
 * - REACT_APP_SOCKET_URL: WebSocket URL (optional, defaults to BACKEND_URL)
 * 
 * Local Dev (.env.local):     http://localhost:8000
 * Production (.env.production): https://matrimonial-backend-7cxoxmouuq-uc.a.run.app
 */
export const getBackendUrl = () => {
  // Priority 1: Environment variable (from .env files) - LOCAL DEV
  // This ensures local dev uses localhost even if POD_CONFIG exists
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // Priority 2: Runtime config (loaded from /config.js at runtime)
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.SOCKET_URL) {
    return window.RUNTIME_CONFIG.SOCKET_URL;
  }
  
  // Priority 3: POD config (set by deployment script) - PRODUCTION
  if (POD_CONFIG.backend) {
    return POD_CONFIG.backend;
  }
  
  // Fallback only if nothing is set
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ REACT_APP_BACKEND_URL not set! Using fallback production URL.');
    return 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app';
  }
  
  // Development fallback
  return 'http://localhost:8000';
};

/**
 * Get the API URL for /api/users/* endpoints
 * @returns {string} Full API URL with /api/users prefix
 */
export const getApiUrl = () => {
  // Priority 1: Environment variable (from .env files) - LOCAL DEV
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Priority 2: Runtime config (loaded from /config.js at runtime)
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.API_URL) {
    return window.RUNTIME_CONFIG.API_URL;
  }
  
  // Priority 3: POD config API URL (set by deployment script) - PRODUCTION
  if (POD_CONFIG.api) {
    return POD_CONFIG.api;
  }
  
  // Fallback: Construct from backend URL
  return `${getBackendUrl()}/api/users`;
};

/**
 * Get the frontend URL
 * @returns {string} Frontend URL
 */
export const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_FRONTEND_URL || 'https://matrimonial-frontend-7cxoxmouuq-uc.a.run.app';
   
  }
  return process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
};

/**
 * API Endpoints configuration
 * Centralized list of all API endpoints used across the app
 * 
 * NOTE: Using getter functions to ensure URLs are evaluated at ACCESS time,
 * not at module load time. This ensures correct environment handling.
 */
export const API_ENDPOINTS = {
  // Notification endpoints
  get NOTIFICATION_TEMPLATES() { return `${getBackendUrl()}/api/notifications/templates`; },
  get NOTIFICATION_SCHEDULED() { return `${getBackendUrl()}/api/notifications/scheduled`; },
  get NOTIFICATION_SEND() { return `${getBackendUrl()}/api/notifications/send`; },
  get NOTIFICATION_QUEUE() { return `${getBackendUrl()}/api/notifications/queue`; },
  get NOTIFICATION_LOGS() { return `${getBackendUrl()}/api/notifications/logs`; },
  get NOTIFICATION_ANALYTICS() { return `${getBackendUrl()}/api/notifications/analytics`; },
  
  // Scheduler endpoints
  get SCHEDULER_JOBS() { return `${getBackendUrl()}/api/scheduler/jobs`; },
  get SCHEDULER_TEMPLATES() { return `${getBackendUrl()}/api/scheduler/templates`; },
  get SCHEDULER_HISTORY() { return `${getBackendUrl()}/api/scheduler/history`; },
  
  // User endpoints (via getApiUrl)
  get USERS() { return getApiUrl(); },
  USER_PROFILE: (username) => `${getApiUrl()}/profile/${username}`,
  get USER_SEARCH() { return `${getApiUrl()}/search`; },
  get USER_LOGIN() { return `${getApiUrl()}/login`; },
  get USER_REGISTER() { return `${getApiUrl()}/register`; },
  
  // PII endpoints
  get PII_REQUESTS() { return `${getBackendUrl()}/api/pii-requests`; },
  get PII_ACCESS() { return `${getBackendUrl()}/api/pii-access`; },
  
  // Image access endpoints
  get IMAGE_ACCESS() { return `${getBackendUrl()}/api/image-access`; },
  
  // Messages endpoints
  get MESSAGES() { return `${getBackendUrl()}/api/messages`; }
};

const apiConfig = {
  getBackendUrl,
  getApiUrl,
  getFrontendUrl,
  API_ENDPOINTS
};

export default apiConfig;
