// frontend/src/api.js
import axios from "axios";
import { getApiUrl, getBackendUrl } from './config/apiConfig';
import toastService from './services/toastService';
import sessionManager from './services/sessionManager';
import logger from './utils/logger';

// Use centralized API config
const getAPIUrl = getApiUrl;

const api = axios.create({
  // Don't set baseURL at creation time - set it dynamically in interceptor
  // This ensures we read from window.RUNTIME_CONFIG which loads at runtime
});

// Add request interceptor to include auth token and set dynamic baseURL
api.interceptors.request.use(
  (config) => {
    // Dynamically set baseURL from runtime config (loaded from /config.js)
    // This ensures we use the correct URL even if config loads after React bundle
    if (!config.baseURL && !config.url.startsWith('http')) {
      config.baseURL = getAPIUrl();
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // NOTE: API activity tracking removed - it was resetting inactivity timer on background polling
    // User activity is now tracked only via DOM events (mouse, keyboard, click, scroll)
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || 'unknown';
      
      // Only handle once per session to avoid spam
      const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
      if (!hasLoggedOut) {
        logger.warn('🔒 Session expired or invalid token (401 from API)');
        logger.warn(`📍 Endpoint: ${url}`);
        logger.info('➡️  Redirecting to login via sessionManager...');
        sessionStorage.setItem('hasLoggedOut', 'true');
        
        // Use session manager's logout which shows overlay
        sessionManager.logout(`api_response_401_${url}`);
      }
    }
    return Promise.reject(error);
  }
);

// API Functions
export const loginUser = async (credentials) => {
  try {
    const response = await api.post('/login', credentials);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await api.post('/register', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const searchUsers = async (searchCriteria) => {
  try {
    const response = await api.post('/search', searchCriteria);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getUserProfile = async (username) => {
  try {
    const response = await api.get(`/profile/${username}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateUserProfile = async (profileData) => {
  try {
    const response = await api.put('/profile', profileData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const createAccessRequest = async (requestData) => {
  try {
    const response = await api.post('/access-request', requestData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getSavedSearches = async () => {
  try {
    const response = await api.get('/saved-searches');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const setDefaultSavedSearch = async (searchId) => {
  try {
    const username = localStorage.getItem('username');
    const response = await api.put(`/${username}/saved-searches/${searchId}/set-default`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getDefaultSavedSearch = async () => {
  try {
    const username = localStorage.getItem('username');
    const response = await api.get(`/${username}/saved-searches/default`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const unsetDefaultSavedSearch = async () => {
  try {
    const username = localStorage.getItem('username');
    const response = await api.delete(`/${username}/saved-searches/unset-default`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const addToFavorites = async (userId) => {
  try {
    const response = await api.post(`/favorites/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const sendMessage = async (messageData) => {
  try {
    const response = await api.post('/messages', messageData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getMessages = async (userId) => {
  try {
    const response = await api.get(`/messages/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// User Preferences API
export const getUserPreferences = async () => {
  try {
    const response = await api.get('/preferences');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateUserPreferences = async (preferences) => {
  try {
    const response = await api.put('/preferences', preferences);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Change Password API
export const changePassword = async (passwordData) => {
  try {
    const authApi = axios.create({
      baseURL: `${getBackendUrl()}/api/auth`,
    });
    
    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Add response interceptor for 401 handling
    authApi.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
          if (!hasLoggedOut) {
            sessionStorage.setItem('hasLoggedOut', 'true');
            sessionManager.logout();
          }
        }
        return Promise.reject(error);
      }
    );
    
    const response = await authApi.post('/change-password', passwordData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Image Access API - uses separate axios instance to avoid baseURL conflicts
const imageAccessApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor for imageAccessApi
imageAccessApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for 401 handling
imageAccessApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
      if (!hasLoggedOut) {
        logger.warn('🔒 Image Access API: Session expired (401)');
        sessionStorage.setItem('hasLoggedOut', 'true');
        
        // Use session manager for consistent logout experience
        sessionManager.logout('image_access_api_401');
      }
    }
    return Promise.reject(error);
  }
);

export const imageAccess = {
  // Get image privacy settings for a user
  getSettings: async (username) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${username}/settings`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create or update image privacy settings
  updateSettings: async (username, settings) => {
    try {
      const response = await imageAccessApi.post(`/api/image-access/${username}/settings`, settings);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Batch update image settings
  batchUpdateSettings: async (username, data) => {
    try {
      const response = await imageAccessApi.post(`/api/image-access/${username}/settings/batch`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Check if viewer has access to an image
  checkAccess: async (imageId, viewerUsername) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${imageId}/check-access`, {
        params: { viewerUsername }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get accessible images for a profile
  getAccessibleImages: async (ownerUsername, viewerUsername) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/profile/${ownerUsername}/accessible`, {
        params: { viewerUsername }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Request access to images
  requestAccess: async (requestData) => {
    try {
      const response = await imageAccessApi.post('/api/image-access/request-access', requestData);
      return response.data;
    } catch (error) {
      console.error('API Error in requestAccess:', error);
      if (error.response) {
        // Server responded with error
        throw error;
      } else if (error.request) {
        // Request made but no response
        throw new Error('No response from server. Please check if the backend is running.');
      } else {
        // Something else happened
        throw error;
      }
    }
  },

  // Request renewal of access
  requestRenewal: async (requestData) => {
    try {
      const response = await imageAccessApi.post('/api/image-access/request-renewal', requestData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get pending requests for owner
  getPendingRequests: async (username) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${username}/requests/pending`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get sent requests by requester
  getSentRequests: async (username) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${username}/requests/sent`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Approve access request
  approveRequest: async (requestId, data) => {
    try {
      const response = await imageAccessApi.post(`/api/image-access/requests/${requestId}/approve`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Reject access request
  rejectRequest: async (requestId, data) => {
    try {
      const response = await imageAccessApi.post(`/api/image-access/requests/${requestId}/reject`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Revoke access for a user
  revokeAccess: async (imageId, username) => {
    try {
      const response = await imageAccessApi.delete(`/api/image-access/${imageId}/revoke/${username}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get access analytics for an image
  getAnalytics: async (imageId) => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${imageId}/analytics`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get incoming image access requests for a user
  getIncomingRequests: async (username, status = 'pending') => {
    try {
      const response = await imageAccessApi.get(`/api/image-access/${username}/requests/incoming`, {
        params: status ? { status } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Deny/reject an image access request
  denyRequest: async (requestId, data) => {
    try {
      const response = await imageAccessApi.post(`/api/image-access/requests/${requestId}/deny`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

// Notifications API - uses separate axios instance to avoid baseURL conflicts
const notificationsApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor for notificationsApi
notificationsApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log(`🔑 Notifications API ${config.method.toUpperCase()} ${config.url}`, {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
    });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('⚠️ No token found in localStorage for notifications API');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
notificationsApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
      if (!hasLoggedOut) {
        logger.warn('🔒 Notifications API: Session expired (401)');
        sessionStorage.setItem('hasLoggedOut', 'true');
        
        // Use session manager for consistent logout experience
        sessionManager.logout('notifications_api_401');
      }
    }
    return Promise.reject(error);
  }
);

export const notifications = {
  // Get notification preferences
  getPreferences: async () => {
    try {
      const response = await notificationsApi.get('/api/notifications/preferences');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update notification preferences
  updatePreferences: async (preferences) => {
    try {
      console.log('📤 Updating preferences:', preferences);
      const response = await notificationsApi.put('/api/notifications/preferences', preferences);
      console.log('✅ Update successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Update failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        message: error.message
      });
      throw error.response?.data || error.message;
    }
  },

  // Reset to defaults
  resetPreferences: async () => {
    try {
      const response = await notificationsApi.post('/api/notifications/preferences/reset');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
};

// Account Deletion & Email Preferences
export const requestAccountDeletion = (reason, downloadData) => {
  return api.post('/account/request-deletion', { reason, downloadData });
};

export const cancelAccountDeletion = () => {
  return api.post('/account/cancel-deletion');
};

export const exportAccountData = () => {
  return api.get('/account/export-data', {
    responseType: 'blob'
  });
};

export const getEmailPreferences = () => {
  return api.get('/account/email-preferences');
};

export const updateEmailPreferences = (preferences) => {
  return api.put('/account/email-preferences', preferences);
};

/**
 * Create a configured axios instance with session handling
 * Use this instead of creating custom axios instances in components
 * @param {string} baseURL - Optional custom base URL (defaults to getBackendUrl())
 * @returns {AxiosInstance} Configured axios instance with auth and session handling
 */
export const createApiInstance = (baseURL = null) => {
  const instance = axios.create({
    baseURL: baseURL || getBackendUrl()
  });

  // Add auth token to requests
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // NOTE: API activity tracking removed - it was resetting inactivity timer on background polling
      // User activity is now tracked only via DOM events (mouse, keyboard, click, scroll)
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Handle 401 responses - redirect to login
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
        if (!hasLoggedOut) {
          logger.warn('🔒 Custom API Instance: Session expired (401)');
          sessionStorage.setItem('hasLoggedOut', 'true');
          sessionManager.logout('custom_api_instance_401');
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

export default api;
