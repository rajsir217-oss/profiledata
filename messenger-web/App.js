import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import useAuthStore from '@messenger/stores/authStore';
import messengerSocket from '@messenger/services/socketService';
import { setTokenGetter } from '@messenger/utils/imageHelper';

// Wire imageHelper to the auth store so protected /api/users/media/ URLs
// receive the current JWT as ?token=...
setTokenGetter(() => useAuthStore.getState().token);

import LoginScreen from './src/screens/LoginScreen';
import ConversationListScreen from './src/screens/ConversationListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';

export default function App() {
  const { token, restore } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState('conversations');
  const [chatParams, setChatParams] = useState(null);
  // Only block the whole app with a spinner during the INITIAL session
  // bootstrap. Interactive auth operations (phone send/verify, MFA) toggle
  // the store's isLoading flag, and using it here would remount LoginScreen
  // mid-flow and wipe its local state (phone code prompt, account selection).
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // Bootstrap auth: try SSO from URL (?token=...) first, then fall back
    // to restoring any persisted session from AsyncStorage.
    const bootstrap = async () => {
      try {
        const ssoSucceeded = await useAuthStore.getState().ssoFromUrl();
        if (!ssoSucceeded) {
          await restore();
        }
      } finally {
        setBootstrapping(false);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (token) {
      messengerSocket.connect();
    } else {
      messengerSocket.disconnect();
    }
    return () => messengerSocket.disconnect();
  }, [token]);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6C3FA0' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  if (currentScreen === 'conversations') {
    return (
      <ConversationListScreen
        onChatOpen={(params) => {
          setChatParams(params);
          setCurrentScreen('chat');
        }}
        onNewChat={() => setCurrentScreen('newchat')}
        onLogout={() => {
          useAuthStore.getState().logout();
          setCurrentScreen('conversations');
        }}
      />
    );
  }

  if (currentScreen === 'chat' && chatParams) {
    return (
      <ChatScreen
        {...chatParams}
        onBack={() => {
          setChatParams(null);
          setCurrentScreen('conversations');
        }}
      />
    );
  }

  if (currentScreen === 'newchat') {
    return (
      <NewChatScreen
        onBack={() => setCurrentScreen('conversations')}
        onChatOpen={(params) => {
          setChatParams(params);
          setCurrentScreen('chat');
        }}
      />
    );
  }

  return null;
}
