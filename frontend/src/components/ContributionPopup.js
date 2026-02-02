import React, { useState, useEffect, useRef } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './ContributionPopup.css';

const ContributionPopup = ({ isOpen, onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentType, setPaymentType] = useState('one-time'); // 'one-time' or 'monthly' - default to one-time for PayPal
  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'stripe' or 'paypal' - default to PayPal
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoggedShown, setHasLoggedShown] = useState(false);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef(null);

  const amounts = [5, 10, 15];

  // Log activity to backend (fire and forget)
  const logActivity = async (action, amount = null, pType = null) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${getBackendUrl()}/api/stripe/log-contribution-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          amount,
          paymentType: pType
        })
      });
    } catch (err) {
      // Silent fail - don't disrupt user experience
      console.debug('Activity log failed:', err);
    }
  };

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

  // Prevent body scroll when modal is open & log popup shown
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Log popup shown only once per open
      if (!hasLoggedShown) {
        logActivity('popup_shown');
        setHasLoggedShown(true);
      }
      // Check PayPal config
      checkPayPalConfig();
    } else {
      document.body.style.overflow = 'unset';
      setHasLoggedShown(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, hasLoggedShown]);

  // Check PayPal configuration
  const checkPayPalConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/paypal/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPaypalConfigured(data.configured);
      if (data.configured && data.client_id) {
        setPaypalClientId(data.client_id);
      }
    } catch (err) {
      console.debug('PayPal config check failed:', err);
    }
  };

  // Initialize PayPal when selected and one-time payment
  useEffect(() => {
    if (paymentMethod === 'paypal' && paypalConfigured && paypalClientId && paymentType === 'one-time') {
      initializePayPal();
    }
    return () => {
      if (paypalContainerRef.current) {
        paypalContainerRef.current.innerHTML = '';
      }
      setPaypalReady(false);
    };
  }, [paymentMethod, paypalConfigured, paypalClientId, paymentType, selectedAmount, customAmount]);

  const initializePayPal = async () => {
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD`;
      script.async = true;
      script.onload = () => renderPayPalButtons();
      script.onerror = () => setError('Failed to load PayPal');
      document.body.appendChild(script);
    } else {
      renderPayPalButtons();
    }
  };

  const renderPayPalButtons = () => {
    if (!window.paypal || !paypalContainerRef.current) return;
    
    paypalContainerRef.current.innerHTML = '';
    
    const amount = selectedAmount === 'custom' ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount < 1) return;
    
    const token = localStorage.getItem('token');
    
    try {
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 40
        },
        createOrder: async () => {
          const response = await fetch(`${getBackendUrl()}/api/paypal/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              amount: amount.toFixed(2),
              currency: 'USD',
              plan_id: 'contribution',
              description: `Contribution - $${amount.toFixed(2)}`
            })
          });
          const data = await response.json();
          if (data.order_id) {
            logActivity('proceed_to_payment', amount, 'one-time');
            return data.order_id;
          }
          throw new Error(data.detail || 'Failed to create order');
        },
        onApprove: async (data) => {
          setLoading(true);
          try {
            const response = await fetch(`${getBackendUrl()}/api/paypal/capture-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ order_id: data.orderID })
            });
            const captureData = await response.json();
            if (captureData.success) {
              logActivity('contributed', amount, 'one-time');
              localStorage.setItem('contribution_popup_last_shown', Date.now().toString());
              onClose();
              // Show success toast
              toastService.success('Thank you for your contribution! 💜');
            } else {
              setError(captureData.detail || 'Payment failed');
            }
          } catch (err) {
            setError('Payment failed. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          logActivity('closed');
        },
        onError: (err) => {
          console.error('PayPal error:', err);
          setError('PayPal encountered an error');
        }
      }).render(paypalContainerRef.current);
      
      setPaypalReady(true);
    } catch (err) {
      console.error('Error rendering PayPal:', err);
    }
  };

  const handleSessionDismiss = () => {
    // Log the close action
    logActivity('closed');
    // Dismiss for current session only
    sessionStorage.setItem('contribution_dismissed', 'true');
    onClose();
  };

  const handleRemindNextWeek = () => {
    // Log the remind later action
    logActivity('remind_later');
    // Set reminder for 7 days from now
    const remindAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('contribution_remind_at', remindAt.toString());
    localStorage.setItem('contribution_popup_last_shown', Date.now().toString());
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
      const response = await fetch(`${getBackendUrl()}/api/stripe/create-contribution-session`, {
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
        // Log proceed to payment action
        logActivity('proceed_to_payment', amount, paymentType);
        // Record that popup was shown
        localStorage.setItem('contribution_popup_last_shown', Date.now().toString());
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setError(data.detail || 'Failed to create payment session');
      }
    } catch (err) {
      console.error('Contribution error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="contribution-popup-overlay" onClick={handleSessionDismiss}>
      <div className="contribution-popup" onClick={(e) => e.stopPropagation()}>
        <div className="contribution-popup-header">
          <h2>
            <span className="contribution-icon">🔔</span>
            Support the Platform
          </h2>
          <button 
            className="contribution-popup-close" 
            onClick={handleSessionDismiss}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="contribution-popup-body">
          <p className="contribution-message">
            Your support helps us keep the platform ad-free and continuously improving for everyone.
          </p>

          {error && <div className="contribution-error">{error}</div>}

          <div className="contribution-amounts">
            {amounts.map((amount) => (
              <label 
                key={amount} 
                className={`contribution-amount-option ${selectedAmount === amount ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="contributionAmount"
                  value={amount}
                  checked={selectedAmount === amount}
                  onChange={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  disabled={loading}
                />
                <span className="contribution-amount-label">${amount}</span>
                {amount === 10 && <span className="popular-badge">Popular</span>}
              </label>
            ))}
            
            <label 
              className={`contribution-amount-option custom-option ${selectedAmount === 'custom' ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="contributionAmount"
                value="custom"
                checked={selectedAmount === 'custom'}
                onChange={() => setSelectedAmount('custom')}
                disabled={loading}
              />
              <span className="contribution-amount-label">
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

          {/* Payment Type Selection - COMMENTED OUT: Only PayPal one-time for now */}
          {/* <div className="payment-type-section">
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
                onClick={() => {
                  setPaymentType('monthly');
                  setPaymentMethod('stripe'); // Monthly only via Stripe
                }}
                disabled={loading}
              >
                Monthly
              </button>
            </div>
          </div> */}

          {/* Payment Method Selection - COMMENTED OUT: Only PayPal for now */}
          {/* {paymentType === 'one-time' && paypalConfigured && (
            <div className="payment-method-section">
              <span className="payment-type-label">Pay with:</span>
              <div className="payment-method-toggle">
                <button
                  className={`payment-method-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('stripe')}
                  disabled={loading}
                >
                  💳 Card
                </button>
                <button
                  className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('paypal')}
                  disabled={loading}
                >
                  <span className="paypal-p">P</span> PayPal
                </button>
              </div>
            </div>
          )} */}

          {/* PayPal Buttons */}
          {paymentMethod === 'paypal' && paymentType === 'one-time' && (
            <div className="contribution-paypal-container">
              <div ref={paypalContainerRef} id="contribution-paypal-buttons"></div>
              {!paypalReady && (
                <div className="paypal-loading">
                  <span className="spinner"></span>
                  Loading PayPal...
                </div>
              )}
            </div>
          )}

          {/* Stripe Button - COMMENTED OUT: Only PayPal for now */}
          {/* {(paymentMethod === 'stripe' || paymentType === 'monthly') && (
            <button 
              className="contribution-proceed-btn"
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
          )} */}

          <button 
            className="contribution-remind-btn"
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

export default ContributionPopup;
