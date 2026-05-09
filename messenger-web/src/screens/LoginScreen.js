// messenger-web/src/screens/LoginScreen.js
// Adapted from main app Login.js for react-native-web
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import useAuthStore from '@messenger/stores/authStore';

const LoginScreen = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, error: storeError } = useAuthStore();
  const displayError = error || storeError;

  // MFA State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChannel, setMfaChannel] = useState('');
  const [contactMasked, setContactMasked] = useState('');
  const [resendingCode, setResendingCode] = useState(false);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
    setError('');
    // Clear the store-level (session-expired) error once the user starts typing
    if (storeError) {
      useAuthStore.setState({ error: null });
    }
  };

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await login(
        form.username.trim(),
        form.password.trim(),
        'XXXX.DUMMY.TOKEN.XXXX'  // Dummy CAPTCHA token for dev (messenger-web)
      );

      if (!success) {
        setError('Invalid username or password');
      }
    } catch (e) {
      setError(e.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const sendMfaCode = async () => {
    try {
      setResendingCode(true);
      const response = await fetch('http://localhost:8000/api/auth/mfa/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim() })
      });
      const data = await response.json();

      if (data.mock_code) {
        setError(`DEV MODE: Use code ${data.mock_code}`);
      }
    } catch (e) {
      console.error('Error sending MFA code:', e);
      setError('Failed to send verification code');
    } finally {
      setResendingCode(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await login(
        form.username.trim(),
        form.password.trim(),
        'XXXX.DUMMY.TOKEN.XXXX',  // Dummy CAPTCHA token
        mfaCode.trim()
      );

      if (!success) {
        setError('Invalid verification code');
      }
    } catch (e) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>L3V3L Messenger</Text>

        {!mfaRequired ? (
          /* Regular Login Form */
          <>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={form.username}
                onChangeText={(value) => handleChange('username', value)}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={form.password}
                onChangeText={(value) => handleChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </Text>
              </TouchableOpacity>
            </View>

            {displayError && <Text style={styles.error}>{displayError}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>
          </>
        ) : (
          /* MFA Verification Form */
          <>
            <View style={styles.mfaInfo}>
              <Text style={styles.mfaInfoText}>
                🔒 Code sent to: <Text style={styles.mfaInfoTextBold}>{contactMasked}</Text>
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter verification code"
                value={mfaCode}
                onChangeText={setMfaCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
              />
            </View>

            {displayError && <Text style={styles.error}>{displayError}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleMfaVerify} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendButton} onPress={sendMfaCode} disabled={resendingCode}>
              <Text style={styles.resendButtonText}>
                {resendingCode ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => setMfaRequired(false)}>
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#6C3FA0' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#6C3FA0' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 40 },
  inputContainer: { width: '100%', marginBottom: 15, position: 'relative' },
  input: { width: '100%', padding: 15, backgroundColor: '#fff', borderRadius: 8, fontSize: 16 },
  passwordToggle: { position: 'absolute', right: 15, top: 15 },
  passwordToggleText: { fontSize: 20 },
  error: { color: '#ff6b6b', marginBottom: 15, textAlign: 'center' },
  button: { backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 10 },
  buttonText: { color: '#6C3FA0', fontSize: 16, fontWeight: 'bold' },
  mfaInfo: { backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24, width: '100%' },
  mfaInfoText: { fontSize: 14, color: '#fff', textAlign: 'center' },
  mfaInfoTextBold: { fontWeight: 'bold' },
  resendButton: { padding: 10 },
  resendButtonText: { color: '#fff', fontSize: 14 },
  backButton: { padding: 10 },
  backButtonText: { color: '#fff', fontSize: 14 },
});

export default LoginScreen;
