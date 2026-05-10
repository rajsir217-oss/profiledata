import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import useAuthStore from '@messenger/stores/authStore';

// Status pill metadata for invited public-email recipients (US Vedika).
// `status` values come from the backend's publicParticipants[].status field
// and are enriched onto each message's publicEmailsSent[] in messenger_service.
const PUBLIC_EMAIL_STATUS_META = {
  invited:    { label: 'Pending activation', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  interested: { label: 'Interested',         color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  replied:    { label: 'Replied',            color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  opted_out:  { label: 'Unsubscribed',       color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' },
};
const getPublicEmailStatusMeta = (status) =>
  PUBLIC_EMAIL_STATUS_META[status] || PUBLIC_EMAIL_STATUS_META.invited;

export default function ChatScreen({ id, name, isGroup, isLegacy, profile, username, isOnline, onBack }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState(null);
  // US Vedika public group states
  const [showPublicRecipientModal, setShowPublicRecipientModal] = useState(false);
  const [publicRecipients, setPublicRecipients] = useState([]);
  const [includeInvitation, setIncludeInvitation] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  // Clear chat
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);

  const handleClearChat = async () => {
    setClearingChat(true);
    try {
      const api = useAuthStore.getState().getApi();
      if (isLegacy) {
        await api.post(`/api/users/messages/conversation/${name}/clear`);
      } else {
        await api.post(`/api/messenger/conversations/${id}/clear`);
      }
      setShowClearConfirm(false);
      setMessages([]);
      console.log('🧹 Chat cleared from view');
    } catch (e) {
      console.error('❌ Failed to clear chat:', e);
      setError(e?.response?.data?.detail || 'Failed to clear chat');
    } finally {
      setClearingChat(false);
    }
  };

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

  // Parse @{email} mentions from message content
  // Supports both @{email} and @email formats
  const parsePublicRecipients = (text) => {
    const recipients = [];

    // Try @{email} format first
    const curlyBraceRegex = /@\{([^}]+)\}/g;
    let match;
    while ((match = curlyBraceRegex.exec(text)) !== null) {
      const content = match[1];
      // Parse "Name <email>" or just "email"
      const emailMatch = content.match(/(?:([^<]+)<)?([^>]+)>?/);
      if (emailMatch) {
        const displayName = emailMatch[1]?.trim();
        const email = emailMatch[2]?.trim();
        if (email && email.includes('@')) {
          recipients.push({
            email,
            displayName: displayName || email,
          });
        }
      }
    }

    // Also support simple @email format (without curly braces)
    const simpleEmailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    while ((match = simpleEmailRegex.exec(text)) !== null) {
      const email = match[1];
      recipients.push({
        email,
        displayName: email.split('@')[0],
      });
    }

    return recipients;
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    // Check for public recipients in US Vedika (public_group)
    const recipients = parsePublicRecipients(newMessage);
    if (recipients.length > 0 && !isLegacy) {
      // Show modal for public recipients
      setPublicRecipients(recipients);
      setShowPublicRecipientModal(true);
      return;
    }

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

  const sendWithPublicRecipients = async (deliveryMode) => {
    setShowPublicRecipientModal(false);
    setSending(true);
    try {
      console.log('📤 Sending message with public recipients:', publicRecipients);
      const api = useAuthStore.getState().getApi();
      const res = await api.post(`/api/messenger/conversations/${id}/messages`, {
        conversationId: id,
        contentType: 'text',
        content: newMessage.trim(),
        publicRecipients,
        deliveryMode,
        includeInvitation,
      });
      console.log('✅ Message sent successfully:', res.data);
      setNewMessage('');
      setPublicRecipients([]);
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
              ? `${profile.firstName} ${profile.lastName}`.trim()
              : name}
          </Text>
          {isGroup ? (
            <Text style={styles.headerSubtitle}>Group Chat</Text>
          ) : username && typeof isOnline === 'function' ? (
            <View style={styles.headerStatusRow}>
              <View
                style={[
                  styles.headerStatusInlineDot,
                  isOnline(username) && styles.headerStatusInlineDotOnline,
                ]}
              />
              <Text
                style={[
                  styles.headerSubtitle,
                  isOnline(username) && styles.headerSubtitleOnline,
                ]}
              >
                {isOnline(username) ? 'Online' : 'Offline'}
              </Text>
            </View>
          ) : null}
        </View>
        {isGroup && (
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => setIsMuted(!isMuted)}
          >
            <Text style={styles.muteButtonText}>
              {isMuted ? '🔇' : '🔔'}
            </Text>
          </TouchableOpacity>
        )}
        {/* Clear Chat button — visible for ALL conversation types (1:1, group, public_group) */}
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setShowClearConfirm(true)}
        >
          <Text style={styles.clearButtonText}>🗑️</Text>
        </TouchableOpacity>
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
              const isPublicEmail = msg.senderType === 'public_email';
              const senderName = isGroup && !isOwn ? (msg.senderUsername || msg.fromUsername || 'Unknown') : null;
              const publicEmailsSent = Array.isArray(msg.publicEmailsSent) ? msg.publicEmailsSent : [];
              return (
                <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                  <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn, isPublicEmail && styles.messageBubblePublic]}>
                    {isPublicEmail ? (
                      <Text style={styles.publicEmailBadge}>📧 {msg.publicEmail || msg.senderUsername}</Text>
                    ) : isGroup && senderName && !isOwn && (
                      <Text style={styles.senderName}>{senderName}</Text>
                    )}
                    <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                      {msg.content}
                    </Text>

                    {/* US Vedika invitation recipients — show current activation
                        status for each @{email} that was invited via this message. */}
                    {publicEmailsSent.length > 0 && (
                      <View style={styles.recipientsList}>
                        <Text style={styles.recipientsListTitle}>
                          Invited recipient{publicEmailsSent.length > 1 ? 's' : ''}
                        </Text>
                        {publicEmailsSent.map((r, idx) => {
                          const meta = getPublicEmailStatusMeta(r.status);
                          return (
                            <View
                              key={`${r.email}-${idx}`}
                              style={styles.recipientRow}
                            >
                              <Text style={styles.recipientEmail} numberOfLines={1}>
                                📧 {r.displayName && r.displayName !== r.email
                                  ? `${r.displayName} <${r.email}>`
                                  : r.email}
                              </Text>
                              <View
                                style={[
                                  styles.recipientStatusPill,
                                  { backgroundColor: meta.bg, borderColor: meta.color },
                                ]}
                              >
                                <Text style={[styles.recipientStatusText, { color: meta.color }]}>
                                  {meta.label}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

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

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🧹 Clear Chat?</Text>
            <Text style={styles.modalText}>
              This will hide all current messages from your view only.
              {isGroup ? ' Other participants will still see them.' : ' The other person will still see the messages on their side.'}
            </Text>
            <Text style={styles.modalText}>
              New messages will continue to appear normally.
            </Text>

            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={handleClearChat}
              disabled={clearingChat}
            >
              <Text style={styles.modalButtonTextPrimary}>
                {clearingChat ? 'Clearing...' : 'Yes, Clear Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setShowClearConfirm(false)}
              disabled={clearingChat}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Public Recipient Modal */}
      {showPublicRecipientModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📧 Messaging Non-Members</Text>
            <Text style={styles.modalText}>
              This message will be delivered by email to:
            </Text>
            {publicRecipients.map((recipient, index) => (
              <Text key={index} style={styles.recipientText}>
                • {recipient.displayName} ({recipient.email})
              </Text>
            ))}
            <Text style={styles.modalSubtext}>Choose how to send:</Text>

            {/* Send + Invite Button */}
            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={() => sendWithPublicRecipients('both')}
            >
              <Text style={styles.modalButtonTextPrimary}>
                ✉️ Send + Invite
              </Text>
              <Text style={styles.modalButtonSubtext}>
                Email includes "Join L3V3L" button
              </Text>
            </TouchableOpacity>

            {/* Send Only Button — DISABLED.
                We require every external recipient to be onboarded via the
                "Send + Invite" path so the funnel/lineage stays intact.
                Keeping the button visible (greyed) explains the constraint
                rather than silently removing the option. */}
            <TouchableOpacity
              style={[styles.modalButtonSecondary, styles.modalButtonDisabled]}
              disabled={true}
              activeOpacity={1}
            >
              <Text style={styles.modalButtonTextSecondary}>
                📨 Send Message Only
              </Text>
              <Text style={styles.modalButtonSubtext}>
                Disabled — please use "Send + Invite"
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => {
                setShowPublicRecipientModal(false);
                setPublicRecipients([]);
              }}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  headerSubtitle: { fontSize: 11, color: '#888' },
  headerSubtitleOnline: { color: '#22c55e' },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  headerStatusInlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6b7280',
    marginRight: 6,
  },
  headerStatusInlineDotOnline: {
    backgroundColor: '#22c55e',
  },

  // Invited-recipient list (US Vedika @{email} status)
  recipientsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  recipientsListTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a3a3c2',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recipientEmail: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
    marginRight: 8,
  },
  recipientStatusPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  recipientStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
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
  publicEmailBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  messageBubblePublic: {
    backgroundColor: '#1e1e3f',
    borderColor: '#6366f1',
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
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 12,
    lineHeight: 20,
  },
  recipientText: {
    fontSize: 14,
    color: '#e94560',
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 12,
  },
  muteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  muteButtonText: {
    fontSize: 20,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.4)',
    marginLeft: 8,
  },
  clearButtonText: {
    fontSize: 18,
  },
  modalSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalButtonSecondary: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#4b5563',
  },
  modalButtonTextSecondary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
});
