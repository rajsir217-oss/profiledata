/**
 * Online Status Service
 * Manages user online/offline status with Redis backend and WebSocket real-time updates
 */
import api from '../api';
import { getApiUrl } from '../config/apiConfig';
import socketService from './socketService';
import logger from '../utils/logger';

class OnlineStatusService {
  constructor() {
    this.heartbeatInterval = null;
    this.HEARTBEAT_INTERVAL_MS = 60000; // 1 minute
    this.isOnline = false;
    this.statusCache = new Map(); // Cache online status
    this.cacheExpiry = 10000; // Cache for 10 seconds
    this.listeners = new Set(); // Event listeners for status changes
    this.websocketInitialized = false;
    
    // Initialize WebSocket listeners
    this.initializeWebSocket();
  }
  
  /**
   * Initialize WebSocket listeners for real-time status updates
   */
  initializeWebSocket() {
    if (this.websocketInitialized) return;
    
    try {
      // Listen for user_online events
      socketService.on('user_online', (data) => {
        logger.info('WebSocket: User came online:', data.username);
        // Update cache
        this.statusCache.set(data.username, {
          online: true,
          timestamp: Date.now()
        });
        // Notify all listeners
        this.notifyListeners(data.username, true);
      });
      
      // Listen for user_offline events
      socketService.on('user_offline', (data) => {
        logger.info('WebSocket: User went offline:', data.username);
        // Update cache
        this.statusCache.set(data.username, {
          online: false,
          timestamp: Date.now()
        });
        // Notify all listeners
        this.notifyListeners(data.username, false);
      });
      
      // Listen for online count updates
      socketService.on('online_count_update', (data) => {
        logger.debug('WebSocket: Online count updated:', data.count);
        // Could trigger a global event here if needed
      });
      
      this.websocketInitialized = true;
      logger.success('WebSocket listeners initialized for online status');
    } catch (error) {
      logger.error('Failed to initialize WebSocket listeners:', error);
    }
  }

  /**
   * Mark user as online and start heartbeat
   */
  async goOnline(username) {
    if (!username) return;

    try {
      // Mark user as online
      await api.post(`/online-status/${username}/online`);
      this.isOnline = true;
      logger.info('Marked as online:', username);

      // Start heartbeat to keep status alive
      this.startHeartbeat(username);
    } catch (error) {
      logger.error('Error going online:', error);
    }
  }

  /**
   * Mark user as offline and stop heartbeat
   */
  async goOffline(username) {
    if (!username) return;

    try {
      // Stop heartbeat first
      this.stopHeartbeat();

      // Mark user as offline
      await api.post(`/online-status/${username}/offline`);
      this.isOnline = false;
      logger.info('Marked as offline:', username);
    } catch (error) {
      logger.error('Error going offline:', error);
    }
  }

  /**
   * Start heartbeat to refresh online status
   */
  startHeartbeat(username) {
    // Clear any existing heartbeat
    this.stopHeartbeat();

    // Send heartbeat every minute
    this.heartbeatInterval = setInterval(async () => {
      try {
        await api.post(`/online-status/${username}/refresh`);
        logger.debug('Heartbeat sent for:', username);
      } catch (error) {
        logger.error('Heartbeat failed:', error);
        // If heartbeat fails, try to go online again
        this.goOnline(username);
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    logger.info('Heartbeat started for:', username);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat stopped');
    }
  }

  /**
   * Get list of online users
   */
  async getOnlineUsers() {
    try {
      const response = await api.get('/online-status/users');
      return response.data.onlineUsers || [];
    } catch (error) {
      logger.error('Error getting online users:', error);
      return [];
    }
  }

  /**
   * Check if a specific user is online (with caching)
   */
  async isUserOnline(username) {
    try {
      // Check cache first
      const cached = this.statusCache.get(username);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.online;
      }

      // Fetch from server
      const response = await api.get(`/online-status/${username}`);
      const online = response.data.isOnline || false;
      
      // Update cache
      this.statusCache.set(username, {
        online,
        timestamp: Date.now()
      });

      // Notify listeners of status change
      this.notifyListeners(username, online);

      return online;
    } catch (error) {
      logger.error('Error checking user online status:', error);
      return false;
    }
  }

  /**
   * Subscribe to status changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of status change
   */
  notifyListeners(username, online) {
    this.listeners.forEach(callback => {
      try {
        callback(username, online);
      } catch (error) {
        logger.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(username = null) {
    if (username) {
      this.statusCache.delete(username);
    } else {
      this.statusCache.clear();
    }
  }

  /**
   * Get online users count
   */
  async getOnlineCount() {
    try {
      const response = await api.get('/online-status/count');
      return response.data.onlineCount || 0;
    } catch (error) {
      logger.error('Error getting online count:', error);
      return 0;
    }
  }
}

// Create singleton instance
const onlineStatusService = new OnlineStatusService();

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  const username = localStorage.getItem('username');
  if (!username) return;

  if (document.hidden) {
    // Page is hidden, but don't go offline immediately
    // Just stop heartbeat to save resources
    logger.debug('Page hidden - pausing heartbeat');
  } else {
    // Page is visible again, resume heartbeat
    logger.debug('Page visible - resuming heartbeat');
    onlineStatusService.goOnline(username);
  }
});

// Handle before unload (user closing tab/browser)
window.addEventListener('beforeunload', () => {
  const username = localStorage.getItem('username');
  if (username && onlineStatusService.isOnline) {
    // Send offline status synchronously
    const baseUrl = window.RUNTIME_CONFIG?.API_URL || 
                    process.env.REACT_APP_API_URL || 
                    getApiUrl();
    navigator.sendBeacon(
      `${baseUrl}/online-status/${username}/offline`,
      ''
    );
  }
});

export default onlineStatusService;
