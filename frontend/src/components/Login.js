// frontend/src/components/Login.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import api from "../api";
import socketService from "../services/socketService";
import sessionManager from "../services/sessionManager";
import { getBackendUrl } from "../config/apiConfig";
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
  const turnstileRef = useRef();
  const navigate = useNavigate();
  const pageSEO = getPageSEO('login');

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    // Verify CAPTCHA
    if (!captchaToken) {
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
      
      // Save user status for menu access control
      // CRITICAL FIX: Use accountStatus (unified field) instead of legacy status.status
      const userStatus = res.data.user.accountStatus || 'active';
      localStorage.setItem('userStatus', userStatus);
      
      // Save user role for admin access control
      const userRole = res.data.user.role_name || 'free_user';
      localStorage.setItem('userRole', userRole);
      console.log('👤 User role saved:', userRole);
      
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
      
      navigate('/dashboard', { state: { user: res.data.user } });
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
    setError(""); // Clear error when CAPTCHA is completed
  };

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
      // Login with MFA code
      const credentials = {
        username: form.username.trim(),
        mfa_code: mfaCode.trim(),
        captchaToken: captchaToken
      };
      const res = await api.post("/verify-mfa", credentials);
      
      // Save login credentials
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('token', res.data.access_token);
      
      // Save refresh token for session management
      if (res.data.refresh_token) {
        localStorage.setItem('refreshToken', res.data.refresh_token);
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
          
          {/* Cloudflare Turnstile CAPTCHA (100% Free) */}
          <div className="login-captcha-container">
            <Turnstile
              ref={turnstileRef}
              sitekey={
                window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                  ? "1x00000000000000000000AA"  // Test key for localhost (always passes)
                  : "0x4AAAAAACAeADZnXAaS1tep"   // Production key (6 A's - matches rotated secret key)
              }
              onVerify={handleCaptchaChange}
              theme="light"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || !captchaToken}
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
            <Link to="/register2" style={{
              color: '#667eea',
              textDecoration: 'none',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >Create Account</Link>
          </p>
        </div>
      )}
      </div>
    </div>
    </>
  );
};

export default Login;
