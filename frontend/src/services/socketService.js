// frontend/src/services/socketService.js
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.username = null;
    this.listeners = {};
  }

  connect(username) {
    if (this.connected && this.username === username) {
      console.log('✅ Already connected to WebSocket');
      return;
    }

    this.username = username;
    
    // Connect to Socket.IO server
    this.socket = io('http://localhost:8000', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      console.log('👤 Registering user as online:', username);
      this.connected = true;
      
      // Register user as online
      this.socket.emit('user_online', { username });
      console.log('✅ Emitted user_online event');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from WebSocket server');
      this.connected = false;
    });

    this.socket.on('connection_established', (data) => {
      console.log('✅ Connection established:', data);
    });

    // Online status events
    this.socket.on('online_count_update', (data) => {
      console.log('🟢 Online count update:', data.count);
      this.trigger('online_count_update', data);
    });

    this.socket.on('user_online', (data) => {
      console.log('🟢 User came online:', data.username);
      this.trigger('user_online', data);
    });

    this.socket.on('user_offline', (data) => {
      console.log('⚪ User went offline:', data.username);
      this.trigger('user_offline', data);
    });

    // Message events
    this.socket.on('new_message', (data) => {
      console.log('💬 New message received:', data);
      this.trigger('new_message', data);
    });

    this.socket.on('user_typing', (data) => {
      console.log('⌨️ User typing:', data);
      this.trigger('user_typing', data);
    });

    // Error handling
    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.username = null;
      console.log('👋 Disconnected from WebSocket');
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
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Send message
  sendMessage(to, message) {
    if (!this.connected) {
      console.error('❌ Not connected to WebSocket');
      return;
    }

    this.socket.emit('send_message', {
      from: this.username,
      to,
      message
    });
  }

  // Send typing indicator
  sendTyping(to, isTyping) {
    if (!this.connected) return;

    this.socket.emit('user_typing', {
      username: this.username,
      to,
      isTyping
    });
  }

  // Get online users
  getOnlineUsers() {
    if (!this.connected) return;

    this.socket.emit('get_online_users', {});
  }

  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
