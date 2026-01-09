// frontend/src/utils/axiosInterceptors.js
/**
 * Shared axios interceptors for session management
 * Use this to add 401 handling to any custom axios instance
 */

/**
 * Add session expiry interceptor to an axios instance
 * Redirects to login on 401 Unauthorized
 * @param {AxiosInstance} axiosInstance - The axios instance to add interceptor to
 */
export const addSessionInterceptor = (axiosInstance) => {
  // Add auth token to requests
  axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle 401 responses - redirect to login
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const hasLoggedOut = sessionStorage.getItem('hasLoggedOut');
        if (!hasLoggedOut) {
          console.warn('🔒 Session expired - redirecting to login');
          sessionStorage.setItem('hasLoggedOut', 'true');
          // Clear tokens
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('username');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userStatus');
          // Redirect to login
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

export default addSessionInterceptor;
