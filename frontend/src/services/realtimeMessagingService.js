/**
 * Real-time Messaging Service
 * Handles SSE connections, message updates, and unread counts globally
 */

import api from '../api';

class RealtimeMessagingService {
  constructor() {
    this.eventSource = null;
    this.unreadCounts = new Map(); // username -> unread count
    this.listeners = new Set(); // Components listening for updates
    this.currentUser = null;
    this.reconnectInterval = null;
    this.pollingInterval = null;
    this.isConnected = false;
  }

  /**
   * Initialize the service for a user
   */
  async initialize(username) {
    if (!username) return;
    
    this.currentUser = username;
    console.log('🚀 Initializing realtime messaging for:', username);
    
    // Fetch initial unread counts
    await this.fetchUnreadCounts();
    
    // Start SSE connection
    this.connectSSE();
    
    // Start polling as backup (every 10 seconds)
    this.startPolling();
  }

  /**
   * Connect to SSE endpoint for real-time updates
   */
  connectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      const url = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/users'}/messages/stream/${this.currentUser}`;
      console.log('📡 Connecting to SSE:', url);
      
      this.eventSource = new EventSource(url);
      
      this.eventSource.onopen = () => {
        console.log('✅ SSE connection established');
        this.isConnected = true;
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeUpdate(data);
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
      
      // Handle new message events
      this.eventSource.addEventListener('new_message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📬 New message received:', data);
          this.handleNewMessage(data);
        } catch (error) {
          console.error('Error handling new message:', error);
        }
      });
      
      // Handle unread count updates
      this.eventSource.addEventListener('unread_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📊 Unread count update:', data);
          this.handleUnreadUpdate(data);
        } catch (error) {
          console.error('Error handling unread update:', error);
        }
      });
      
      this.eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        this.isConnected = false;
        this.eventSource.close();
        
        // Reconnect after 5 seconds
        if (!this.reconnectInterval) {
          this.reconnectInterval = setInterval(() => {
            console.log('🔄 Attempting to reconnect SSE...');
            this.connectSSE();
          }, 5000);
        }
      };
      
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      this.isConnected = false;
    }
  }

  /**
   * Start polling as backup mechanism
   */
  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    // Poll every 10 seconds
    this.pollingInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('🔄 Polling for updates (SSE disconnected)...');
        this.fetchUnreadCounts();
      }
    }, 10000);
  }

  /**
   * Fetch unread message counts for all conversations
   */
  async fetchUnreadCounts() {
    try {
      const response = await api.get(`/messages/unread-counts/${this.currentUser}`);
      const counts = response.data.unread_counts || {};
      
      console.log('📊 Fetched unread counts:', counts);
      
      // Update local cache
      this.unreadCounts.clear();
      Object.entries(counts).forEach(([username, count]) => {
        if (count > 0) {
          this.unreadCounts.set(username, count);
        }
      });
      
      // Notify all listeners
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
    }
  }

  /**
   * Handle real-time update from SSE
   */
  handleRealtimeUpdate(data) {
    console.log('🔄 Real-time update:', data);
    
    if (data.type === 'new_message') {
      this.handleNewMessage(data);
    } else if (data.type === 'unread_update') {
      this.handleUnreadUpdate(data);
    } else if (data.type === 'heartbeat') {
      console.log('💓 Heartbeat received');
    }
  }

  /**
   * Handle new message event
   */
  handleNewMessage(data) {
    const { from, message, timestamp } = data;
    
    // Increment unread count for sender
    const currentCount = this.unreadCounts.get(from) || 0;
    this.unreadCounts.set(from, currentCount + 1);
    
    console.log(`📬 New message from ${from}, unread count: ${currentCount + 1}`);
    
    // Show notification
    this.showNotification(from, message);
    
    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Handle unread count update
   */
  handleUnreadUpdate(data) {
    const { username, count } = data;
    
    if (count > 0) {
      this.unreadCounts.set(username, count);
    } else {
      this.unreadCounts.delete(username);
    }
    
    console.log(`📊 Unread count for ${username}: ${count}`);
    
    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Mark messages as read for a user
   */
  async markAsRead(username) {
    try {
      await api.post(`/messages/mark-read`, {
        reader: this.currentUser,
        sender: username
      });
      
      // Clear unread count locally
      this.unreadCounts.delete(username);
      this.notifyListeners();
      
      console.log(`✅ Marked messages from ${username} as read`);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }

  /**
   * Get unread count for a specific user
   */
  getUnreadCount(username) {
    return this.unreadCounts.get(username) || 0;
  }

  /**
   * Get total unread count
   */
  getTotalUnreadCount() {
    let total = 0;
    this.unreadCounts.forEach(count => {
      total += count;
    });
    return total;
  }

  /**
   * Check if user has unread messages
   */
  hasUnreadMessages(username) {
    return this.getUnreadCount(username) > 0;
  }

  /**
   * Subscribe to updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    // Immediately call with current state
    callback({
      unreadCounts: this.unreadCounts,
      totalUnread: this.getTotalUnreadCount()
    });
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of updates
   */
  notifyListeners() {
    const data = {
      unreadCounts: this.unreadCounts,
      totalUnread: this.getTotalUnreadCount()
    };
    
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error notifying listener:', error);
      }
    });
  }

  /**
   * Show browser notification for new message
   */
  showNotification(from, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New message from ${from}`, {
        body: message.substring(0, 100),
        icon: '/favicon.ico',
        tag: `message-${from}`,
        requireInteraction: false
      });
      
      notification.onclick = () => {
        window.focus();
        // Navigate to messages
        window.location.href = `/messages/${from}`;
        notification.close();
      };
      
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  }

  /**
   * Clean up connections
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isConnected = false;
    this.unreadCounts.clear();
    this.listeners.clear();
    
    console.log('🔌 Disconnected from realtime messaging');
  }
}

// Create singleton instance
const realtimeMessagingService = new RealtimeMessagingService();

// Auto-initialize when user is logged in
const username = localStorage.getItem('username');
if (username) {
  realtimeMessagingService.initialize(username);
}

export default realtimeMessagingService;
