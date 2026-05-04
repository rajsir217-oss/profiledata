/**
 * ChatScreen — Message thread with media attach + delivery ticks.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import dayjs from 'dayjs';
import useAuthStore from '../stores/authStore';
import useMessengerStore from '../stores/messengerStore';
import messengerSocket from '../services/socketService';
import { uploadMedia } from '../services/mediaService';

export default function ChatScreen({ route }) {
  const { conversationId, title } = route.params;
  const { user } = useAuthStore();
  const {
    messages: allMessages,
    isLoadingMessages,
    fetchMessages,
    sendMessage,
    markRead,
    setActiveConversation,
    typingUsers,
  } = useMessengerStore();

  const messages = allMessages[conversationId] || [];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeout = useRef(null);
  const hasMoreRef = useRef(true);
  const cursorRef = useRef(null);

  const typing = typingUsers[conversationId];
  const typingArray = typing ? Array.from(typing) : [];

  useEffect(() => {
    setActiveConversation(conversationId);
    fetchMessages(conversationId).then((result) => {
      hasMoreRef.current = result.hasMore;
      cursorRef.current = result.cursor;
    });
    return () => setActiveConversation(null);
  }, [conversationId]);

  // Mark unread messages as read when viewed
  useEffect(() => {
    if (!messages.length) return;
    const unread = messages
      .filter((m) => m.senderUsername !== user?.username && m.status !== 'read')
      .map((m) => m.id);
    if (unread.length) {
      markRead(unread);
      messengerSocket.markRead(unread);
    }
  }, [messages.length]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isLoadingMessages) return;
    fetchMessages(conversationId, cursorRef.current).then((result) => {
      hasMoreRef.current = result.hasMore;
      cursorRef.current = result.cursor;
    });
  }, [conversationId, isLoadingMessages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    await sendMessage(conversationId, trimmed, 'text');
    setSending(false);
    messengerSocket.sendTyping(conversationId, false);
  };

  const handleAttach = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1600,
        maxHeight: 1600,
      });
      if (result.didCancel || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);

      const media = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.type || 'image/jpeg',
      });

      if (media) {
        await sendMessage(conversationId, '', 'image', media);
      }
      setUploading(false);
    } catch (e) {
      setUploading(false);
    }
  };

  const handleTextChange = (val) => {
    setText(val);
    messengerSocket.sendTyping(conversationId, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      messengerSocket.sendTyping(conversationId, false);
    }, 2000);
  };

  const renderTicks = (msg) => {
    if (msg.senderUsername !== user?.username) return null;
    switch (msg.status) {
      case 'read':
        return <Text style={[styles.tick, styles.tickRead]}>✓✓</Text>;
      case 'delivered':
        return <Text style={styles.tick}>✓✓</Text>;
      default:
        return <Text style={styles.tick}>✓</Text>;
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderUsername === user?.username;
    const isDeleted = item.isDeleted;

    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {isDeleted ? (
          <Text style={styles.deletedText}>This message was deleted</Text>
        ) : (
          <>
            {item.contentType === 'image' && item.media?.url ? (
              <Image
                source={{ uri: item.media.url }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
            ) : null}
            {item.content ? (
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
                {item.content}
              </Text>
            ) : null}
          </>
        )}
        <View style={styles.meta}>
          <Text style={styles.timeText}>
            {dayjs(item.createdAt).format('h:mm A')}
          </Text>
          {renderTicks(item)}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => {
          if (flatListRef.current && messages.length) {
            flatListRef.current.scrollToEnd({ animated: false });
          }
        }}
        onStartReached={loadMore}
        onStartReachedThreshold={0.2}
        ListHeaderComponent={
          isLoadingMessages ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color="#6C3FA0" />
          ) : null
        }
      />

      {typingArray.length > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>
            {typingArray.join(', ')} typing...
          </Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={handleAttach} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color="#6C3FA0" />
          ) : (
            <Text style={styles.attachIcon}>📎</Text>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          value={text}
          onChangeText={handleTextChange}
          multiline
          maxLength={5000}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendIcon}>▶</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0ece5' },
  messageList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  bubbleMe: {
    backgroundColor: '#dcd0f0',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: { fontSize: 15, color: '#222', lineHeight: 20 },
  messageTextMe: { color: '#2d1654' },
  deletedText: { fontSize: 14, color: '#999', fontStyle: 'italic' },
  mediaImage: {
    width: 220,
    height: 180,
    borderRadius: 10,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: { fontSize: 11, color: '#999' },
  tick: { fontSize: 12, color: '#999', marginLeft: 4 },
  tickRead: { color: '#6C3FA0' },
  typingBar: { paddingHorizontal: 16, paddingVertical: 4 },
  typingText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  attachBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachIcon: { fontSize: 22 },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15,
    color: '#333',
    maxHeight: 120,
    marginHorizontal: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C3FA0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },
});
