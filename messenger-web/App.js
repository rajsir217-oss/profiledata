import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import useAuthStore from '@messenger/stores/authStore';
import messengerSocket from '@messenger/services/socketService';

import LoginScreen from './src/screens/LoginScreen';
import ConversationListScreen from './src/screens/ConversationListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';

export default function App() {
  const { token, isLoading, restore } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState('conversations');
  const [chatParams, setChatParams] = useState(null);

  useEffect(() => {
    restore();
  }, []);

  useEffect(() => {
    if (token) {
      messengerSocket.connect();
    } else {
      messengerSocket.disconnect();
    }
    return () => messengerSocket.disconnect();
  }, [token]);

  if (isLoading) {
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
