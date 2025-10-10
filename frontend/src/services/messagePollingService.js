/**
 * Message Polling Service
 * Simple HTTP polling for real-time messages (no WebSocket needed!)
 */
import api from '../api';

class MessagePollingService {
  constructor() {
    this.pollingInterval = null;
    this.lastMessageTimestamp = null;
    this.listeners = [];
    this.isPolling = false;
    this.POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
    this.messageQueue = []; // Store all received messages
  }

  /**
   * Start polling for new messages with validation
   */
  async startPolling(username) {
    // Validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      console.error('❌ Invalid username for polling:', username);
      return;
    }

    if (this.isPolling && this.username === username) {
      console.log('✅ Already polling for messages for:', username);
      return;
    }

    // Stop existing polling if different user
    if (this.isPolling && this.username !== username) {
      console.log('🔄 Switching polling from', this.username, 'to', username);
      await this.stopPolling();
    }

    console.log('🔄 Starting message polling for:', username);
    this.isPolling = true;
    this.username = username;
    this.lastMessageTimestamp = null; // Reset timestamp for new user
    
    // Mark user as online
    try {
      const api = (await import('../api')).default;
      await api.post(`/online-status/${username}/online`);
      console.log('🟢 Marked user as online:', username);
    } catch (error) {
      console.error('❌ Failed to mark user as online:', error);
    }
    
    // Initial poll
    this.pollMessages();

    // Set up interval
    this.pollingInterval = setInterval(() => {
      this.pollMessages();
    }, this.POLL_INTERVAL_MS);
    
    // Set up heartbeat to keep user online (every 30 seconds)
    this.heartbeatInterval = setInterval(async () => {
      try {
        const api = (await import('../api')).default;
        await api.post(`/online-status/${username}/refresh`);
        console.log('💓 Heartbeat: refreshed online status');
      } catch (error) {
        console.error('❌ Heartbeat failed:', error);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop polling
   */
  async stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('⏹️ Stopped message polling');
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 Stopped heartbeat');
    }
    
    // Mark user as offline (with delay to avoid race conditions during React remounts)
    if (this.username) {
      setTimeout(async () => {
        // Only mark offline if polling hasn't restarted
        if (!this.isPolling) {
          try {
            const api = (await import('../api')).default;
            await api.post(`/online-status/${this.username}/offline`);
            console.log('⚪ Marked user as offline:', this.username);
          } catch (error) {
            console.error('❌ Failed to mark user as offline:', error);
          }
        }
      }, 1000); // 1 second delay
    }
  }

  /**
   * Poll for new messages with error handling and retry logic
   */
  async pollMessages() {
    if (!this.username) {
      console.warn('⚠️ No username set, skipping poll');
      return;
    }

    try {
      const params = this.lastMessageTimestamp 
        ? { since: this.lastMessageTimestamp }
        : {};

      const response = await api.get(`/messages/poll/${this.username}`, { 
        params,
        timeout: 30000 // 30 second timeout for long polling
      });
      
      // Validate response
      if (!response.data || typeof response.data.count !== 'number') {
        console.error('❌ Invalid response from polling endpoint');
        return;
      }
      
      if (response.data.count > 0) {
        console.log(`💬 Received ${response.data.count} new messages`);
        
        // Validate messages array
        if (!Array.isArray(response.data.messages)) {
          console.error('❌ Invalid messages array in response');
          return;
        }
        
        // Store messages in queue and notify listeners
        response.data.messages.forEach(message => {
          try {
            // Validate message structure
            if (!message || !message.from || !message.message) {
              console.warn('⚠️ Invalid message structure:', message);
              return;
            }
            
            // Add to message queue
            this.messageQueue.push(message);
            
            // Keep queue size manageable (last 100 messages)
            if (this.messageQueue.length > 100) {
              this.messageQueue.shift();
            }
            
            // Notify all active listeners
            this.notifyListeners(message);
          } catch (err) {
            console.error('❌ Error processing message:', err);
          }
        });

        // Update last timestamp
        if (response.data.messages.length > 0) {
          const latestMessage = response.data.messages[0];
          if (latestMessage.timestamp) {
            this.lastMessageTimestamp = latestMessage.timestamp;
          }
        }
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('❌ Polling timeout - server not responding');
      } else if (error.response) {
        // Server responded with error
        console.error(`❌ Polling error ${error.response.status}:`, error.response.data?.detail || error.message);
      } else if (error.request) {
        // Request made but no response
        console.error('❌ No response from server');
      } else {
        console.error('❌ Error polling messages:', error.message);
      }
    }
  }

  /**
   * Add listener for new messages
   */
  onNewMessage(callback) {
    this.listeners.push(callback);
    console.log('👂 Added message listener, total:', this.listeners.length);
  }

  /**
   * Remove listener
   */
  offNewMessage(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
    console.log('👋 Removed message listener, remaining:', this.listeners.length);
  }

  /**
   * Notify all listeners of new message
   */
  notifyListeners(message) {
    console.log('📢 Notifying listeners of new message from:', message.from);
    this.listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('❌ Error in message listener:', error);
      }
    });
  }

  /**
   * Reset timestamp (useful when opening a conversation)
   */
  resetTimestamp() {
    this.lastMessageTimestamp = null;
    console.log('🔄 Reset message timestamp');
  }

  /**
   * Get pending messages for a specific conversation
   */
  getPendingMessages(currentUser, otherUser) {
    const pending = this.messageQueue.filter(msg => {
      const isFromThem = msg.from === otherUser && msg.to === currentUser;
      const isFromUs = msg.from === currentUser && msg.to === otherUser;
      return isFromThem || isFromUs;
    });
    
    console.log(`📬 Found ${pending.length} pending messages for conversation with ${otherUser}`);
    return pending;
  }

  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
    console.log('🗑️ Cleared message queue');
  }
}

// Create singleton instance
const messagePollingService = new MessagePollingService();

export default messagePollingService;
