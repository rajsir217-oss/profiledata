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
    this.joinedConversations = new Set();
    this._statusListeners = new Set();
  }

  onStatusChange(listener) {
    this._statusListeners.add(listener);
    // Push current state immediately
    try { listener(this.connected); } catch (e) { /* ignore */ }
    return () => this._statusListeners.delete(listener);
  }

  _notifyStatus() {
    for (const l of this._statusListeners) {
      try { l(this.connected); } catch (e) { /* ignore */ }
    }
  }

  connect() {
    const { user } = useAuthStore.getState();
    if (!user || this.connected) return;

    this.socket = io(WS_URL, {
      // Allow polling fallback for networks/proxies that block raw websockets;
      // socket.io will upgrade to websocket once available.
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      query: { username: user.username },
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this._notifyStatus();
      // Announce presence
      this.socket.emit('messenger:online', {});

      for (const conversationId of this.joinedConversations) {
        this.socket.emit('messenger:join_conversation', { conversationId });
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this._notifyStatus();
    });

    this.socket.on('connect_error', () => {
      this.connected = false;
      this._notifyStatus();
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

    this.socket.on('messenger:message_deleted', (data) => {
      const { conversationId, messageId } = data || {};
      if (!conversationId || !messageId) return;
      useMessengerStore.getState().onMessageDeleted(conversationId, messageId);
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

  joinConversation(conversationId) {
    if (!conversationId) return;
    this.joinedConversations.add(conversationId);
    if (!this.connected) return;
    this.socket.emit('messenger:join_conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    if (!conversationId) return;
    this.joinedConversations.delete(conversationId);
    if (!this.connected) return;
    this.socket.emit('messenger:leave_conversation', { conversationId });
  }
}

// Singleton
const messengerSocket = new MessengerSocketService();
export default messengerSocket;
