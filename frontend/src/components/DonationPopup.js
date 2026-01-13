import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import './DonationPopup.css';

const DonationPopup = ({ isOpen, onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentType, setPaymentType] = useState('monthly'); // 'one-time' or 'monthly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amounts = [5, 10, 15];

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && !loading) {
        handleSessionDismiss();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, loading]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSessionDismiss = () => {
    // Dismiss for current session only
    sessionStorage.setItem('donation_dismissed', 'true');
    onClose();
  };

  const handleRemindNextWeek = () => {
    // Set reminder for 7 days from now
    const remindAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('donation_remind_at', remindAt.toString());
    localStorage.setItem('donation_popup_last_shown', Date.now().toString());
    onClose();
  };

  const handleProceedToPayment = async () => {
    const amount = selectedAmount === 'custom' ? parseFloat(customAmount) : selectedAmount;
    
    if (!amount || amount < 1) {
      setError('Please enter a valid amount (minimum $1)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/stripe/create-donation-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amount,
          paymentType: paymentType
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Record that popup was shown
        localStorage.setItem('donation_popup_last_shown', Date.now().toString());
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setError(data.detail || 'Failed to create payment session');
      }
    } catch (err) {
      console.error('Donation error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="donation-popup-overlay" onClick={handleSessionDismiss}>
      <div className="donation-popup" onClick={(e) => e.stopPropagation()}>
        <div className="donation-popup-header">
          <h2>
            <span className="donation-icon">🔔</span>
            Please support the platform by generous donation
          </h2>
          <button 
            className="donation-popup-close" 
            onClick={handleSessionDismiss}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="donation-popup-body">
          <p className="donation-message">
            Your support helps us keep the platform ad-free and continuously improving for everyone.
          </p>

          {error && <div className="donation-error">{error}</div>}

          <div className="donation-amounts">
            {amounts.map((amount) => (
              <label 
                key={amount} 
                className={`donation-amount-option ${selectedAmount === amount ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="donationAmount"
                  value={amount}
                  checked={selectedAmount === amount}
                  onChange={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  disabled={loading}
                />
                <span className="donation-amount-label">${amount}</span>
                {amount === 10 && <span className="popular-badge">Popular</span>}
              </label>
            ))}
            
            <label 
              className={`donation-amount-option custom-option ${selectedAmount === 'custom' ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="donationAmount"
                value="custom"
                checked={selectedAmount === 'custom'}
                onChange={() => setSelectedAmount('custom')}
                disabled={loading}
              />
              <span className="donation-amount-label">
                Custom: $
                <input
                  type="number"
                  className="custom-amount-input"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount('custom');
                  }}
                  placeholder="Enter amount"
                  min="1"
                  disabled={loading}
                />
              </span>
            </label>
          </div>

          <div className="payment-type-section">
            <span className="payment-type-label">Payment Type:</span>
            <div className="payment-type-toggle">
              <button
                className={`payment-type-btn ${paymentType === 'one-time' ? 'active' : ''}`}
                onClick={() => setPaymentType('one-time')}
                disabled={loading}
              >
                One-time
              </button>
              <button
                className={`payment-type-btn ${paymentType === 'monthly' ? 'active' : ''}`}
                onClick={() => setPaymentType('monthly')}
                disabled={loading}
              >
                Monthly
              </button>
            </div>
          </div>

          <button 
            className="donation-proceed-btn"
            onClick={handleProceedToPayment}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : (
              <>💜 Proceed to Payment</>
            )}
          </button>

          <button 
            className="donation-remind-btn"
            onClick={handleRemindNextWeek}
            disabled={loading}
          >
            Remind me next week
          </button>
        </div>
      </div>
    </div>
  );
};

export default DonationPopup;
