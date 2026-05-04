/**
 * L3V3L Messenger — React Native App Entry Point
 */

import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import useAuthStore from './src/stores/authStore';
import messengerSocket from './src/services/socketService';

import LoginScreen from './src/screens/LoginScreen';
import ConversationListScreen from './src/screens/ConversationListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';

const Stack = createNativeStackNavigator();

function App() {
  const { token, isLoading, restore } = useAuthStore();

  useEffect(() => {
    restore();
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

  if (isLoading) {
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
