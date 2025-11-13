import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import SEO from './SEO';

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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
          url('/images/wedding-bg.jpg') center/cover no-repeat fixed
        `,
        padding: '20px'
      }}>
        <div className="login-container" style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '16px' 
          }}>
            <div style={{ fontSize: '48px', lineHeight: '1' }}>🔐</div>
            <h2 style={{ 
              color: '#1a1a1a',
              fontWeight: '700',
              fontSize: '28px',
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              {step === 'request' && 'Forgot Password'}
              {step === 'verify' && 'Verify Code'}
              {step === 'reset' && 'Reset Password'}
              {step === 'success' && 'Password Reset!'}
            </h2>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset}>
              <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center' }}>
                Enter your username or email address and we'll send you a reset code.
              </p>
              <div className="mb-4">
                <label className="form-label">Username or Email</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '15px'
                  }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyCode}>
              <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center' }}>
                Enter the 6-digit code sent to your email/phone.
              </p>
              <div className="mb-4">
                <label className="form-label">Verification Code</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  maxLength="6"
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '32px',
                    textAlign: 'center',
                    letterSpacing: '0.5em',
                    fontFamily: 'monospace'
                  }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || resetCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: (loading || resetCode.length !== 6) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center' }}>
                Enter your new password.
              </p>
              <div className="mb-4">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{
                      width: '100%',
                      padding: '14px 50px 14px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '15px'
                    }}
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
                      fontSize: '18px'
                    }}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="form-label">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '15px'
                  }}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                Your password has been reset successfully!
              </p>
              <button 
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Back to Login
              </button>
            </div>
          )}

          {step !== 'success' && (
            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <Link 
                to="/login" 
                style={{
                  color: '#667eea',
                  fontSize: '14px',
                  textDecoration: 'none'
                }}
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
