/**
 * Image URL utilities for authenticated image access
 * 
 * Note: For most cases, use getImageUrl from urlHelper.js instead.
 * This file provides additional utilities for image authentication.
 */

/**
 * Get an authenticated image URL by appending the JWT token as a query parameter.
 * This is needed because <img src> tags cannot include Authorization headers.
 * 
 * In production with GCS, signed URLs are returned directly from backend
 * and don't need JWT tokens (they're authenticated via GCS signature).
 * 
 * @param {string} imageUrl - The original image URL
 * @returns {string} - The URL with token appended (if needed)
 */
export function getAuthenticatedImageUrl(imageUrl) {
  if (!imageUrl) return '';
  
  // GCS signed URLs - return as-is (already authenticated via signature)
  if (imageUrl.includes('storage.googleapis.com') || imageUrl.includes('X-Goog-Signature')) {
    return imageUrl;
  }
  
  // Already has token? Return as-is
  if (imageUrl.includes('token=')) {
    return imageUrl;
  }
  
  // Only add token for our backend media URLs (local dev)
  // Handles both /media/ and /api/users/media/ endpoints
  if (!imageUrl.includes('/media/')) {
    return imageUrl;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    return imageUrl;
  }
  
  // Append token as query parameter
  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}token=${encodeURIComponent(token)}`;
}

/**
 * Process an array of image URLs to add authentication
 * 
 * @param {string[]} images - Array of image URLs
 * @returns {string[]} - Array of authenticated image URLs
 */
export function getAuthenticatedImageUrls(images) {
  if (!images || !Array.isArray(images)) return [];
  return images.map(getAuthenticatedImageUrl);
}

export default {
  getAuthenticatedImageUrl,
  getAuthenticatedImageUrls
};
