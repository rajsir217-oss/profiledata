// frontend/src/services/socketService.js
// Unified real-time service using Socket.IO for messages, online status, and unread counts
import { io } from 'socket.io-client';
import api from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.username = null;
    this.listeners = {};
    this.unreadCounts = new Map(); // Track unread counts per user
    this.onlineStatusCache = new Map(); // Cache online status
  }

  connect(username) {
    logger.socket('socketService.connect() called with username:', username);
    
    if (this.connected && this.username === username) {
      logger.socket('Already connected to WebSocket');
      return;
    }

    this.username = username;
    
    // Use proper backend URL from config (supports all environments)
    const socketUrl = getBackendUrl();
    
    logger.socket(`Connecting to Socket.IO at ${socketUrl}`);
    
    // Connect to Socket.IO server with username as query parameter
    this.socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000, // Increase timeout to 10 seconds
      query: {
        username: username
      }
    });

    // Connection events
    this.socket.on('connect', () => {
      logger.socket('Connected to WebSocket (ID:', this.socket.id + ')');
      this.connected = true;
      
      // Register user as online
      this.socket.emit('user_online', { username });
      
      // Fetch initial data
      this.fetchUnreadCounts();
      this.fetchOnlineUsers(); // Populate online status cache
      
      // Trigger connection event
      this.trigger('connected', { username });
    });

    this.socket.on('disconnect', (reason) => {
      logger.socket('Disconnected:', reason);
      this.connected = false;
      this.trigger('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      logger.error('Socket connection error:', error.message);
      logger.error('Connection details:', {
        url: socketUrl,
        transport: this.socket.io.engine ? this.socket.io.engine.transport.name : 'none',
        connected: this.connected
      });
    });

    // Online status events
    this.socket.on('online_count_update', (data) => {
      logger.socket('Online count:', data.count);
      this.trigger('online_count_update', data);
    });

    this.socket.on('user_online', (data) => {
      logger.socket('User came online:', data.username);
      this.onlineStatusCache.set(data.username, true);
      this.trigger('user_online', data);
      logger.socket('Updated cache and triggered listeners');
    });

    this.socket.on('user_offline', (data) => {
      logger.socket('User went offline:', data.username);
      this.onlineStatusCache.set(data.username, false);
      this.trigger('user_offline', data);
      logger.socket('Updated cache and triggered listeners');
    });

    // Message events
    this.socket.on('new_message', (data) => {
      logger.socket('New message received:', {
        from: data.from,
        to: data.to || this.username,
        message: data.message,
        timestamp: data.timestamp
      });
      
      // Increment unread count if not current chat
      const currentCount = this.unreadCounts.get(data.from) || 0;
      this.unreadCounts.set(data.from, currentCount + 1);
      
      // Notify listeners
      this.trigger('new_message', data);
      this.trigger('unread_update', {
        username: data.from,
        count: currentCount + 1,
        totalUnread: this.getTotalUnread()
      });
    });

    this.socket.on('user_typing', (data) => {
      this.trigger('user_typing', data);
    });

    this.socket.on('unread_count_update', (data) => {
      // Handle server-side unread count updates
      logger.socket('Unread count update:', data);
      if (data.username && typeof data.count === 'number') {
        this.unreadCounts.set(data.username, data.count);
        this.trigger('unread_update', {
          username: data.username,
          count: data.count,
          totalUnread: this.getTotalUnread()
        });
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.username = null;
      this.unreadCounts.clear();
      this.onlineStatusCache.clear();
      logger.socket('Disconnected from WebSocket');
    }
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error('Error in listener:', error);
        }
      });
    }
  }

  // Send message
  sendMessage(to, message) {
    if (!this.connected || !this.socket) {
      logger.error('Not connected to WebSocket');
      return Promise.reject(new Error('Not connected'));
    }

    const messageData = {
      id: `${this.username}_${to}_${Date.now()}`,
      from: this.username,
      to,
      message,
      timestamp: new Date().toISOString()
    };

    logger.socket('Sending message:', {
      from: messageData.from,
      to: messageData.to,
      message: messageData.message
    });
    this.socket.emit('send_message', messageData);
    return Promise.resolve(messageData);
  }

  // Send typing indicator
  sendTyping(to, isTyping) {
    if (!this.connected) return;

    this.socket.emit('typing', {
      from: this.username,
      to,
      isTyping
    });
  }

  // Online status methods
  async isUserOnline(username) {
    // Check cache first
    if (this.onlineStatusCache.has(username)) {
      const cached = this.onlineStatusCache.get(username);
      logger.socket(`Online status for ${username}: ${cached} (cached)`);
      return cached;
    }

    // Fallback to API if not in cache
    try {
      const response = await api.get(`/online-status/${username}`);
      const online = response.data.online || false;
      this.onlineStatusCache.set(username, online);
      logger.socket(`Online status for ${username}: ${online} (from API)`);
      return online;
    } catch (error) {
      logger.error('Error checking online status:', error);
      return false;
    }
  }

  async getOnlineUsers() {
    if (this.connected) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn('⏱️ WebSocket timeout, falling back to API...');
          this.socket.off('online_users_list');
          // Fallback to API on timeout
          api.get('/online-status/users')
            .then(response => resolve(response.data.onlineUsers || []))
            .catch(error => {
              console.error('❌ API fallback failed:', error);
              resolve([]);
            });
        }, 1500); // 1.5 second timeout (reduced from 3s)
        
        this.socket.emit('get_online_users', {});
        this.socket.once('online_users_list', (data) => {
          clearTimeout(timeout);
          console.log('✅ WebSocket response:', data);
          resolve(data.users || []);
        });
      });
    } else {
      // Fallback to API
      try {
        console.log('📡 Using API (WebSocket not connected)');
        const response = await api.get('/online-status/users');
        console.log('✅ API Response:', response.data);
        return response.data.onlineUsers || [];
      } catch (error) {
        console.error('❌ API Error:', error);
        logger.error('Error getting online users:', error);
        return [];
      }
    }
  }

  async fetchOnlineUsers() {
    try {
      const response = await api.get('/online-status/users');
      const users = response.data.onlineUsers || [];
      
      // Populate cache with online users
      users.forEach(username => {
        this.onlineStatusCache.set(username, true);
      });
      
      logger.socket(`Loaded ${users.length} online users into cache:`, users);
    } catch (error) {
      logger.error('Error fetching online users:', error);
    }
  }

  // Unread count methods
  async fetchUnreadCounts() {
    try {
      const response = await api.get(`/messages/unread-counts/${this.username}`);
      const counts = response.data.unread_counts || {};
      
      this.unreadCounts.clear();
      Object.entries(counts).forEach(([username, count]) => {
        if (count > 0) {
          this.unreadCounts.set(username, count);
        }
      });
      
      this.trigger('unread_counts_loaded', {
        counts: this.unreadCounts,
        totalUnread: this.getTotalUnread()
      });
      
      logger.socket('Loaded unread counts:', counts);
    } catch (error) {
      logger.error('Error fetching unread counts:', error);
    }
  }

  async markAsRead(username) {
    try {
      await api.post('/messages/mark-read', {
        reader: this.username,
        sender: username
      });
      
      this.unreadCounts.delete(username);
      this.trigger('unread_update', {
        username,
        count: 0,
        totalUnread: this.getTotalUnread()
      });
      
      logger.socket('Marked messages from', username, 'as read');
    } catch (error) {
      logger.error('Error marking as read:', error);
    }
  }

  getUnreadCount(username) {
    return this.unreadCounts.get(username) || 0;
  }

  getTotalUnread() {
    let total = 0;
    this.unreadCounts.forEach(count => {
      total += count;
    });
    return total;
  }

  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
