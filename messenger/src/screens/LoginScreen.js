/**
 * LoginScreen — Uses existing L3V3L MATCHES credentials.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import useAuthStore from '../stores/authStore';
import {
  isNativePlatform,
  isBiometricAvailable,
  isCredentialSaved,
  saveCredential,
  clearCredential,
  biometricGetRefreshToken,
} from '../services/biometricAuth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricSaved, setBiometricSaved] = useState(false);

  const { login, loginWithRefreshToken, isLoading, error } = useAuthStore();

  useEffect(() => {
    const initBiometrics = async () => {
      if (!isNativePlatform()) return;
      const availability = await isBiometricAvailable();
      const supported = !!availability?.isAvailable;
      setBiometricSupported(supported);
      if (!supported) return;
      const saved = await isCredentialSaved();
      setBiometricSaved(saved);
    };
    initBiometrics();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setLocalError('');
    const res = await login(username.trim(), password.trim());
    if (!res?.ok) return;

    if (enableBiometric) {
      const state = useAuthStore.getState();
      const refreshToken = state.refreshToken;
      const user = state.user;
      if (user?.username && refreshToken) {
        try {
          await saveCredential({ username: user.username, refreshToken });
          setBiometricSaved(true);
        } catch (_) {
          // Saving biometric credentials is best-effort.
        }
      }
    }
  };

  const handleBiometricLogin = async () => {
    setLocalError('');
    const bioRes = await biometricGetRefreshToken();
    if (!bioRes?.ok) {
      setLocalError(bioRes?.error || 'Biometric login failed.');
      return;
    }
    const loginRes = await loginWithRefreshToken(bioRes.refreshToken);
    if (!loginRes?.ok) {
      setLocalError(loginRes?.error || 'Biometric login failed.');
    }
  };

  const handleClearBiometric = async () => {
    try {
      await clearCredential();
      setBiometricSaved(false);
      setEnableBiometric(false);
    } catch (_) {}
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>L3V3L</Text>
        <Text style={styles.subtitle}>Messenger</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
          onSubmitEditing={handleLogin}
        />

        {localError || error ? (
          <Text style={styles.error}>{localError || error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {biometricSupported && biometricSaved && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.biometricButton]}
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In with Biometrics</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.biometricClearRow}
              onPress={handleClearBiometric}
              disabled={isLoading}
            >
              <Text style={[styles.hint, styles.biometricClearText]}>
                Remove biometric login from this device
              </Text>
            </TouchableOpacity>
          </>
        )}

        {biometricSupported && !biometricSaved && (
          <TouchableOpacity
            style={styles.biometricToggleRow}
            onPress={() => setEnableBiometric((v) => !v)}
            disabled={isLoading}
          >
            <Text style={styles.biometricToggleIcon}>{enableBiometric ? '☑️' : '⬜️'}</Text>
            <Text style={[styles.hint, styles.biometricToggleText]}>
              Enable biometric login on this device
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>
          Use your L3V3L MATCHES credentials to sign in.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6C3FA0',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6C3FA0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  biometricButton: {
    marginTop: 12,
  },
  biometricToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  biometricToggleIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  biometricToggleText: {
    marginTop: 0,
    color: '#666',
  },
  biometricClearRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  biometricClearText: {
    marginTop: 0,
    color: '#e53e3e',
  },
  error: {
    color: '#e53e3e',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  hint: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
