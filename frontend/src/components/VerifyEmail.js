import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createApiInstance } from '../api';
import Logo from './Logo';
import './VerifyEmail.css';

// Use global API factory for session handling
const verificationApi = createApiInstance();

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isResending, setIsResending] = useState(false);

  const verifyEmail = useCallback(async (user, token) => {
    try {
      setStatus('verifying');
      const response = await verificationApi.post('/api/verification/verify-email', {
        username: user,
        token: token
      });

      if (response.data.success) {
        if (response.data.alreadyVerified) {
          setStatus('success');
          setMessage('✅ Email already verified! You can now login.');
        } else {
          setStatus('success');
          setMessage(response.data.message || '✅ Email verified successfully!');
        }
        
        // Redirect to login after 5 seconds
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } else {
        if (response.data.expired || response.data.tokenNotFound) {
          setStatus('expired');
          setMessage(response.data.message || 'Verification link has expired or was already used.');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed.');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'An error occurred during verification. Please try again.'
      );
    }
  }, [navigate]);

  useEffect(() => {
    const token = searchParams.get('token');
    const user = searchParams.get('username');

    if (!token || !user) {
      setStatus('error');
      setMessage('Invalid verification link. Missing token or username.');
      return;
    }

    setUsername(user);
    verifyEmail(user, token);
  }, [searchParams, verifyEmail]);

  const handleResend = async () => {
    if (!username) {
      setMessage('❌ Username not found. Please register again.');
      return;
    }

    try {
      setIsResending(true);
      const response = await verificationApi.post('/api/verification/resend-verification', {
        username: username
      });

      if (response.data.success) {
        setStatus('success');
        setMessage('📧 Verification email sent! Please check your inbox.');
      } else {
        setMessage(response.data.message || '❌ Failed to resend email.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setMessage(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        '❌ Failed to resend verification email.'
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        <div className="verify-email-header">
          <Logo variant="modern" size="medium" showText={true} theme="light" />
        </div>

        <div className="verify-email-content">
          {status === 'verifying' && (
            <div className="verify-status verify-loading">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h3>Verifying Your Email...</h3>
              <p className="text-muted">Please wait while we verify your email address.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="verify-status verify-success">
              <div className="success-icon mb-3">✅</div>
              <h3>Email Verified!</h3>
              <p className="lead">{message}</p>
              <div className="alert alert-info mt-3">
                <strong>🎯 What's Next?</strong>
                <ol className="text-start mt-2 mb-0">
                  <li>Admin will review your profile (usually within 24 hours)</li>
                  <li>You'll receive an email once approved</li>
                  <li>Then you can access all features!</li>
                </ol>
              </div>
              <p className="text-muted mt-3">
                Redirecting to login page in 5 seconds...
              </p>
              <button 
                className="btn btn-primary mt-2" 
                onClick={() => navigate('/login')}
              >
                Go to Login Now
              </button>
            </div>
          )}

          {status === 'expired' && (
            <div className="verify-status verify-expired">
              <div className="warning-icon mb-3">⏰</div>
              <h3>Link Expired</h3>
              <p className="lead">{message}</p>
              <p>Verification links expire after 24 hours for security reasons.</p>
              <button 
                className="btn btn-warning mt-3" 
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Sending...
                  </>
                ) : (
                  '📧 Resend Verification Email'
                )}
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="verify-status verify-error">
              <div className="error-icon mb-3">❌</div>
              <h3>Verification Failed</h3>
              <p className="lead">{message}</p>
              <div className="mt-3">
                <button 
                  className="btn btn-warning me-2" 
                  onClick={handleResend}
                  disabled={isResending || !username}
                >
                  {isResending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Sending...
                    </>
                  ) : (
                    '📧 Resend Verification Email'
                  )}
                </button>
                <button 
                  className="btn btn-outline-secondary" 
                  onClick={() => navigate('/register2')}
                >
                  Back to Registration
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="verify-email-footer">
          <p className="text-muted mb-0">
            Need help? <a href="/support">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
