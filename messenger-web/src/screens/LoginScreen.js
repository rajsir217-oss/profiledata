// messenger-web/src/screens/LoginScreen.js
// Adapted from main app Login.js for react-native-web
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import Turnstile from 'react-turnstile';
import useAuthStore from '@messenger/stores/authStore';
import { API_BASE_URL } from '@messenger/config/api';
import { getMainAppUrl, getTurnstileSiteKey } from '../config/apiConfig';
import {
  biometricGetRefreshToken,
  clearCredential,
  isBiometricAvailable,
  isCredentialSaved,
  isNativePlatform,
  saveCredential,
} from '../services/biometricAuth';

const LoginScreen = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginWithRefreshToken, token, refreshToken, user, error: storeError } = useAuthStore();
  const displayError = error || storeError;

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricSaved, setBiometricSaved] = useState(false);
  const [enableBiometricOnDevice, setEnableBiometricOnDevice] = useState(false);
  const [biometricPersisted, setBiometricPersisted] = useState(false);

  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaRetryCount, setCaptchaRetryCount] = useState(0);
  const turnstileRef = useRef();

  const turnstileSiteKey = getTurnstileSiteKey();

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const canBypassCaptcha = captchaError && captchaRetryCount >= 3;

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

  useEffect(() => {
    const persistBiometric = async () => {
      if (!enableBiometricOnDevice) return;
      if (biometricPersisted) return;
      if (!token || !refreshToken || !user?.username) return;

      try {
        const res = await saveCredential({ username: user.username, refreshToken });
        if (res?.ok) {
          setBiometricSaved(true);
          setBiometricPersisted(true);
        }
      } catch (_) {
      }
    };
    persistBiometric();
  }, [enableBiometricOnDevice, biometricPersisted, refreshToken, token, user?.username]);

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

  const trackLogin = async (username) => {
    try {
      const platform = isNativePlatform() ? 'mobile' : 'web';
      await fetch(`${API_BASE_URL}/api/notifications/track-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ platform })
      });
    } catch (e) {
      console.error('Failed to track login:', e);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await biometricGetRefreshToken();
      if (!res?.ok) {
        setError(res?.error || 'Biometric login failed.');
        return;
      }

      const loginRes = await loginWithRefreshToken(res.refreshToken);
      if (!loginRes?.ok) {
        setError(loginRes?.error || 'Biometric login failed.');
        return;
      }

      // Track login after successful authentication
      if (loginRes?.user?.username) {
        await trackLogin(loginRes.user.username);
      }
    } catch (e) {
      setError(e?.message || 'Biometric login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearBiometric = async () => {
    try {
      await clearCredential();
      setBiometricSaved(false);
      setEnableBiometricOnDevice(false);
      setBiometricPersisted(false);
    } catch (_) {
    }
  };

  const openMainApp = (path = '') => {
    const base = getMainAppUrl();
    const url = path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      setError('Please enter username and password');
      return;
    }

    if (!isDevelopment && !captchaToken && !canBypassCaptcha) {
      setError('Please complete the security check');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const captchaTokenForBackend = isDevelopment
        ? 'XXXX.DUMMY.TOKEN.XXXX'
        : (captchaToken || null);

      const result = await login(
        form.username.trim(),
        form.password.trim(),
        captchaTokenForBackend
      );

      if (result?.ok) {
        // Track login after successful authentication
        if (result?.user?.username) {
          await trackLogin(result.user.username);
        }
        return; // Auth state will route us to chats.
      }

      // Backend says MFA is required → transition UI to OTP entry screen
      // and trigger code delivery to the user's email/SMS.
      if (result?.mfaRequired) {
        setMfaChannel(result.mfa_channel || 'email');
        setContactMasked(result.contact_masked || '');
        setMfaRequired(true);
        setError('');
        // Auto-send the first OTP. The user can also tap "Resend Code".
        await sendMfaCode();
        return;
      }

      setError(result?.error || 'Invalid username or password');
    } catch (e) {
      setError(e.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    setCaptchaError(false);
    setError('');
  };

  const handleCaptchaError = () => {
    setCaptchaError(true);
    setCaptchaRetryCount(prev => prev + 1);
    setCaptchaToken(null);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
  };

  const retryCaptcha = () => {
    setCaptchaError(false);
    setCaptchaToken(null);
    try {
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    } catch (_) {}
  };

  const sendMfaCode = async () => {
    try {
      setResendingCode(true);
      // Use API_BASE_URL so this works in dev (localhost), prod (api.l3v3lmatches.com),
      // and on Android emulator (10.0.2.2). Hard-coding localhost broke prod.
      const response = await fetch(`${API_BASE_URL}/api/auth/mfa/send-code`, {
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
      const result = await login(
        form.username.trim(),
        form.password.trim(),
        null,
        mfaCode.trim()
      );

      if (result?.ok) {
        // Track login after successful MFA verification
        if (result?.user?.username) {
          await trackLogin(result.user.username);
        }
        return;
      }
      setError(result?.error || 'Invalid verification code');
    } catch (e) {
      setError(e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.brandHeader}>
            <Text style={styles.brandIcon}>🦋</Text>
            <Text style={styles.brandText}>L3V3L</Text>
          </View>
          <Text style={styles.title}>{mfaRequired ? 'Verification Required' : 'Welcome Back!'}</Text>
          <Text style={styles.subtitle}>
            {mfaRequired ? `Enter the code sent to your ${mfaChannel || 'email'}` : 'Sign in to continue'}
          </Text>

          {!mfaRequired ? (
            <>
            {biometricSupported && biometricSaved && (
              <TouchableOpacity
                style={[styles.button, styles.biometricButton]}
                onPress={handleBiometricLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In with Biometrics</Text>}
              </TouchableOpacity>
            )}

            {biometricSupported && (
              <TouchableOpacity
                style={styles.biometricToggleRow}
                onPress={() => setEnableBiometricOnDevice((v) => !v)}
                disabled={loading}
              >
                <Text style={styles.biometricToggleIcon}>{enableBiometricOnDevice ? '☑️' : '⬜️'}</Text>
                <Text style={[styles.openMainAppText, styles.biometricToggleText]}>Enable biometric login on this device</Text>
              </TouchableOpacity>
            )}

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

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => openMainApp('/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.captchaContainer}>
              {isDevelopment ? null : ((captchaError || !turnstileSiteKey) ? (
                <View style={styles.captchaErrorBox}>
                  <Text style={styles.captchaErrorTitle}>Security check unavailable</Text>
                  {captchaRetryCount < 3 ? (
                    <TouchableOpacity style={styles.captchaRetryBtn} onPress={retryCaptcha}>
                      <Text style={styles.captchaRetryText}>Retry</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.captchaBypassText}>Proceeding without security check</Text>
                  )}
                </View>
              ) : (
                <Turnstile
                  ref={turnstileRef}
                  sitekey={turnstileSiteKey}
                  onVerify={handleCaptchaChange}
                  onError={handleCaptchaError}
                  onExpire={handleCaptchaExpire}
                  theme="light"
                />
              ))}
            </View>

            {displayError && <Text style={styles.error}>{displayError}</Text>}

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit}
              disabled={loading || (!isDevelopment && !captchaToken && !canBypassCaptcha)}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>

            {biometricSupported && biometricSaved && (
              <TouchableOpacity style={styles.biometricClearRow} onPress={handleClearBiometric} disabled={loading}>
                <Text style={[styles.openMainAppText, styles.biometricClearText]}>Remove biometric login from this device</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.openMainAppBtn} onPress={() => openMainApp('')}>
              <Text style={styles.openMainAppText}>🏠 Open Main App</Text>
            </TouchableOpacity>
          </>
        ) : (
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#0f0f23',
    paddingVertical: 24,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#1a1a3e',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  brandIcon: {
    fontSize: 40,
    lineHeight: 44,
  },
  brandText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e94560',
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#16213e',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 18,
  },
  inputContainer: { width: '100%', marginBottom: 14, position: 'relative' },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  passwordToggle: { position: 'absolute', right: 12, top: 12 },
  passwordToggleText: { fontSize: 18 },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 14,
  },
  forgotText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '600',
  },
  captchaContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  captchaErrorBox: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  captchaErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  captchaRetryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  captchaRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  captchaBypassText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  error: { color: '#ef4444', marginBottom: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#16213e',
    paddingVertical: 14,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  biometricButton: {
    marginBottom: 12,
  },
  biometricToggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  biometricToggleIcon: {
    fontSize: 16,
  },
  biometricToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  biometricClearRow: { paddingVertical: 10, alignItems: 'center' },
  biometricClearText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  openMainAppBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  openMainAppText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  mfaInfo: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 18,
    width: '100%',
  },
  mfaInfoText: { fontSize: 14, color: '#111827', textAlign: 'center' },
  mfaInfoTextBold: { fontWeight: '800' },
  resendButton: { paddingVertical: 10, alignItems: 'center' },
  resendButtonText: { color: '#4f46e5', fontSize: 14, fontWeight: '700' },
  backButton: { paddingVertical: 10, alignItems: 'center' },
  backButtonText: { color: '#6b7280', fontSize: 14, fontWeight: '600' },
});

export default LoginScreen;
