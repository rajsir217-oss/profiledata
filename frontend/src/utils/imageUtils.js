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
 * @param {string} imageUrl - The original image URL
 * @returns {string} - The URL with token appended (if logged in)
 */
export function getAuthenticatedImageUrl(imageUrl) {
  if (!imageUrl) return '';
  
  // Already has token? Return as-is
  if (imageUrl.includes('token=')) {
    return imageUrl;
  }
  
  // Only add token for our backend media URLs
  if (!imageUrl.includes('/api/users/media/')) {
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
