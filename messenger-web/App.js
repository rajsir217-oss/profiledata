import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { AppUpdate } from '@capawesome/capacitor-app-update';

import useAuthStore from '@messenger/stores/authStore';
import messengerSocket from '@messenger/services/socketService';
import { setTokenGetter } from '@messenger/utils/imageHelper';
import { initializePushNotifications } from './src/services/pushNotificationService';
import {
  biometricGetRefreshToken,
  isCredentialSaved,
  isNativePlatform,
} from './src/services/biometricAuth';

// Wire imageHelper to the auth store so protected /api/users/media/ URLs
// receive the current JWT as ?token=...
setTokenGetter(() => useAuthStore.getState().token);

import LoginScreen from './src/screens/LoginScreen';
import ConversationListScreen from './src/screens/ConversationListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';

/**
 * Check for app updates on Android
 * Automatically prompts user to update if a new version is available
 */
const checkForUpdates = async () => {
  try {
    const result = await AppUpdate.getAppUpdateInfo();
    
    if (result.updateAvailability === 2) { // UPDATE_AVAILABLE
      console.log('[AppUpdate] Update available:', result.availableVersion);
      
      if (result.immediateUpdateAllowed) {
        // Perform immediate update (blocks user until complete)
        await AppUpdate.performImmediateUpdate();
      } else if (result.flexibleUpdateAllowed) {
        // Flexible update (download in background)
        await AppUpdate.startFlexibleUpdate();
      }
    } else {
      console.log('[AppUpdate] App is up to date');
    }
  } catch (error) {
    console.error('[AppUpdate] Failed to check for updates:', error);
  }
};

export default function App() {
  const { token, restore, loginWithRefreshToken } = useAuthStore();
  const [currentScreen, setCurrentScreen] = useState('conversations');
  const [chatParams, setChatParams] = useState(null);
  // Only block the whole app with a spinner during the INITIAL session
  // bootstrap. Interactive auth operations (phone send/verify, MFA) toggle
  // the store's isLoading flag, and using it here would remount LoginScreen
  // mid-flow and wipe its local state (phone code prompt, account selection).
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // Bootstrap auth: try SSO from URL (?token=...) first, then fall back
    // to restoring any persisted session from AsyncStorage. On native devices
    // with saved biometric credentials, prompt for biometrics and silently
    // refresh the session without requiring the user to re-enter credentials.
    const bootstrap = async () => {
      try {
        const ssoSucceeded = await useAuthStore.getState().ssoFromUrl();
        if (!ssoSucceeded) {
          await restore();
        }

        const state = useAuthStore.getState();
        if (!state.token && isNativePlatform()) {
          try {
            const saved = await isCredentialSaved();
            if (saved) {
              const bioRes = await biometricGetRefreshToken();
              if (bioRes?.ok) {
                await loginWithRefreshToken(bioRes.refreshToken);
              }
            }
          } catch (e) {
            // Biometric auto-login is a best-effort fallback; continue to login.
          }
        }
      } finally {
        setBootstrapping(false);
      }
    };
    bootstrap();

    // Check for app updates on Android
    if (Platform.OS === 'android') {
      checkForUpdates();
    }
  }, []);

  useEffect(() => {
    if (token) {
      messengerSocket.connect();
      initializePushNotifications();
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
