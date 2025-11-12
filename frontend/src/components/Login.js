// frontend/src/components/Login.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import api from "../api";
import socketService from "../services/socketService";
import { getBackendUrl } from "../config/apiConfig";
import SEO from "./SEO";
import { getPageSEO } from "../utils/seo";
import ReCAPTCHA from "react-google-recaptcha";

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef();
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
      
      // Save user status for menu access control
      const userStatus = res.data.user.status?.status || res.data.user.status || 'active';
      localStorage.setItem('userStatus', userStatus);
      
      // Save user role for admin access control
      const userRole = res.data.user.role_name || 'free_user';
      localStorage.setItem('userRole', userRole);
      console.log('👤 User role saved:', userRole);
      
      // Connect to WebSocket (automatically marks user as online)
      console.log('🔌 Connecting to WebSocket');
      socketService.connect(res.data.user.username);
      
      // Clear any cached theme from previous user
      localStorage.removeItem('appTheme');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('loginStatusChanged'));
      
      // Dispatch theme reload event
      window.dispatchEvent(new Event('userLoggedIn'));
      
      navigate('/dashboard', { state: { user: res.data.user } });
    } catch (err) {
      console.error("Login error:", err);
      
      // Reset CAPTCHA on error
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
      
      // Check if MFA is required
      if (err.response?.status === 403 && err.response?.data?.detail === "MFA_REQUIRED") {
        setMfaRequired(true);
        setMfaChannel(err.response.data.mfa_channel || "email");
        setContactMasked(err.response.data.contact_masked || "");
        setError("");
        
        // Send MFA code automatically
        await sendMfaCode();
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
      setError("Failed to send verification code");
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
        password: form.password.trim(),
        mfa_code: mfaCode.trim()
      };
      const res = await api.post("/login", credentials);
      
      // Save login credentials to localStorage
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('token', res.data.access_token);
      
      // Save user status for menu access control
      const userStatus = res.data.user.status?.status || res.data.user.status || 'active';
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
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
        url('/images/wedding-bg.jpg') center/cover no-repeat fixed
      `,
      padding: '20px',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto'
    }}>
      {/* Dark overlay for better readability */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 0
      }}></div>
      
      <div className="login-container" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '24px',
        padding: '48px 40px',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '48px', lineHeight: '1' }}>🦋</div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ec4899 0%, #a78bfa 50%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '2px',
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
          }}>
            L3V3L
          </div>
        </div>
        <h2 className="text-center" style={{ 
          color: '#1a1a1a',
          fontWeight: '700',
          fontSize: '28px',
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>{mfaRequired ? 'Verification Required' : 'Welcome Back!'}</h2>
        <p className="text-center" style={{
          color: '#6b7280',
          fontSize: '15px',
          marginBottom: '32px'
        }}>{mfaRequired ? `Enter the code sent to your ${mfaChannel}` : 'Sign in to continue to your account'}</p>
      {error && <div className="alert alert-danger">{error}</div>}
      
      {!mfaRequired ? (
        /* Regular Login Form */
        <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="form-label" style={{
            fontWeight: '500',
            fontSize: '14px',
            color: '#374151',
            marginBottom: '8px',
            display: 'block'
          }}>Username</label>
          <div style={{ position: 'relative' }}>
            {!form.username && (
              <span style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: '#9ca3af',
                pointerEvents: 'none'
              }}>👤</span>
            )}
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                minHeight: '52px',
                backgroundColor: '#f9fafb',
                color: '#1f2937'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label" style={{
            fontWeight: '500',
            fontSize: '14px',
            color: '#374151',
            marginBottom: '8px',
            display: 'block'
          }}>Password</label>
          <div style={{ position: 'relative' }}>
            {!form.password && (
              <span style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: '#9ca3af',
                pointerEvents: 'none'
              }}>🔒</span>
            )}
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '14px 50px 14px 48px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                minHeight: '52px',
                backgroundColor: '#f9fafb',
                color: '#1f2937',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                borderRadius: '6px',
                zIndex: 10
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        
        {/* Forgot Password Link */}
        <div style={{ textAlign: 'right', marginBottom: '16px' }}>
          <Link 
            to="/forgot-password" 
            style={{
              color: '#667eea',
              fontSize: '14px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            Forgot Username or Password?
          </Link>
        </div>

        {/* Google reCAPTCHA */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '20px'
        }}>
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"  // Test key - replace with your actual key
            onChange={handleCaptchaChange}
            theme="light"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !captchaToken}
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
            marginTop: '8px'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)')}
          onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)')}
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

          <div className="mb-4">
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
