/**
 * API Wrapper Utility
 * Centralizes API calls and error handling
 * Reduces ~250 lines of duplicate code
 */

import api from '../api';

/**
 * Generic API call wrapper with consistent error handling
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} endpoint - API endpoint
 * @param {any} data - Request data (for POST/PUT)
 * @param {object} config - Additional axios config
 * @returns {Promise} - Resolves with response data
 */
export const apiCall = async (method, endpoint, data = null, config = {}) => {
  try {
    let response;
    
    if (method === 'get' || method === 'delete') {
      response = await api[method](endpoint, { ...config, params: data });
    } else {
      response = await api[method](endpoint, data, config);
    }
    
    return response.data;
  } catch (error) {
    // Extract meaningful error message
    const errorMessage = 
      error.response?.data?.detail || 
      error.response?.data?.message || 
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    
    console.error(`API Error [${method.toUpperCase()} ${endpoint}]:`, errorMessage);
    
    // Re-throw with standardized error
    const standardError = new Error(errorMessage);
    standardError.status = error.response?.status;
    standardError.originalError = error;
    throw standardError;
  }
};

/**
 * Wrapper for GET requests
 */
export const apiGet = (endpoint, params = null, config = {}) => 
  apiCall('get', endpoint, params, config);

/**
 * Wrapper for POST requests
 */
export const apiPost = (endpoint, data, config = {}) => 
  apiCall('post', endpoint, data, config);

/**
 * Wrapper for PUT requests
 */
export const apiPut = (endpoint, data, config = {}) => 
  apiCall('put', endpoint, data, config);

/**
 * Wrapper for DELETE requests
 */
export const apiDelete = (endpoint, params = null, config = {}) => 
  apiCall('delete', endpoint, params, config);

/**
 * Wrapper for file uploads
 */
export const apiUpload = (endpoint, formData, onProgress = null) => {
  const config = {
    headers: { 'Content-Type': 'multipart/form-data' }
  };
  
  if (onProgress) {
    config.onUploadProgress = (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onProgress(percentCompleted);
    };
  }
  
  return apiPost(endpoint, formData, config);
};

// Export all api functions using the wrapper
export default {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  delete: apiDelete,
  upload: apiUpload
};
