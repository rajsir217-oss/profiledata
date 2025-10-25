// frontend/src/utils/urlHelper.js
// Centralized URL helper to avoid hardcoded localhost references

import { getBackendUrl } from '../config/apiConfig';

/**
 * Get full backend API URL for a given path
 * @param {string} path - API path (e.g., '/api/activity-logs')
 * @returns {string} Full URL (e.g., 'https://backend.run.app/api/activity-logs')
 */
export const getBackendApiUrl = (path) => {
  const backend = getBackendUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${backend}${cleanPath}`;
};

/**
 * Get frontend URL (for links, redirects, etc.)
 * @returns {string} Frontend URL
 */
export const getFrontendUrl = () => {
  // For production, use current origin
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  // For development
  return process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
};

/**
 * Get full image URL (handles relative and absolute URLs)
 * @param {string} imagePath - Image path from backend
 * @returns {string} Full image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  // If already absolute URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // Build full URL from backend
  const backend = getBackendUrl();
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${backend}${cleanPath}`;
};

/**
 * Legacy compatibility - get socket URL (same as backend)
 * @deprecated Use getBackendUrl() directly
 */
export const getSocketUrl = () => {
  return getBackendUrl();
};

export default {
  getBackendApiUrl,
  getFrontendUrl,
  getImageUrl,
  getSocketUrl
};
