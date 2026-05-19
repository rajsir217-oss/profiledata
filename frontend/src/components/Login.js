// frontend/src/components/Login.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "axios";
import api from "../api";
import socketService from "../services/socketService";
import sessionManager from "../services/sessionManager";
import toastService from '../services/toastService';
import { getBackendUrl, getTurnstileSiteKey } from "../config/apiConfig";
import {
  biometricLogin,
  clearCredential,
  isBiometricAvailable,
  isCredentialSaved,
  isNativePlatform,
  saveCredential,
} from '../services/biometricAuth';
import SEO from "./SEO";
import { getPageSEO } from "../utils/seo";
// Using Cloudflare Turnstile instead of reCAPTCHA (100% free, no limits)
import Turnstile from "react-turnstile";
import "./Login.css";

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaRetryCount, setCaptchaRetryCount] = useState(0);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const turnstileRef = useRef();
  const ssoExchangeGuardRef = useRef({ code: null });
  const navigate = useNavigate();
  const location = useLocation();
  const pageSEO = getPageSEO('login');

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricSaved, setBiometricSaved] = useState(false);
  const [enableBiometricOnDevice, setEnableBiometricOnDevice] = useState(false);

  // MFA State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChannel, setMfaChannel] = useState("");
  const [contactMasked, setContactMasked] = useState("");
  const [showBackupCodeInput, setShowBackupCodeInput] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);

  // Hide topbar and remove body padding on login page
  useEffect(() => {
    const topbar = document.querySelector('.top-bar');
    if (topbar) {
      topbar.style.display = 'none';
    }
    
    // Remove any body padding/margin
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    
    // Show topbar and restore body styles when leaving login page
    return () => {
      const topbar = document.querySelector('.top-bar');
      if (topbar) {
        topbar.style.display = 'flex';
      }
      document.body.style.overflow = 'auto';
    };
  }, []);

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
    const params = new URLSearchParams(location.search);
    const ssoCode = params.get('sso_code');
    if (!ssoCode) return;

    if (ssoExchangeGuardRef.current.code === ssoCode) return;
    ssoExchangeGuardRef.current.code = ssoCode;

    const redirectParam = params.get('redirect') || '/dashboard';
    const safeRedirect = typeof redirectParam === 'string' && redirectParam.startsWith('/') ? redirectParam : '/dashboard';

    const exchange = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.post(
          `${getBackendUrl()}/api/auth/sso/exchange`,
          { code: ssoCode },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const user = res.data?.user;
        const accessToken = res.data?.access_token;
        if (!user?.username || !accessToken) {
          throw new Error('Invalid SSO exchange response');
        }

        localStorage.setItem('username', user.username);
        localStorage.setItem('token', accessToken);

        if (res.data.refresh_token) {
          localStorage.setItem('refreshToken', res.data.refresh_token);
        }

        const userStatus = user.accountStatus || 'active';
        localStorage.setItem('userStatus', userStatus);

        const userRole = user.role_name || user.role || 'free_user';
        localStorage.setItem('userRole', userRole);

        sessionStorage.removeItem('photoReminderDismissed');
        sessionManager.init();
        socketService.connect(user.username);
        localStorage.removeItem('appTheme');

        window.dispatchEvent(new Event('loginStatusChanged'));
        window.dispatchEvent(new Event('userLoggedIn'));

        navigate(safeRedirect, { replace: true, state: { user } });
      } catch (err) {
        console.error('SSO exchange failed:', err);
        setError('Single sign-on failed. Please log in.');
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    exchange();
  }, [location.search, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Verify CAPTCHA (allow bypass if Cloudflare is having issues after 3 retries)
    if (!captchaToken && !canBypassCaptcha) {
      setError("Please complete the CAPTCHA verification");
      setLoading(false);
      return;
    }
    
    try {
      // Trim whitespace from credentials
      const credentials = {
        username: form.username.trim(),
        password: form.password.trim(),
        captchaToken: captchaToken  // Include CAPTCHA token
      };
      const res = await api.post("/login", credentials);
      
      // Save login credentials to localStorage
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('token', res.data.access_token);
      
      // Save refresh token for session management
      if (res.data.refresh_token) {
        localStorage.setItem('refreshToken', res.data.refresh_token);
      }

      if (enableBiometricOnDevice) {
        try {
          if (res.data.refresh_token) {
            const saveRes = await saveCredential({
              username: res.data.user.username,
              refreshToken: res.data.refresh_token,
            });
            if (saveRes?.ok) {
              setBiometricSaved(true);
              toastService.success('Biometric login enabled on this device', 4000);
            } else if (saveRes?.error) {
              toastService.warning(saveRes.error, 5000);
            }
          } else {
            toastService.warning('Biometric login requires a refresh token. Please log in again.', 6000);
          }
        } catch (_) {
          toastService.warning('Could not enable biometric login on this device.', 6000);
        }
      }
      
      // Save user status for menu access control
      // CRITICAL FIX: Use accountStatus (unified field) instead of legacy status.status
      const userStatus = res.data.user.accountStatus || 'active';
      localStorage.setItem('userStatus', userStatus);
      
      // Save user role for admin access control
      const userRole = res.data.user.role_name || res.data.user.role || 'free_user';
      localStorage.setItem('userRole', userRole);
      console.log('👤 User role saved:', userRole);
      
      // Clear photo reminder dismissal so banner shows fresh each login
      sessionStorage.removeItem('photoReminderDismissed');
      
      // Initialize session manager for activity-based token refresh
      sessionManager.init();
      console.log('🔄 Session manager initialized');
      
      // Connect to WebSocket (automatically marks user as online)
      console.log('🔌 Connecting to WebSocket');
      socketService.connect(res.data.user.username);
      
      // Clear any cached theme from previous user
      localStorage.removeItem('appTheme');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('loginStatusChanged'));
      
      // Dispatch theme reload event
      window.dispatchEvent(new Event('userLoggedIn'));
      
      // Check for MFA warning
      if (res.data.mfa_warning) {
        // Store warning to display on dashboard
        sessionStorage.setItem('mfa_warning', JSON.stringify(res.data.mfa_warning));
      }

      const urlParams = new URLSearchParams(location.search);
      const requestedRedirect = urlParams.get('redirect');
      const safeRequestedRedirect = typeof requestedRedirect === 'string' && requestedRedirect.startsWith('/')
        ? requestedRedirect
        : null;
      
      // Check for unattended chats before redirecting
      let redirectPath = '/dashboard';
      try {
        console.log('🔍 Checking for unattended chats...');
        const unattendedRes = await api.get('/messages/unattended');
        const unattendedData = unattendedRes.data;
        console.log('📬 Unattended chats response:', unattendedData);
        
        // Check for critical (blocking) or warning messages
        const hasWarnings = (unattendedData.warningCount || 0) > 0;
        const hasCritical = (unattendedData.criticalCount || 0) > 0;
        
        if (hasCritical) {
          // Critical messages (10+ days) - redirect to messages, blocks navigation
          console.log(`🔴 ${unattendedData.criticalCount} critical chats found, redirecting to messages`);
          redirectPath = '/messages';
          sessionStorage.setItem('unattendedChatsAlert', JSON.stringify({
            count: unattendedData.criticalCount,
            critical: unattendedData.criticalCount,
            warning: unattendedData.warningCount || 0
          }));
        } else if (hasWarnings) {
          // Warning messages (1-9 days) - show toast but don't force redirect
          console.log(`💬 ${unattendedData.warningCount} warning chats found, showing notification`);
          sessionStorage.setItem('pendingMessagesWarning', JSON.stringify({
            count: unattendedData.warningCount,
            high: unattendedData.highCount || 0,
            medium: unattendedData.mediumCount || 0,
            pending: unattendedData.pendingCount || 0
          }));
          if (safeRequestedRedirect) {
            redirectPath = safeRequestedRedirect;
          } else {
            // Continue to user's preferred home page
            const homePage = res.data.user.homePage || 'dashboard';
            localStorage.setItem('homePage', homePage);
            const homeRoutes = {
              'dashboard': '/dashboard',
              'search': '/search',
              'messages': '/messages'
            };
            redirectPath = homeRoutes[homePage] || '/dashboard';
          }
        } else {
          if (safeRequestedRedirect) {
            redirectPath = safeRequestedRedirect;
          } else {
            // Redirect to user's preferred home page (default: dashboard)
            const homePage = res.data.user.homePage || 'dashboard';
            localStorage.setItem('homePage', homePage);
            const homeRoutes = {
              'dashboard': '/dashboard',
              'search': '/search',
              'messages': '/messages'
            };
            redirectPath = homeRoutes[homePage] || '/dashboard';
          }
        }
      } catch (unattendedErr) {
        console.warn('Could not check unattended chats:', unattendedErr);
        if (safeRequestedRedirect) {
          redirectPath = safeRequestedRedirect;
        } else {
          // Fall back to user's preferred home page
          const homePage = res.data.user.homePage || 'dashboard';
          localStorage.setItem('homePage', homePage);
          const homeRoutes = {
            'dashboard': '/dashboard',
            'search': '/search',
            'messages': '/messages'
          };
          redirectPath = homeRoutes[homePage] || '/dashboard';
        }
      }
      
      navigate(redirectPath, { state: { user: res.data.user } });
    } catch (err) {
      console.error("Login error:", err);
      
      // Reset CAPTCHA on error
      if (turnstileRef.current) {
        turnstileRef.current.reset();
        setCaptchaToken(null);
      }
      
      // Check if MFA is required
      if (err.response?.status === 403 && err.response?.data?.detail === "MFA_REQUIRED") {
        setMfaRequired(true);
        setMfaChannel(err.response.data.mfa_channel || "email");
        setContactMasked(err.response.data.contact_masked || "");
        setError("");
        
        // Send MFA code automatically
        try {
          await sendMfaCode();
        } catch (mfaErr) {
          console.error("Failed to send MFA code:", mfaErr);
          // Error message is already set by sendMfaCode function
        }
      } else {
        setError(err.response?.data?.detail || err.response?.data?.error || "Invalid credentials");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaChange = (token) => {
    console.log("CAPTCHA verified:", token ? "✓" : "✗");
    setCaptchaToken(token);
    setCaptchaError(false);
    setCaptchaLoaded(true);
    setError(""); // Clear error when CAPTCHA is completed
  };

  const handleCaptchaError = () => {
    console.error("CAPTCHA error - Cloudflare Turnstile failed to load");
    setCaptchaError(true);
    setCaptchaRetryCount(prev => prev + 1);
    setCaptchaToken(null);
    setCaptchaLoaded(false);
  };

  const handleCaptchaExpire = () => {
    console.log("CAPTCHA expired - resetting");
    setCaptchaToken(null);
  };

  const retryCaptcha = () => {
    setCaptchaError(false);
    setCaptchaLoaded(false);
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  useEffect(() => {
    if (mfaRequired || captchaLoaded || captchaError || captchaToken) return;
    const timer = setTimeout(() => {
      setCaptchaError(true);
      setCaptchaRetryCount(prev => prev + 1);
    }, 12000);
    return () => clearTimeout(timer);
  }, [mfaRequired, captchaLoaded, captchaError, captchaToken]);

  // Allow bypass after 3 failed captcha attempts (Cloudflare issues)
  const canBypassCaptcha = captchaRetryCount >= 3;

  const sendMfaCode = async () => {
    try {
      setResendingCode(true);
      // Use axios directly to avoid double-prefixing
      const response = await axios.post(
        `${getBackendUrl()}/api/auth/mfa/send-code`,
        { username: form.username.trim() }
      );
      
      if (response.data.mock_code) {
        setError(`DEV MODE: Use code ${response.data.mock_code}`);
      }
    } catch (err) {
      console.error("Error sending MFA code:", err);
      // Show the actual backend error message
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || "Failed to send verification code";
      setError(errorMessage);
    } finally {
      setResendingCode(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // Login with MFA code - use the same /login endpoint with mfa_code
      const credentials = {
        username: form.username.trim(),
        password: form.password.trim(),
        mfa_code: mfaCode.trim(),
        captchaToken: captchaToken
      };
      const res = await api.post("/login", credentials);
      
      // Save login credentials
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('token', res.data.access_token);
      
      // Save refresh token for session management
      if (res.data.refresh_token) {
        localStorage.setItem('refreshToken', res.data.refresh_token);
      }

      if (enableBiometricOnDevice) {
        try {
          if (res.data.refresh_token) {
            const saveRes = await saveCredential({
              username: res.data.user.username,
              refreshToken: res.data.refresh_token,
            });
            if (saveRes?.ok) {
              setBiometricSaved(true);
              toastService.success('Biometric login enabled on this device', 4000);
            } else if (saveRes?.error) {
              toastService.warning(saveRes.error, 5000);
            }
          } else {
            toastService.warning('Biometric login requires a refresh token. Please log in again.', 6000);
          }
        } catch (_) {
          toastService.warning('Could not enable biometric login on this device.', 6000);
        }
      }
      
      // Initialize session manager
      sessionManager.init();
      console.log('🔄 Session manager initialized (MFA)');
      
      // Save user status for menu access control
      // CRITICAL FIX: Use accountStatus (unified field) instead of legacy status.status
      const userStatus = res.data.user.accountStatus || 'active';
      localStorage.setItem('userStatus', userStatus);
      
      // Save user role for admin access control
      const userRole = res.data.user.role_name || 'free_user';
      localStorage.setItem('userRole', userRole);
      console.log('👤 User role saved:', userRole);
      
      // Connect to WebSocket
      console.log('🔌 Connecting to WebSocket');
      socketService.connect(res.data.user.username);
      
      // Clear any cached theme from previous user
      localStorage.removeItem('appTheme');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('loginStatusChanged'));
      window.dispatchEvent(new Event('userLoggedIn'));
      
      navigate('/dashboard', { state: { user: res.data.user } });
    } catch (err) {
      console.error("MFA verification error:", err);
      setError(err.response?.data?.detail || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaCode("");
    setError("");
    setShowBackupCodeInput(false);
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectParam = new URLSearchParams(location.search).get('redirect') || '/dashboard';
      const safeRedirect = typeof redirectParam === 'string' && redirectParam.startsWith('/') ? redirectParam : '/dashboard';

      const res = await biometricLogin();
      if (!res?.ok) {
        setError(res?.error || 'Biometric login failed.');
        return;
      }

      const user = res.user || {};
      const username = user.username || res.username;
      if (!username) {
        setError('Biometric login failed. Please log in with password.');
        return;
      }

      localStorage.setItem('username', username);
      localStorage.setItem('token', res.accessToken);
      if (res.refreshToken) {
        localStorage.setItem('refreshToken', res.refreshToken);
      }

      const userStatus = user.accountStatus || 'active';
      localStorage.setItem('userStatus', userStatus);

      const userRole = user.role_name || user.role || 'free_user';
      localStorage.setItem('userRole', userRole);

      sessionStorage.removeItem('photoReminderDismissed');
      sessionManager.init();
      socketService.connect(username);
      localStorage.removeItem('appTheme');

      window.dispatchEvent(new Event('loginStatusChanged'));
      window.dispatchEvent(new Event('userLoggedIn'));

      navigate(safeRedirect, { replace: true, state: { user } });
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
      toastService.info('Biometric login removed from this device', 4000);
    } catch (_) {
      toastService.warning('Could not remove biometric login from this device.', 5000);
    }
  };

  return (
    <>
      <SEO
        title={pageSEO.title}
        description={pageSEO.description}
        keywords={pageSEO.keywords}
        url={pageSEO.url}
        noindex={pageSEO.noindex}
      />
    <div className="login-page-wrapper" style={{
      background: `
        linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
        url('/images/wedding-bg.jpg') center/cover no-repeat fixed
      `
    }}>
      {/* Dark overlay for better readability */}
      <div className="login-page-overlay"></div>
      
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">🦋</div>
          <div className="login-brand">L3V3L</div>
        </div>
        <h2 className="login-title">{mfaRequired ? 'Verification Required' : 'Welcome Back!'}</h2>
        <p className="login-subtitle">{mfaRequired ? `Enter the code sent to your ${mfaChannel}` : 'Sign in to continue to your account'}</p>
      {error && <div className="alert alert-danger">{error}</div>}
      
      {!mfaRequired ? (
        /* Regular Login Form */
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="login-form-label">Username</label>
            <div className="login-input-wrapper">
              {!form.username && (
                <span className="login-input-icon">👤</span>
              )}
              <input
                type="text"
                name="username"
                className="login-input"
                value={form.username}
                onChange={handleChange}
                required
                placeholder="Enter your username"
              />
            </div>
          </div>
          
          <div className="mb-3">
            <label className="login-form-label">Password</label>
            <div className="login-input-wrapper">
              {!form.password && (
                <span className="login-input-icon">🔒</span>
              )}
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="login-input"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-password-toggle"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <Link to="/forgot-password" className="login-forgot-link">Forgot Password?</Link>
          </div>
          
          {/* Cloudflare Turnstile CAPTCHA with error handling */}
          <div className="login-captcha-container">
            {captchaError ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'center',
                width: '100%',
                maxWidth: '300px'
              }}>
                <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 8px 0' }}>
                  ⚠️ Security check unavailable
                </p>
                {captchaRetryCount < 3 ? (
                  <button
                    type="button"
                    onClick={retryCaptcha}
                    style={{
                      background: 'transparent',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      padding: '6px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Retry ({3 - captchaRetryCount} attempts left)
                  </button>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>
                    ✓ Cloudflare issue detected - proceeding without captcha
                  </p>
                )}
              </div>
            ) : (
              <Turnstile
                ref={turnstileRef}
                sitekey={getTurnstileSiteKey()}
                onVerify={handleCaptchaChange}
                onLoad={() => setCaptchaLoaded(true)}
                onError={handleCaptchaError}
                onExpire={handleCaptchaExpire}
                theme="light"
              />
            )}
          </div>

          {biometricSupported && (
            <div className="login-biometric-row">
              <label className="login-biometric-toggle">
                <input
                  type="checkbox"
                  checked={enableBiometricOnDevice}
                  onChange={(e) => setEnableBiometricOnDevice(e.target.checked)}
                />
                Enable biometric login on this device
              </label>
            </div>
          )}

          {biometricSupported && biometricSaved && (
            <button
              type="button"
              className="login-button login-biometric-btn"
              onClick={handleBiometricLogin}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In with Biometrics'}
            </button>
          )}

          {biometricSupported && biometricSaved && (
            <button
              type="button"
              className="login-biometric-clear"
              onClick={handleClearBiometric}
              disabled={loading}
            >
              Remove biometric login from this device
            </button>
          )}
          
          <button 
            type="submit" 
            disabled={loading || (!captchaToken && !canBypassCaptcha)}
            className="login-button"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
      </form>
      ) : (
        /* MFA Verification Form */
        <form onSubmit={handleMfaVerify}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '14px', color: '#374151', margin: '0' }}>
              🔒 Code sent to: <strong>{contactMasked}</strong>
            </p>
          </div>

          <div className="mb-3">
            <label className="form-label" style={{
              fontWeight: '500',
              fontSize: '14px',
              color: '#374151',
              marginBottom: '8px',
              display: 'block',
              textAlign: 'center'
            }}>
              {showBackupCodeInput ? 'Backup Code (XXXX-XXXX)' : 'Verification Code'}
            </label>
            <input
              type="text"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(showBackupCodeInput ? '' : /\D/g, ''))}
              placeholder={showBackupCodeInput ? "XXXX-XXXX" : "000000"}
              maxLength={showBackupCodeInput ? 9 : 6}
              style={{
                width: '100%',
                padding: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: showBackupCodeInput ? '18px' : '32px',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: showBackupCodeInput ? '0.2em' : '0.5em',
                fontFamily: 'monospace',
                backgroundColor: '#f9fafb',
                color: '#1f2937',
                fontWeight: '600'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
              autoFocus
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || (!showBackupCodeInput && mfaCode.length !== 6) || (showBackupCodeInput && mfaCode.length !== 9)}
            style={{
              width: '100%',
              minHeight: '52px',
              fontSize: '16px',
              fontWeight: '600',
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
              marginBottom: '12px'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)')}
            onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)')}
          >
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button 
              type="button"
              onClick={sendMfaCode}
              disabled={resendingCode}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: '12px',
                cursor: resendingCode ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {resendingCode ? 'Sending...' : 'Resend Code'}
            </button>
            <button 
              type="button"
              onClick={() => setShowBackupCodeInput(!showBackupCodeInput)}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                color: '#6b7280',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {showBackupCodeInput ? 'Use Code' : 'Use Backup'}
            </button>
          </div>

          <button 
            type="button"
            onClick={handleBackToLogin}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              color: '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline'
            }}
          >
            ← Back to Login
          </button>
        </form>
      )}
      
      {!mfaRequired && (
        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '0' }}>
            Don't have an account?{' '}
            <Link to="/register-interest" style={{
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >Register</Link>
          </p>
        </div>
      )}
      </div>
    </div>
    </>
  );
};

export default Login;
