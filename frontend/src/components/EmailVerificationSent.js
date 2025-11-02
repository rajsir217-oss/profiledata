import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './EmailVerificationSent.css';

const EmailVerificationSent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // Get email and username from navigation state
    const stateEmail = location.state?.email || '';
    const stateUsername = location.state?.username || '';
    
    setEmail(stateEmail);
    setUsername(stateUsername);

    // If no email provided, redirect to register
    if (!stateEmail) {
      navigate('/register2');
    }
  }, [location, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !username) return;

    setIsResending(true);
    setResendStatus('');

    try {
      const response = await axios.post(
        `${getBackendUrl()}/api/verification/resend-verification`,
        { username }
      );

      if (response.data.success) {
        setResendStatus('success');
        setResendCooldown(60); // 60 second cooldown
      } else {
        setResendStatus('error');
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      setResendStatus('error');
    } finally {
      setIsResending(false);
      // Clear status message after 3 seconds
      setTimeout(() => setResendStatus(''), 3000);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const maskEmail = (emailAddress) => {
    if (!emailAddress || !emailAddress.includes('@')) return emailAddress;
    const [localPart, domain] = emailAddress.split('@');
    const maskedLocal = localPart.length > 2 
      ? `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`
      : localPart;
    return `${maskedLocal}@${domain}`;
  };

  return (
    <div className="email-verification-container">
      <div className="email-verification-card">
        {/* Success Animation */}
        <div className="success-animation">
          <div className="checkmark-circle">
            <div className="checkmark-icon">✓</div>
          </div>
        </div>

        {/* Header */}
        <h1 className="verification-title">Check Your Email</h1>
        <p className="verification-subtitle">
          We've sent a verification link to
        </p>
        <p className="email-display">{maskEmail(email)}</p>

        {/* Instructions */}
        <div className="verification-instructions">
          <div className="instruction-item">
            <span className="instruction-icon">📧</span>
            <span className="instruction-text">
              Click the link in the email to verify your account
            </span>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">📂</span>
            <span className="instruction-text">
              Check your spam folder if you don't see it
            </span>
          </div>
          <div className="instruction-item">
            <span className="instruction-icon">⏱️</span>
            <span className="instruction-text">
              The link expires in 24 hours
            </span>
          </div>
        </div>

        {/* Resend Status Messages */}
        {resendStatus === 'success' && (
          <div className="alert alert-success">
            ✅ Verification email resent successfully!
          </div>
        )}
        {resendStatus === 'error' && (
          <div className="alert alert-error">
            ❌ Failed to resend email. Please try again later.
          </div>
        )}

        {/* Action Buttons */}
        <div className="verification-actions">
          <button
            className="btn-resend"
            onClick={handleResendEmail}
            disabled={resendCooldown > 0 || isResending}
          >
            {isResending ? (
              <>
                <span className="spinner-small"></span> Sending...
              </>
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              '🔄 Resend Email'
            )}
          </button>
          
          <button
            className="btn-login"
            onClick={handleGoToLogin}
          >
            Already Verified? Login
          </button>
        </div>

        {/* Help Text */}
        <div className="help-text">
          <p>
            Need help? Contact support at{' '}
            <a href="mailto:support@l3v3l.com">support@l3v3l.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationSent;
