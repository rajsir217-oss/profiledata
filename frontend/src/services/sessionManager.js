// frontend/src/services/sessionManager.js
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import toastService from './toastService';
import logger from '../utils/logger';

// Module loaded - debug log removed

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
    this.inactivityInterval = null; // Dedicated inactivity check interval
    this.lastActivity = Date.now();
    this.loginTime = null;
    this.isActive = false;
    
    // Configuration
    this.ACTIVITY_THRESHOLD = 25 * 60 * 1000; // 25 minutes of inactivity before stopping refresh
    this.REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh token every 5 minutes if active
    this.HARD_LIMIT = 8 * 60 * 60 * 1000; // 8 hour hard limit (full work day)
    this.WARNING_TIME = 7.5 * 60 * 60 * 1000; // Warn at 7.5 hours
    this.INACTIVITY_LOGOUT = 30 * 60 * 1000; // Log out after 30 minutes of inactivity
    this.warningShown = false;
    this.isLoggingOut = false;
  }

  /**
   * Initialize session manager
   */
  init() {
    logger.debug('SessionManager.init() called');
    
    if (this.isActive) {
      logger.debug('Session manager already initialized, skipping');
      return;
    }

    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    logger.debug('Tokens found:', { token: !!token, refreshToken: !!refreshToken });
    
    if (!token) {
      logger.debug('No token found, session manager not initialized');
      return;
    }
    // Note: refreshToken is optional - inactivity check works without it

    this.isActive = true;
    
    // CRITICAL FIX: Restore login time from localStorage to persist across page reloads
    // This prevents the 8-hour hard limit from resetting on every page refresh
    const storedLoginTime = localStorage.getItem('sessionLoginTime');
    if (storedLoginTime) {
      this.loginTime = parseInt(storedLoginTime, 10);
      logger.debug('Restored login time from localStorage:', new Date(this.loginTime).toISOString());
    } else {
      this.loginTime = Date.now();
      localStorage.setItem('sessionLoginTime', this.loginTime.toString());
      logger.debug('New login time set:', new Date(this.loginTime).toISOString());
    }
    
    // CRITICAL FIX: Restore last activity from localStorage
    // This prevents inactivity timer from resetting on page refresh
    const storedLastActivity = localStorage.getItem('sessionLastActivity');
    if (storedLastActivity) {
      this.lastActivity = parseInt(storedLastActivity, 10);
      logger.debug('Restored last activity from localStorage:', new Date(this.lastActivity).toISOString());
    } else {
      this.lastActivity = Date.now();
      localStorage.setItem('sessionLastActivity', this.lastActivity.toString());
    }
    
    this.warningShown = false;
    
    // CRITICAL FIX: Check session validity IMMEDIATELY on init
    // This catches expired sessions when user returns to a stale tab
    if (this.checkSessionExpiredOnInit()) {
      return; // Session expired, logout already called
    }

    // Set up activity listeners
    this.setupActivityListeners();

    // Set up visibility change listener (for when user returns to tab)
    this.setupVisibilityListener();

    // Start refresh interval
    this.startRefreshInterval();

    logger.info('Session manager initialized');
  }
  
  /**
   * Check if session is expired on init (before any activity handlers run)
   * Returns true if session is expired and logout was triggered
   */
  checkSessionExpiredOnInit() {
    // Check hard limit first
    const timeSinceLogin = Date.now() - this.loginTime;
    if (timeSinceLogin >= this.HARD_LIMIT) {
      logger.warn(`Session exceeded 8-hour hard limit on init (${Math.round(timeSinceLogin / 3600000)} hours)`);
      toastService.warning('Your session has expired (8 hour limit). Please log in again.', 5000);
      this.logout();
      return true;
    }
    
    // Check inactivity
    const timeSinceActivity = Date.now() - this.lastActivity;
    if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
      logger.warn(`Session expired due to inactivity on init (${Math.round(timeSinceActivity / 60000)} minutes)`);
      toastService.warning('Your session has expired due to inactivity. Please log in again.', 5000);
      this.logout();
      return true;
    }
    
    return false;
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
   * Set up visibility change listener
   * This checks session validity when user returns to the tab
   */
  setupVisibilityListener() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle visibility change (user returns to tab)
   * CRITICAL: Check session validity BEFORE any activity handlers can reset values
   */
  handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && this.isActive) {
      logger.debug('Tab became visible, checking session...');
      
      // CRITICAL FIX: Read from localStorage to get the ACTUAL last activity time
      // This is important because the in-memory value may have been updated by
      // activity handlers that fire before this visibility change handler
      const storedLastActivity = localStorage.getItem('sessionLastActivity');
      const actualLastActivity = storedLastActivity 
        ? parseInt(storedLastActivity, 10) 
        : this.lastActivity;
      
      const storedLoginTime = localStorage.getItem('sessionLoginTime');
      const actualLoginTime = storedLoginTime 
        ? parseInt(storedLoginTime, 10) 
        : this.loginTime;
      
      // Check if user has been inactive too long
      const timeSinceActivity = Date.now() - actualLastActivity;
      if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
        logger.warn(`User inactive for ${Math.round(timeSinceActivity / 60000)} minutes (from localStorage), logging out`);
        toastService.warning('Your session has expired due to inactivity. Please log in again.', 5000);
        this.logout();
        return;
      }

      // Check hard limit
      const timeSinceLogin = Date.now() - actualLoginTime;
      if (timeSinceLogin >= this.HARD_LIMIT) {
        logger.warn(`Session exceeded 8-hour hard limit on tab return (${Math.round(timeSinceLogin / 3600000)} hours)`);
        toastService.warning('Your session has expired (8 hour limit). Please log in again.', 5000);
        this.logout();
        return;
      }

      // Try to refresh token to verify session is still valid
      try {
        await this.refreshToken();
        // Reset activity on successful return
        this.lastActivity = Date.now();
        localStorage.setItem('sessionLastActivity', this.lastActivity.toString());
      } catch (error) {
        logger.error('Failed to refresh token on tab return:', error);
      }
    }
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
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle user activity
   * Throttled to avoid excessive localStorage writes
   */
  handleActivity = () => {
    const now = Date.now();
    
    // Throttle: Only update if more than 10 seconds since last update
    // This prevents excessive localStorage writes on every mouse move
    if (now - this.lastActivity > 10000) {
      this.lastActivity = now;
      localStorage.setItem('sessionLastActivity', now.toString());
    } else {
      // Still update in-memory value for accurate checks
      this.lastActivity = now;
    }
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

    // Check and refresh every 5 minutes
    this.refreshInterval = setInterval(async () => {
      await this.checkAndRefresh();
    }, this.REFRESH_INTERVAL);

    logger.debug('Token refresh interval started');
    
    // ALSO start a dedicated inactivity check interval
    // This runs more frequently (every 1 minute) to catch inactivity faster
    // Browsers may throttle this in background tabs, but it will catch up when tab is active
    this.startInactivityCheckInterval();
  }
  
  /**
   * Start dedicated inactivity check interval
   * Runs every minute to check if user has been inactive for too long
   */
  startInactivityCheckInterval() {
    // Clear existing interval
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval);
    }
    
    this.inactivityInterval = setInterval(() => {
      if (!this.isActive) return;
      
      // Read from localStorage to get the persisted value (more reliable than in-memory)
      const storedLastActivity = localStorage.getItem('sessionLastActivity');
      const lastActivityTime = storedLastActivity ? parseInt(storedLastActivity, 10) : this.lastActivity;
      
      const timeSinceActivity = Date.now() - lastActivityTime;
      
      if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
        logger.warn(`Session expired due to inactivity (${Math.round(timeSinceActivity / 60000)} minutes)`);
        toastService.warning('Your session has expired due to inactivity. Please log in again.', 5000);
        this.logout();
      }
    }, 60 * 1000); // Check every 1 minute
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

      // Check if user has been inactive too long - log them out
      const timeSinceActivity = Date.now() - this.lastActivity;
      if (timeSinceActivity >= this.INACTIVITY_LOGOUT) {
        logger.warn(`User inactive for ${Math.round(timeSinceActivity / 60000)} minutes, logging out`);
        toastService.warning('Your session has expired due to inactivity. Please log in again.', 5000);
        this.logout();
        return;
      }

      // Only refresh if user is active (within 25 min threshold)
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
    
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval);
      this.inactivityInterval = null;
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
    localStorage.removeItem('sessionLoginTime');
    localStorage.removeItem('sessionLastActivity');
    
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
   * Also persists to localStorage for cross-page-reload persistence
   */
  setLoginTime(time = Date.now()) {
    this.loginTime = time;
    this.lastActivity = time;
    this.warningShown = false;
    localStorage.setItem('sessionLoginTime', time.toString());
    localStorage.setItem('sessionLastActivity', time.toString());
    logger.debug('Login time set and persisted:', new Date(time).toISOString());
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
