/**
 * Socket Service for L3V3L Messenger
 * Manages Socket.IO connection and messenger:* events.
 */

import { io } from 'socket.io-client';
import { WS_URL } from '../config/api';
import useAuthStore from '../stores/authStore';
import useMessengerStore from '../stores/messengerStore';

class MessengerSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    const { user } = useAuthStore.getState();
    if (!user || this.connected) return;

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      query: { username: user.username },
    });

    this.socket.on('connect', () => {
      this.connected = true;
      // Announce presence
      this.socket.emit('messenger:online', {});
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    // Incoming message
    this.socket.on('messenger:new_message', (data) => {
      const { conversationId, message } = data;
      useMessengerStore.getState().onNewMessage(conversationId, message);

      // Auto-deliver if we receive while the app is open
      if (message?.id) {
        this.socket.emit('messenger:mark_delivered', { messageIds: [message.id] });
      }
    });

    // Delivery receipt updates
    this.socket.on('messenger:message_status', (data) => {
      const { messageIds, status } = data;
      useMessengerStore.getState().onMessageStatusUpdate(messageIds, status);
    });

    // Typing indicators
    this.socket.on('messenger:typing', (data) => {
      const { conversationId, username, isTyping } = data;
      useMessengerStore.getState().onTyping(conversationId, username, isTyping);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  sendTyping(conversationId, isTyping) {
    if (!this.connected) return;
    this.socket.emit('messenger:typing', { conversationId, isTyping });
  }

  markRead(messageIds) {
    if (!this.connected || !messageIds.length) return;
    this.socket.emit('messenger:mark_read', { messageIds });
  }

  markDelivered(messageIds) {
    if (!this.connected || !messageIds.length) return;
    this.socket.emit('messenger:mark_delivered', { messageIds });
  }
}

// Singleton
const messengerSocket = new MessengerSocketService();
export default messengerSocket;
