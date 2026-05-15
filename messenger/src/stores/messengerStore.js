/**
 * Messenger Store — Zustand store for conversations and messages.
 */

import { create } from 'zustand';
import { MESSENGER_API } from '../config/api';
import useAuthStore from './authStore';

const useMessengerStore = create((set, get) => ({
  conversations: [],
  totalConversations: 0,
  messages: {},          // { [conversationId]: Message[] }
  activeConversationId: null,
  isLoadingConversations: false,
  isLoadingMessages: false,
  typingUsers: {},       // { [conversationId]: Set<username> }

  // -----------------------------------------------------------------
  // Conversations
  // -----------------------------------------------------------------

  fetchConversations: async (page = 1) => {
    set({ isLoadingConversations: true });
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get(`${MESSENGER_API}/conversations`, {
        params: { page, limit: 50 },
      });
      set({
        conversations: res.data.conversations,
        totalConversations: res.data.total,
        isLoadingConversations: false,
      });
    } catch (e) {
      set({ isLoadingConversations: false });
    }
  },

  createConversation: async (participantUsernames, type = 'direct', groupName = null) => {
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.post(`${MESSENGER_API}/conversations`, {
        participantUsernames,
        type,
        groupName,
      });
      const conv = res.data.conversation;
      set((state) => ({
        conversations: [conv, ...state.conversations.filter((c) => c.id !== conv.id)],
      }));
      return conv;
    } catch (e) {
      return null;
    }
  },

  // -----------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------

  fetchMessages: async (conversationId, before = null) => {
    set({ isLoadingMessages: true });
    try {
      const api = useAuthStore.getState().getApi();
      const params = { limit: 50 };
      if (before) params.before = before;
      const res = await api.get(
        `${MESSENGER_API}/conversations/${conversationId}/messages`,
        { params },
      );
      const fetched = res.data.messages;
      set((state) => {
        const existing = state.messages[conversationId] || [];
        // Prepend older messages (before cursor) or set fresh
        const merged = before
          ? [...fetched, ...existing]
          : fetched;
        return {
          messages: { ...state.messages, [conversationId]: merged },
          isLoadingMessages: false,
        };
      });
      return { hasMore: res.data.hasMore, cursor: res.data.cursor };
    } catch (e) {
      set({ isLoadingMessages: false });
      return { hasMore: false, cursor: null };
    }
  },

  sendMessage: async (conversationId, content, contentType = 'text', media = null, replyTo = null) => {
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sender = useAuthStore.getState().user?.username || '';
    const tempMsg = {
      id: tempId,
      tempId,
      conversationId,
      senderUsername: sender,
      contentType,
      content,
      media,
      replyTo,
      createdAt: new Date().toISOString(),
      status: 'sending',
      isOptimistic: true,
    };
    // Optimistically add immediately so the UI feels instant
    set((state) => {
      const existing = state.messages[conversationId] || [];
      return {
        messages: { ...state.messages, [conversationId]: [...existing, tempMsg] },
      };
    });
    get()._bumpConversation(conversationId, content, contentType);

    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.post(
        `${MESSENGER_API}/conversations/${conversationId}/messages`,
        { conversationId, content, contentType, media, replyTo },
      );
      const msg = res.data.message;
      set((state) => {
        const existing = state.messages[conversationId] || [];
        const withoutTemp = existing.filter((m) => m.id !== tempId);
        const alreadyHas = withoutTemp.some((m) => m.id === msg.id);
        const next = alreadyHas ? withoutTemp : [...withoutTemp, msg];
        return { messages: { ...state.messages, [conversationId]: next } };
      });
      return msg;
    } catch (e) {
      // Mark the optimistic message as failed so the UI can offer retry
      set((state) => {
        const existing = state.messages[conversationId] || [];
        const updated = existing.map((m) =>
          m.id === tempId ? { ...m, status: 'failed' } : m,
        );
        return { messages: { ...state.messages, [conversationId]: updated } };
      });
      return null;
    }
  },

  deleteMessage: async (messageId, conversationId) => {
    try {
      const api = useAuthStore.getState().getApi();
      await api.delete(`${MESSENGER_API}/messages/${messageId}`);
      set((state) => {
        const msgs = (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: '' } : m,
        );
        return { messages: { ...state.messages, [conversationId]: msgs } };
      });
      return true;
    } catch (e) {
      return false;
    }
  },

  // -----------------------------------------------------------------
  // Delivery Receipts
  // -----------------------------------------------------------------

  markDelivered: async (messageIds) => {
    try {
      const api = useAuthStore.getState().getApi();
      await api.put(`${MESSENGER_API}/messages/status`, {
        messageIds,
        status: 'delivered',
      });
    } catch (e) { /* silent */ }
  },

  markRead: async (messageIds) => {
    try {
      const api = useAuthStore.getState().getApi();
      await api.put(`${MESSENGER_API}/messages/status`, {
        messageIds,
        status: 'read',
      });
    } catch (e) { /* silent */ }
  },

  // -----------------------------------------------------------------
  // Real-time handlers (called by socket service)
  // -----------------------------------------------------------------

  onNewMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.messages[conversationId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messages: { ...state.messages, [conversationId]: [...existing, message] },
      };
    });
    get()._bumpConversation(conversationId, message.content, message.contentType);
  },

  onMessageDeleted: (conversationId, messageId) => {
    set((state) => {
      const existing = state.messages[conversationId] || [];
      if (!existing.length) return state;
      const updated = existing.map((m) =>
        m.id === messageId
          ? { ...m, isDeleted: true, content: '', media: null }
          : m,
      );
      return {
        messages: { ...state.messages, [conversationId]: updated },
      };
    });
  },

  onMessageStatusUpdate: (messageIds, status) => {
    set((state) => {
      const updated = { ...state.messages };
      for (const convId of Object.keys(updated)) {
        updated[convId] = updated[convId].map((m) =>
          messageIds.includes(m.id) ? { ...m, status } : m,
        );
      }
      return { messages: updated };
    });
  },

  onTyping: (conversationId, username, isTyping) => {
    set((state) => {
      const current = new Set(state.typingUsers[conversationId] || []);
      if (isTyping) current.add(username);
      else current.delete(username);
      return {
        typingUsers: { ...state.typingUsers, [conversationId]: current },
      };
    });
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  // -----------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------

  _bumpConversation: (conversationId, content, contentType) => {
    const preview = contentType === 'text'
      ? (content || '').slice(0, 100)
      : `[${(contentType || 'file').charAt(0).toUpperCase() + (contentType || 'file').slice(1)}]`;

    set((state) => {
      const convs = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessageAt: new Date().toISOString(), lastMessagePreview: preview }
          : c,
      );
      // Sort: most recent first
      convs.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      return { conversations: convs };
    });
  },
}));

export default useMessengerStore;
