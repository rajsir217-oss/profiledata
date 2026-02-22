import React, { useState, useEffect, useRef } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './ContributionPopup.css';

const ContributionPopup = ({ isOpen, onClose, contributionConfig }) => {
  const [selectedAmount, setSelectedAmount] = useState(15);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalConfig, setPaypalConfig] = useState(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const paypalContainerRef = useRef(null);
  const paypalTimeoutRef = useRef(null);

  // Use amounts from config or fallback to default
  const amounts = contributionConfig?.amounts || [10, 15, 25];

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

  // ESC key handler with proper cleanup
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && !loading) {
        handleDismiss();
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
      logActivity('popup_shown');
      // Check PayPal config only if not already cached
      if (!paypalConfig) {
        checkPayPalConfig();
      } else if (paypalConfig?.configured && !paypalFailed) {
        // Initialize PayPal if config is ready
        initializePayPal();
      }
    } else {
      document.body.style.overflow = 'unset';
      // Clear PayPal timeout when popup closes
      if (paypalTimeoutRef.current) {
        clearTimeout(paypalTimeoutRef.current);
      }
      // Clear PayPal container
      if (paypalContainerRef.current) {
        paypalContainerRef.current.innerHTML = '';
      }
      setPaypalReady(false);
    }

    return () => {
      document.body.style.overflow = 'unset';
      if (paypalTimeoutRef.current) {
        clearTimeout(paypalTimeoutRef.current);
      }
    };
  }, [isOpen, paypalConfig, paypalFailed]);

  // Check PayPal configuration (cached)
  const checkPayPalConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/paypal/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPaypalConfig(data);
    } catch (err) {
      console.debug('PayPal config check failed:', err);
      setPaypalConfig({ configured: false });
    }
  };

  // Initialize PayPal only when needed
  const initializePayPal = async () => {
    if (!paypalConfig?.configured || !paypalConfig?.client_id) return;
    
    // Set timeout for PayPal SDK loading
    if (paypalTimeoutRef.current) clearTimeout(paypalTimeoutRef.current);
    paypalTimeoutRef.current = setTimeout(() => {
      if (!paypalReady && !paypalFailed) {
        console.debug('PayPal SDK timed out - falling back to Stripe');
        setPaypalFailed(true);
      }
    }, 8000);

    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalConfig.client_id}&currency=USD&disable-funding=credit`;
      script.async = true;
      script.onload = () => {
        if (paypalTimeoutRef.current) clearTimeout(paypalTimeoutRef.current);
        renderPayPalButtons();
      };
      script.onerror = () => {
        if (paypalTimeoutRef.current) clearTimeout(paypalTimeoutRef.current);
        console.debug('PayPal SDK blocked - falling back to Stripe');
        setPaypalFailed(true);
      };
      document.body.appendChild(script);
    } else {
      if (paypalTimeoutRef.current) clearTimeout(paypalTimeoutRef.current);
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
          height: 40,
          tagline: false
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

  const handleDismiss = () => {
    // Log the dismiss action
    logActivity('dismissed');
    // Dismiss for current session only
    sessionStorage.setItem('contribution_dismissed', 'true');
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
          paymentType: 'one-time'
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Log proceed to payment action
        logActivity('proceed_to_payment', amount, 'one-time');
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
    <div className="contribution-popup-overlay" onClick={handleDismiss}>
      <div className="contribution-popup" onClick={(e) => e.stopPropagation()}>
        <div className="contribution-popup-header">
          <h2>
            <span className="contribution-icon">🔔</span>
            PLEASE SUPPORT THE PLATFORM
          </h2>
          <button 
            className="contribution-popup-close" 
            onClick={handleDismiss}
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
                {amount === 15 && <span className="popular-badge">Popular</span>}
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

          {/* PayPal Buttons (hidden when PayPal failed/blocked) */}
          {paypalConfig?.configured && !paypalFailed && (
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

          {/* Stripe Checkout fallback (auto-enabled when PayPal blocked) */}
          {(!paypalConfig?.configured || paypalFailed) && (
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
                <>� Pay with Card</>
              )}
            </button>
          )}

          <button 
            className="contribution-remind-btn"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContributionPopup;
