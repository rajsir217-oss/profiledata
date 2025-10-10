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
    console.log('🔧 socketService.connect() called with username:', username);
    
    if (this.connected && this.username === username) {
      console.log('✅ Already connected to WebSocket');
      return;
    }

    this.username = username;
    
    console.log('🔌 Attempting to connect to Socket.IO server at http://localhost:8000');
    console.log('👤 Username for connection:', username);
    
    // Connect to Socket.IO server with username in headers
    this.socket = io('http://localhost:8000', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      extraHeaders: {
        'username': username
      }
    });
    
    console.log('📡 Socket.IO client initialized:', !!this.socket);

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Connected to WebSocket server');
      console.log('👤 Registering user as online:', username);
      console.log('🔍 Socket ID:', this.socket.id);
      this.connected = true;
      
      // Register user as online
      this.socket.emit('user_online', { username });
      console.log('✅ Emitted user_online event');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket server');
      console.log('📋 Disconnect reason:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      console.error('📋 Error details:', error.message);
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
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
      console.log('💬 New message received via WebSocket:', data);
      console.log('📋 Message from:', data.from);
      console.log('📋 Message content:', data.message);
      console.log('📋 Triggering new_message event to listeners');
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
    if (!this.connected || !this.socket) {
      console.error('❌ Not connected to WebSocket');
      console.log('🔍 Connection status:', this.connected);
      console.log('🔍 Socket exists:', !!this.socket);
      return;
    }

    const messageData = {
      id: `${this.username}_${to}_${Date.now()}`,
      from: this.username,
      to,
      message,
      timestamp: new Date().toISOString()
    };

    console.log('📤 Emitting send_message event:', messageData);
    this.socket.emit('send_message', messageData);
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
