import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import useAuthStore from '@messenger/stores/authStore';

export default function ChatScreen({ id, name, isGroup, isLegacy, profile, onBack }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      loadMessages();
    }
  }, [id]);

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📬 Loading messages for conversation:', id, 'isLegacy:', isLegacy);
      const api = useAuthStore.getState().getApi();
      let res;
      if (isLegacy) {
        // Legacy 1:1 main app messages
        res = await api.get(`/api/users/messages/conversation/${name}?username=${user.username}`);
      } else {
        res = await api.get(`/api/messenger/conversations/${id}/messages`);
      }
      console.log('✅ API Response:', res.data);

      // Handle different response structures
      const msgs = Array.isArray(res.data) ? res.data : res.data.messages || [];
      console.log('✅ Messages loaded:', msgs.length);
      setMessages(msgs);
    } catch (e) {
      console.error('❌ Failed to load messages:', e);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      console.log('📤 Sending message:', isLegacy ? 'legacy' : 'messenger', id);
      const api = useAuthStore.getState().getApi();
      let res;
      if (isLegacy) {
        res = await api.post('/api/users/messages/send', {
          toUsername: name,
          content: newMessage.trim(),
        });
      } else {
        res = await api.post(`/api/messenger/conversations/${id}/messages`, {
          conversationId: id,
          contentType: 'text',
          content: newMessage.trim(),
        });
      }
      console.log('✅ Message sent successfully:', res.data);
      setNewMessage('');
      await loadMessages();
    } catch (e) {
      console.error('❌ Failed to send message:', e);
      console.error('❌ Error response:', e.response?.data);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {profile && (profile.firstName || profile.lastName)
              ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
              : name}
          </Text>
          {profile && !isGroup && (
            <Text style={styles.headerMeta} numberOfLines={1}>
              {[
                profile.age ? `${profile.age}y` : null,
                profile.height || null,
                profile.profession || null,
                profile.location || null,
              ].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e94560" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadMessages}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubText}>Start the conversation!</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderUsername === user.username || msg.fromUsername === user.username;
              const senderName = isGroup && !isOwn ? (msg.senderUsername || msg.fromUsername || 'Unknown') : null;
              return (
                <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                  <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
                    {isGroup && senderName && !isOwn && (
                      <Text style={styles.senderName}>{senderName}</Text>
                    )}
                    <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                      {msg.content}
                    </Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  backButton: { padding: 8, marginRight: 8 },
  backButtonText: { fontSize: 20, color: '#e94560' },
  headerInfo: { flex: 1, flexDirection: 'column' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, flexGrow: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: { color: '#e94560', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  retryBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#fff', fontSize: 18, marginBottom: 8 },
  emptySubText: { color: '#888', fontSize: 14 },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 12,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  messageBubbleOwn: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'right',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
