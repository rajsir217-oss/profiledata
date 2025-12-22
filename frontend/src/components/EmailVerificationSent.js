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
  
  // SMS verification state
  const [showSmsOption, setShowSmsOption] = useState(false);
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [phoneMasked, setPhoneMasked] = useState('');
  const [smsMode, setSmsMode] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsStatus, setSmsStatus] = useState('');
  const [smsCooldown, setSmsCooldown] = useState(0);

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
    
    // Check if SMS verification is available
    if (stateUsername) {
      checkSmsAvailability(stateUsername);
    }
  }, [location, navigate]);
  
  // Check if SMS verification is available for this user
  const checkSmsAvailability = async (user) => {
    try {
      const response = await axios.get(
        `${getBackendUrl()}/api/verification/sms/availability/${user}`
      );
      if (response.data.available) {
        setSmsAvailable(true);
        setPhoneMasked(response.data.phone_masked);
        setShowSmsOption(true);
      }
    } catch (error) {
      console.log('SMS verification not available:', error.response?.data?.reason || error.message);
    }
  };

  // Cooldown timer for email
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);
  
  // Cooldown timer for SMS
  useEffect(() => {
    if (smsCooldown > 0) {
      const timer = setTimeout(() => {
        setSmsCooldown(smsCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [smsCooldown]);

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
  
  // SMS verification handlers
  const handleSendSmsCode = async () => {
    if (smsCooldown > 0 || !username) return;
    
    setSmsSending(true);
    setSmsStatus('');
    
    try {
      const response = await axios.post(
        `${getBackendUrl()}/api/verification/sms/send`,
        { username }
      );
      
      if (response.data.success) {
        setSmsStatus('sent');
        setSmsCooldown(60);
        setSmsMode(true);
      } else {
        setSmsStatus('error');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      setSmsStatus('error');
    } finally {
      setSmsSending(false);
    }
  };
  
  const handleVerifySmsCode = async () => {
    if (!smsCode || smsCode.length !== 6 || !username) return;
    
    setSmsVerifying(true);
    setSmsStatus('');
    
    try {
      const response = await axios.post(
        `${getBackendUrl()}/api/verification/sms/verify`,
        { username, code: smsCode }
      );
      
      if (response.data.success) {
        setSmsStatus('verified');
        // Redirect to pending approval page or login after 2 seconds
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Phone verified! Your account is pending admin approval.',
              username 
            } 
          });
        }, 2000);
      } else {
        setSmsStatus('invalid');
      }
    } catch (error) {
      console.error('Error verifying SMS code:', error);
      setSmsStatus('invalid');
    } finally {
      setSmsVerifying(false);
    }
  };
  
  const handleSmsCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setSmsCode(value);
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

        {/* SMS Verification Option */}
        {showSmsOption && smsAvailable && !smsMode && (
          <div className="sms-option-section">
            <div className="divider">
              <span>or</span>
            </div>
            <div className="sms-option">
              <p className="sms-option-text">
                📱 Email delayed? Verify via SMS instead
              </p>
              <p className="sms-phone-display">
                Send code to: {phoneMasked}
              </p>
              <button
                className="btn-sms"
                onClick={handleSendSmsCode}
                disabled={smsSending || smsCooldown > 0}
              >
                {smsSending ? (
                  <>
                    <span className="spinner-small"></span> Sending...
                  </>
                ) : smsCooldown > 0 ? (
                  `Resend in ${smsCooldown}s`
                ) : (
                  '📲 Send SMS Code'
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* SMS Code Entry */}
        {smsMode && (
          <div className="sms-verify-section">
            <div className="divider">
              <span>SMS Verification</span>
            </div>
            
            {smsStatus === 'sent' && (
              <div className="alert alert-success">
                ✅ Code sent to {phoneMasked}
              </div>
            )}
            {smsStatus === 'verified' && (
              <div className="alert alert-success">
                ✅ Phone verified! Redirecting...
              </div>
            )}
            {smsStatus === 'invalid' && (
              <div className="alert alert-error">
                ❌ Invalid code. Please try again.
              </div>
            )}
            {smsStatus === 'error' && (
              <div className="alert alert-error">
                ❌ Failed to send SMS. Please try email verification.
              </div>
            )}
            
            <div className="sms-code-input-group">
              <label>Enter 6-digit code:</label>
              <input
                type="text"
                className="sms-code-input"
                value={smsCode}
                onChange={handleSmsCodeChange}
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>
            
            <div className="sms-actions">
              <button
                className="btn-verify-sms"
                onClick={handleVerifySmsCode}
                disabled={smsVerifying || smsCode.length !== 6}
              >
                {smsVerifying ? (
                  <>
                    <span className="spinner-small"></span> Verifying...
                  </>
                ) : (
                  '✓ Verify Code'
                )}
              </button>
              
              <button
                className="btn-resend-sms"
                onClick={handleSendSmsCode}
                disabled={smsSending || smsCooldown > 0}
              >
                {smsCooldown > 0 ? `Resend in ${smsCooldown}s` : '🔄 Resend Code'}
              </button>
            </div>
            
            <button
              className="btn-back-to-email"
              onClick={() => setSmsMode(false)}
            >
              ← Back to email verification
            </button>
          </div>
        )}

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
