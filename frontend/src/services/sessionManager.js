// frontend/src/services/sessionManager.js
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import toastService from './toastService';
import logger from '../utils/logger';

/**
 * Session Manager - Activity-based token refresh
 * 
 * Features:
 * - Tracks user activity (mouse, keyboard, API calls)
 * - Automatically refreshes token when user is active
 * - Hard limit: 8 hours from initial login
 * - Warns user before final logout
 */
class SessionManager {
  constructor() {
    this.activityTimeout = null;
    this.refreshInterval = null;
    this.lastActivity = Date.now();
    this.loginTime = null;
    this.isActive = false;
    
    // Configuration
    this.ACTIVITY_THRESHOLD = 25 * 60 * 1000; // 25 minutes of inactivity before stopping refresh
    this.REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes if active
    this.HARD_LIMIT = 8 * 60 * 60 * 1000; // 8 hour hard limit (full work day)
    this.WARNING_TIME = 7.5 * 60 * 60 * 1000; // Warn at 7.5 hours
    this.warningShown = false;
  }

  /**
   * Initialize session manager
   */
  init() {
    if (this.isActive) {
      logger.debug('Session manager already initialized');
      return;
    }

    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!token || !refreshToken) {
      logger.debug('No tokens found, session manager not initialized');
      return;
    }

    this.isActive = true;
    this.loginTime = Date.now();
    this.lastActivity = Date.now();
    this.warningShown = false;

    // Set up activity listeners
    this.setupActivityListeners();

    // Start refresh interval
    this.startRefreshInterval();

    logger.info('Session manager initialized');
  }

  /**
   * Set up activity listeners
   */
  setupActivityListeners() {
    // Mouse movement
    document.addEventListener('mousemove', this.handleActivity);
    
    // Keyboard activity
    document.addEventListener('keydown', this.handleActivity);
    
    // Click activity
    document.addEventListener('click', this.handleActivity);
    
    // Touch activity (mobile)
    document.addEventListener('touchstart', this.handleActivity);
    
    // Scroll activity
    document.addEventListener('scroll', this.handleActivity);
  }

  /**
   * Remove activity listeners
   */
  removeActivityListeners() {
    document.removeEventListener('mousemove', this.handleActivity);
    document.removeEventListener('keydown', this.handleActivity);
    document.removeEventListener('click', this.handleActivity);
    document.removeEventListener('touchstart', this.handleActivity);
    document.removeEventListener('scroll', this.handleActivity);
  }

  /**
   * Handle user activity
   */
  handleActivity = () => {
    this.lastActivity = Date.now();
  }

  /**
   * Check if user is still active
   */
  isUserActive() {
    const timeSinceActivity = Date.now() - this.lastActivity;
    return timeSinceActivity < this.ACTIVITY_THRESHOLD;
  }

  /**
   * Check if session has exceeded hard limit
   */
  hasExceededHardLimit() {
    if (!this.loginTime) return false;
    const timeSinceLogin = Date.now() - this.loginTime;
    return timeSinceLogin >= this.HARD_LIMIT;
  }

  /**
   * Check if we should show warning
   */
  shouldShowWarning() {
    if (!this.loginTime || this.warningShown) return false;
    const timeSinceLogin = Date.now() - this.loginTime;
    return timeSinceLogin >= this.WARNING_TIME;
  }

  /**
   * Start refresh interval
   */
  startRefreshInterval() {
    // Clear existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Check and refresh every 10 minutes
    this.refreshInterval = setInterval(async () => {
      await this.checkAndRefresh();
    }, this.REFRESH_INTERVAL);

    logger.debug('Token refresh interval started');
  }

  /**
   * Check session and refresh if needed
   */
  async checkAndRefresh() {
    try {
      // Check hard limit first
      if (this.hasExceededHardLimit()) {
        logger.warn('Session exceeded 8-hour hard limit');
        toastService.warning('Your session has expired (8 hour limit). Please log in again.', 5000);
        this.logout();
        return;
      }

      // Show warning if approaching limit
      if (this.shouldShowWarning()) {
        const remainingMinutes = Math.ceil((this.HARD_LIMIT - (Date.now() - this.loginTime)) / 60000);
        toastService.warning(`Your session will expire in ${remainingMinutes} minutes. Save your work!`, 10000);
        this.warningShown = true;
      }

      // Only refresh if user is active
      if (!this.isUserActive()) {
        logger.debug('User inactive, skipping token refresh');
        return;
      }

      // Refresh token
      await this.refreshToken();
      
    } catch (error) {
      logger.error('Error in checkAndRefresh:', error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      logger.warn('No refresh token found');
      return;
    }

    try {
      logger.debug('Refreshing access token...');
      
      const response = await axios.post(
        `${getBackendUrl()}/api/auth/refresh-token`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.access_token) {
        // Update access token
        localStorage.setItem('token', response.data.access_token);
        logger.info('Access token refreshed successfully');
        
        // Reset warning flag if we successfully refreshed
        // (in case user was warned but then became active again)
        if (this.warningShown) {
          const timeSinceLogin = Date.now() - this.loginTime;
          if (timeSinceLogin < this.WARNING_TIME) {
            this.warningShown = false;
          }
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logger.warn('Token refresh failed - session expired');
        toastService.warning('Your session has expired. Please log in again.', 4000);
        this.logout();
      } else {
        logger.error('Token refresh error:', error);
      }
    }
  }

  /**
   * Logout and cleanup
   */
  logout() {
    // Prevent multiple logout calls
    if (this.isLoggingOut) {
      return;
    }
    this.isLoggingOut = true;
    
    // Clear intervals
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }

    // Remove listeners
    this.removeActivityListeners();

    // Clear state
    this.isActive = false;
    this.loginTime = null;
    this.lastActivity = Date.now();
    this.warningShown = false;

    // Clear storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userStatus');
    
    // Mark as logged out to prevent duplicate handling
    sessionStorage.setItem('hasLoggedOut', 'true');

    // Show session expired overlay immediately to prevent broken UI
    this.showSessionExpiredOverlay();

    // Redirect to login after brief delay for user to see message
    setTimeout(() => {
      this.isLoggingOut = false;
      sessionStorage.removeItem('hasLoggedOut');
      window.location.href = '/login';
    }, 1500);

    logger.info('Session manager cleaned up - redirecting to login');
  }
  
  /**
   * Show a full-screen overlay when session expires
   * This prevents the broken UI state
   */
  showSessionExpiredOverlay() {
    // Remove any existing overlay
    const existing = document.getElementById('session-expired-overlay');
    if (existing) {
      existing.remove();
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'session-expired-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    overlay.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
        <h2 style="font-size: 28px; margin-bottom: 16px; color: white;">Session Expired</h2>
        <p style="font-size: 16px; color: #ccc; margin-bottom: 24px;">Your session has ended. Redirecting to login...</p>
        <div style="width: 40px; height: 40px; border: 3px solid #666; border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(overlay);
  }

  /**
   * Update login time (called after successful login)
   */
  setLoginTime(time = Date.now()) {
    this.loginTime = time;
    this.warningShown = false;
    logger.debug('Login time set:', new Date(time).toISOString());
  }

  /**
   * Cleanup on app unmount
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
    this.removeActivityListeners();
    this.isActive = false;
    logger.debug('Session manager destroyed');
  }
}

// Export singleton instance
const sessionManager = new SessionManager();
export default sessionManager;
