import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './PaymentResult.css';

/**
 * Handles return from Clover Hosted Checkout.
 * - /contribution/clover-success  → confirms payment on backend
 * - /contribution/clover-failure  → shows failure message
 */
const CloverPaymentReturn = ({ status = 'success' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [confirming, setConfirming] = useState(status === 'success');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status !== 'success') return;

    const confirmPayment = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to confirm your payment.');
          setConfirming(false);
          return;
        }

        const response = await fetch(`${getBackendUrl()}/api/clover/confirm-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (data.success) {
          setConfirmed(true);
          localStorage.setItem('contribution_popup_last_shown', Date.now().toString());
          if (toastService) {
            toastService.success('Thank you for your contribution! 💜');
          }
        } else {
          setError(data.detail || 'Could not confirm payment. Please contact support.');
        }
      } catch (err) {
        setError('Failed to confirm payment. Please contact support.');
      } finally {
        setConfirming(false);
      }
    };

    confirmPayment();
  }, [status, location]);

  // Success state
  if (status === 'success') {
    return (
      <div className="payment-result-container">
        <div className={`payment-result-card ${confirmed ? 'success' : confirming ? '' : 'cancel'}`}>
          {confirming ? (
            <>
              <div className="result-icon" style={{ fontSize: '48px' }}>⏳</div>
              <h1>Confirming Payment...</h1>
              <p className="result-message">Please wait while we verify your Clover payment.</p>
            </>
          ) : confirmed ? (
            <>
              <div className="result-icon success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1>Thank You! 💜</h1>
              <p className="result-message">
                Your contribution has been received. We truly appreciate your support!
              </p>
              <div className="result-actions">
                <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </button>
                <button className="btn-secondary" onClick={() => navigate('/search')}>
                  Continue Browsing
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="result-icon cancel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                </svg>
              </div>
              <h1>Payment Issue</h1>
              <p className="result-message">{error}</p>
              <div className="result-actions">
                <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Failure state
  return (
    <div className="payment-result-container">
      <div className="payment-result-card cancel">
        <div className="result-icon cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
          </svg>
        </div>
        <h1>Payment Failed</h1>
        <p className="result-message">
          Your payment could not be completed. No charges were made. You can try again anytime.
        </p>
        <div className="result-actions">
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
          <button className="btn-secondary" onClick={() => navigate('/search')}>
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloverPaymentReturn;
