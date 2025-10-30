/**
 * Message Polling Service
 */
import api from '../api';
import logger from '../utils/logger';

class MessagePollingService {
  constructor() {
    this.username = null;
    this.pollingInterval = null;
    this.heartbeatInterval = null;
    this.lastMessageTimestamp = null;
    this.listeners = [];
    this.isPolling = false;
    this.isCurrentlyPolling = false; // Track if a poll is in progress
    this.POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
    this.messageQueue = []; // Store all received messages
  }

  /**
   * Start polling for new messages with validation
   */
  async startPolling(username) {
    // Validation
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      logger.error('Invalid username for polling:', username);
      return;
    }

    // Skip if not currently polling or if a poll is already in progress
    if (!this.isPolling || !this.username || this.isCurrentlyPolling) {
      return;
    }

    this.isCurrentlyPolling = true; // Mark poll as in progress

    try {
      // Stop existing polling if different user
      if (this.isPolling && this.username !== username) {
        logger.info('Switching polling from', this.username, 'to', username);
        await this.stopPolling();
      }

      logger.info('Starting message polling for:', username);
      this.isPolling = true;
      this.username = username;
      this.lastMessageTimestamp = null; // Reset timestamp for new user
      
      // Mark user as online
      try {
        const api = (await import('../api')).default;
        await api.post(`/online-status/${username}/online`);
        logger.info('Marked user as online:', username);
      } catch (error) {
        logger.error('Failed to mark user as online:', error);
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
          logger.debug('Heartbeat: refreshed online status');
        } catch (error) {
          logger.error('Heartbeat failed:', error);
        }
      }, 30000); // 30 seconds
    } catch (error) {
      logger.error('Error starting polling:', error);
    } finally {
      this.isCurrentlyPolling = false; // Mark poll as complete
    }
  }

  /**
   * Poll for new messages with error handling and retry logic
   */
  async pollMessages() {
    // Skip if not currently polling or if a poll is already in progress
    if (!this.isPolling || !this.username || this.isCurrentlyPolling) {
      return;
    }

    this.isCurrentlyPolling = true; // Mark poll as in progress

    try {
      const params = this.lastMessageTimestamp 
        ? { since: this.lastMessageTimestamp }
        : {};

      const response = await api.get(`/messages/poll/${this.username}`, { 
        params,
        timeout: 10000 // 10 second timeout
      });
      
      // Validate response
      if (!response.data || typeof response.data.count !== 'number') {
        logger.error('Invalid response from polling endpoint');
        return;
      }
      
      if (response.data.count > 0) {
        logger.info(`Received ${response.data.count} new messages`);
        
        // Validate messages array
        if (!Array.isArray(response.data.messages)) {
          logger.error('Invalid messages array in response');
          return;
        }
        
        // Store messages in queue and notify listeners
        response.data.messages.forEach(message => {
          try {
            // Validate message structure
            if (!message || !message.from || !message.message) {
              logger.warn('Invalid message structure:', message);
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
            logger.error('Error processing message:', err);
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
        logger.error('Polling timeout - server not responding');
      } else if (error.response) {
        // Server responded with error
        logger.error(`Polling error ${error.response.status}:`, error.response.data?.detail || error.message);
      } else if (error.code === 'ERR_NETWORK') {
        logger.error('No response from server');
      } else {
        logger.error('Error polling messages:', error.message);
      }
    } finally {
      this.isCurrentlyPolling = false; // Mark poll as complete
    }
  }

  /**
   * Add listener for new messages
   */
  onNewMessage(callback) {
    this.listeners.push(callback);
    logger.debug('Added message listener, total:', this.listeners.length);
  }

  /**
   * Remove listener
   */
  offNewMessage(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
    logger.debug('Removed message listener, remaining:', this.listeners.length);
  }

  /**
   * Notify all listeners of new message
   */
  notifyListeners(message) {
    logger.debug('Notifying listeners of new message from:', message.from);
    this.listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        logger.error('Error in message listener:', error);
      }
    });
  }

  /**
   * Reset timestamp (useful when opening a conversation)
   */
  resetTimestamp() {
    this.lastMessageTimestamp = null;
    logger.debug('Reset message timestamp');
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
    
    logger.debug(`Found ${pending.length} pending messages for conversation with ${otherUser}`);
    return pending;
  }

  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
    logger.debug('Cleared message queue');
  }
}

// Create singleton instance
const messagePollingService = new MessagePollingService();

export default messagePollingService;
