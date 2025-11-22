import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import SEO from './SEO';
import './Login.css'; // Reuse Login styles

const ForgotPassword = () => {
  const [step, setStep] = useState('request'); // 'request', 'verify', 'reset', 'success'
  const [identifier, setIdentifier] = useState(''); // username or email
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Hide topbar and remove body padding on forgot password page
  useEffect(() => {
    const topbar = document.querySelector('.top-bar');
    if (topbar) {
      topbar.style.display = 'none';
    }
    
    // Remove any body padding/margin
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    
    // Show topbar and restore body styles when leaving page
    return () => {
      const topbar = document.querySelector('.top-bar');
      if (topbar) {
        topbar.style.display = 'flex';
      }
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('📧 Requesting reset for identifier:', identifier.trim());

    try {
      const response = await api.post('/auth/request-password-reset', {
        identifier: identifier.trim()
      });
      console.log('✅ Reset code sent:', response.data);
      setStep('verify');
    } catch (err) {
      console.error('❌ Request reset error:', err.response?.data);
      setError(err.response?.data?.detail || 'Failed to send reset code. Please check your username/email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🔍 Verifying code with identifier:', identifier.trim());
    console.log('🔑 Code:', resetCode.trim());

    try {
      await api.post('/auth/verify-reset-code', {
        identifier: identifier.trim(),
        code: resetCode.trim()
      });
      setStep('reset');
    } catch (err) {
      console.error('❌ Verify code error:', err.response?.data);
      setError(err.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/reset-password', {
        identifier: identifier.trim(),
        code: resetCode.trim(),
        new_password: newPassword
      });
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Forgot Password - L3V3L Matches"
        description="Reset your password"
      />
      <div className="login-page-wrapper" style={{
        background: `
          linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
          url('/images/wedding-bg.jpg') center/cover no-repeat fixed
        `
      }}>
        <div className="login-page-overlay"></div>
        
        <div className="login-container">
          <div className="login-header">
            <div className="login-logo">🔐</div>
            <div className="login-brand">L3V3L</div>
          </div>
          <h2 className="login-title">
            {step === 'request' && 'Forgot Password'}
            {step === 'verify' && 'Verify Code'}
            {step === 'reset' && 'Reset Password'}
            {step === 'success' && 'Password Reset!'}
          </h2>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset}>
              <p className="login-subtitle">
                Enter your username or email address and we'll send you a reset code.
              </p>
              <div className="mb-4">
                <label className="login-form-label">Username or Email</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="login-input"
                  style={{ paddingLeft: '16px' }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="login-button"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyCode}>
              <p className="login-subtitle">
                Enter the 6-digit code sent to your email/phone.
              </p>
              <div className="mb-4">
                <label className="login-form-label">Verification Code</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  maxLength="6"
                  className="login-mfa-code-input"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || resetCode.length !== 6}
                className="login-button"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <p className="login-subtitle">
                Enter your new password.
              </p>
              <div className="mb-4">
                <label className="login-form-label">New Password</label>
                <div className="login-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="login-input"
                    style={{ paddingLeft: '16px', paddingRight: '50px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-password-toggle"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="login-form-label">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="login-input"
                  style={{ paddingLeft: '16px' }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="login-button"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
              <p className="login-subtitle">
                Your password has been reset successfully!
              </p>
              <button 
                onClick={() => navigate('/login')}
                className="login-button"
              >
                Back to Login
              </button>
            </div>
          )}

          {step !== 'success' && (
            <div className="login-divider">
              <Link 
                to="/login" 
                className="login-register-link"
              >
                ← Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
