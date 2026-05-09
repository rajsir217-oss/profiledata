/**
 * NewChatScreen — Search for L3V3L MATCHES users and start a conversation.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import useAuthStore from '../stores/authStore';
import useMessengerStore from '../stores/messengerStore';
import { API_BASE_URL } from '../config/api';
import { getProfilePicUrl } from '../utils/imageHelper';

export default function NewChatScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { createConversation } = useMessengerStore();

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get(`${API_BASE_URL}/api/users/search`, {
        params: { q, limit: 20 },
      });
      const users = (res.data.users || res.data || []).filter(
        (u) => u.username !== user?.username,
      );
      setResults(users);
    } catch (e) {
      setResults([]);
    }
    setLoading(false);
  };

  const startChat = async (otherUser) => {
    const conv = await createConversation([otherUser.username]);
    if (conv) {
      const displayName =
        `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.username;
      navigation.replace('Chat', { conversationId: conv.id, title: displayName });
    }
  };

  const renderUser = ({ item }) => {
    const displayName =
      `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.username;
    const img = getProfilePicUrl(item) || null;

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => startChat(item)}>
        <View style={styles.avatar}>
          {img ? (
            <Image source={{ uri: img }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{(displayName[0] || '?').toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userHandle}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or username..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} color="#6C3FA0" />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.username || item._id}
        renderItem={renderUser}
        ListEmptyComponent={
          !loading && query.trim() ? (
            <Text style={styles.empty}>No users found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  searchBtn: {
    backgroundColor: '#6C3FA0',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6C3FA0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#222' },
  userHandle: { fontSize: 13, color: '#999', marginTop: 1 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32, fontSize: 14 },
});
