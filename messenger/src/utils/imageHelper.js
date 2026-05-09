/**
 * Image URL helper for L3V3L Messenger.
 * Mirrors frontend/src/utils/urlHelper.js — converts raw image paths
 * returned by the backend into renderable URLs.
 *
 * Handles three cases:
 *   1. GCS signed URLs (already authenticated) → return as-is
 *   2. Absolute backend URLs → return as-is (add token if /api/users/media/)
 *   3. Relative paths (e.g. "/api/users/media/xyz.jpg") → prepend API_BASE_URL
 *
 * Adds JWT ?token= for protected /api/users/media/ paths since the backend
 * requires auth on these and react-native <Image> doesn't pass headers.
 */

import { API_BASE_URL } from '../config/api';

let _tokenGetter = null;

/**
 * Inject a function that returns the current JWT token. We avoid importing
 * authStore directly to prevent circular deps.
 */
export const setTokenGetter = (fn) => {
  _tokenGetter = fn;
};

const getToken = () => {
  if (typeof _tokenGetter === 'function') {
    try { return _tokenGetter(); } catch (_) { return null; }
  }
  return null;
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';

  // 1. GCS signed URLs — already authenticated via signature
  if (imagePath.includes('storage.googleapis.com') || imagePath.includes('X-Goog-Signature')) {
    return imagePath;
  }

  let finalUrl = imagePath;

  // 2. Absolute URL → use as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    finalUrl = imagePath;
  } else {
    // 3. Relative → prepend backend
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    finalUrl = `${API_BASE_URL}${cleanPath}`;
  }

  // Add JWT token for protected /api/users/media/ paths.
  if (finalUrl.includes('/api/users/media/')) {
    const token = getToken();
    if (token) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}token=${encodeURIComponent(token)}`;
    }
  }

  return finalUrl;
};

/**
 * Resolve a profile picture URL from a user-like object, mirroring
 * frontend's getProfilePicUrl().
 */
export const getProfilePicUrl = (user) => {
  if (!user) return '';
  if (user.imageVisibility?.profilePic) return getImageUrl(user.imageVisibility.profilePic);
  if (user.profileImage) return getImageUrl(user.profileImage);
  if (user.images?.[0]) return getImageUrl(user.images[0]);
  return '';
};

export default { getImageUrl, getProfilePicUrl, setTokenGetter };
