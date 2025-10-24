/**
 * API Configuration
 * Centralized configuration for all backend API URLs
 * Uses runtime config if available (production), otherwise falls back to env vars or localhost
 */

// Get base backend URL
export const getBackendUrl = () => {
  // Priority 1: Runtime config (set during production deployment)
  if (window.RUNTIME_CONFIG?.SOCKET_URL) {
    return window.RUNTIME_CONFIG.SOCKET_URL;
  }
  
  // Priority 2: Environment variable
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  
  // Priority 3: Localhost fallback for development
  return 'http://localhost:8000';
};

// Get API base URL (for /api/users endpoints)
export const getApiUrl = () => {
  // Priority 1: Runtime config
  if (window.RUNTIME_CONFIG?.API_URL) {
    return window.RUNTIME_CONFIG.API_URL;
  }
  
  // Priority 2: Environment variable
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Priority 3: Localhost fallback
  return 'http://localhost:8000/api/users';
};

// Export constants for common use
export const API_BASE_URL = getApiUrl();
export const BACKEND_URL = getBackendUrl();

// Helper to build full API URLs
export const buildApiUrl = (path) => {
  const base = getBackendUrl();
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/${cleanPath}`;
};

// Specific API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/login`,
  REGISTER: `${API_BASE_URL}/register`,
  
  // Users
  USERS: API_BASE_URL,
  ONLINE_STATUS: (username, status) => `${API_BASE_URL}/online-status/${username}/${status}`,
  
  // Notifications
  NOTIFICATIONS: `${getBackendUrl()}/api/notifications`,
  NOTIFICATION_TEMPLATES: `${getBackendUrl()}/api/notifications/templates`,
  NOTIFICATION_QUEUE: `${getBackendUrl()}/api/notifications/queue`,
  NOTIFICATION_LOGS: `${getBackendUrl()}/api/notifications/logs`,
  NOTIFICATION_SCHEDULED: `${getBackendUrl()}/api/notifications/scheduled`,
  NOTIFICATION_ANALYTICS: `${getBackendUrl()}/api/notifications/analytics`,
  NOTIFICATION_SEND: `${getBackendUrl()}/api/notifications/send`,
  
  // Admin
  ADMIN_META: (username) => `${getBackendUrl()}/api/admin/meta/${username}`,
  ADMIN_META_VERIFY: `${getBackendUrl()}/api/admin/meta/verify`,
  
  // Contact
  CONTACT_DOWNLOAD: (ticketId, filename) => 
    `${API_BASE_URL}/contact/download/${ticketId}/${filename}`,
  
  // Auth (separate endpoint)
  AUTH: `${getBackendUrl()}/api/auth`,
  CHANGE_PASSWORD: `${getBackendUrl()}/api/auth/change-password`,
  
  // Image access
  IMAGE_ACCESS: `${getBackendUrl()}/api/users/image-access`,
};

export default {
  getBackendUrl,
  getApiUrl,
  buildApiUrl,
  API_BASE_URL,
  BACKEND_URL,
  API_ENDPOINTS,
};
