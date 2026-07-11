/**
 * L3V3L Messenger — React Native App Entry Point
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import useAuthStore from './src/stores/authStore';
import messengerSocket from './src/services/socketService';
import {
  isNativePlatform,
  isCredentialSaved,
  biometricGetRefreshToken,
} from './src/services/biometricAuth';

import LoginScreen from './src/screens/LoginScreen';
import ConversationListScreen from './src/screens/ConversationListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';

const Stack = createNativeStackNavigator();

function App() {
  const { token, restore, loginWithRefreshToken, ssoFromUrl } = useAuthStore();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const ssoSucceeded = await ssoFromUrl();
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
      } catch (_) {
        // Ignore bootstrap errors so the user can still log in.
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  // Connect / disconnect socket based on auth
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#6C3FA0" />
      <NavigationContainer>
        {token ? (
          <Stack.Navigator>
            <Stack.Screen
              name="Conversations"
              component={ConversationListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                title: route.params?.title || 'Chat',
                headerStyle: { backgroundColor: '#6C3FA0' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '600' },
              })}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{
                title: 'New Chat',
                headerStyle: { backgroundColor: '#6C3FA0' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '600' },
              }}
            />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
