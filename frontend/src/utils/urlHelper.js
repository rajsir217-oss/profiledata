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
 * Automatically adds JWT token for protected media endpoints (local dev only)
 * In production, GCS signed URLs are returned directly from backend
 * @param {string} imagePath - Image path from backend
 * @returns {string} Full image URL with auth token if needed
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  const currentBackend = getBackendUrl();
  const isLocalEnvironment = currentBackend.includes('localhost') || currentBackend.includes('127.0.0.1');
  
  // GCS signed URLs - return as-is (already authenticated via signature)
  // These URLs look like: https://storage.googleapis.com/bucket/...?X-Goog-Signature=...
  if (imagePath.includes('storage.googleapis.com') || imagePath.includes('X-Goog-Signature')) {
    return imagePath;
  }
  
  let finalUrl = imagePath;
  
  // If already absolute URL (from database)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // FORCE local URLs when running locally (for dev with production DB)
    if (isLocalEnvironment) {
      // Extract the path part after the domain
      const gcpBackendUrls = [
        'https://matrimonial-backend-458052696267.us-central1.run.app',
        'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app'
      ];
      
      for (const gcpUrl of gcpBackendUrls) {
        if (imagePath.startsWith(gcpUrl)) {
          // Replace GCP backend URL with local backend URL
          const relativePath = imagePath.substring(gcpUrl.length);
          finalUrl = `${currentBackend}${relativePath}`;
          break;
        }
      }
    }
    // In production, return absolute URLs as-is
  } else {
    // For relative paths - build full URL from current backend
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    finalUrl = `${currentBackend}${cleanPath}`;
  }
  
  // Add JWT token for protected media endpoints (local dev only)
  // In production, GCS signed URLs are used instead
  if (finalUrl.includes('/api/users/media/')) {
    const token = localStorage.getItem('token');
    if (token) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}token=${encodeURIComponent(token)}`;
    }
  }
  
  return finalUrl;
};

/**
 * Legacy compatibility - get socket URL (same as backend)
 * @deprecated Use getBackendUrl() directly
 */
export const getSocketUrl = () => {
  return getBackendUrl();
};

const urlHelper = {
  getBackendApiUrl,
  getFrontendUrl,
  getImageUrl,
  getSocketUrl
};

export default urlHelper;
