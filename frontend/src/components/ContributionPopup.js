import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './ContributionPopup.css';

const ContributionPopup = ({ isOpen, onClose, contributionConfig }) => {
  const [selectedAmount, setSelectedAmount] = useState(15); // Default to $15
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const [paypalKey, setPaypalKey] = useState(0);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const amountRef = useRef(15);
  const paypalInitialized = useRef(false);

  // Use amounts from config or fallback to default
  const amounts = contributionConfig?.amounts || [10, 15, 25];

  // Log activity to backend (fire and forget)
  const logActivity = useCallback(async (action, amount = null, pType = null) => {
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
    }
  }, []);

  // Get the current amount
  const getAmount = useCallback(() => {
    if (selectedAmount === 'custom') {
      return parseFloat(customAmount) || 0;
    }
    return parseFloat(selectedAmount) || 0;
  }, [selectedAmount, customAmount]);

  // Load PayPal SDK script
  const loadPayPalScript = useCallback(async () => {
    if (paypalScriptLoaded.current || window.paypal) {
      paypalScriptLoaded.current = true;
      return true;
    }

    try {
      const response = await fetch(`${getBackendUrl()}/api/paypal/config`);
      const config = await response.json();

      if (!config.configured || !config.client_id) {
        setPaypalFailed(true);
        setError('PayPal is not configured. Please contact support.');
        return false;
      }

      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${config.client_id}&currency=USD&disable-funding=credit`;
        script.async = true;
        script.onload = () => {
          paypalScriptLoaded.current = true;
          resolve(true);
        };
        script.onerror = () => {
          setPaypalFailed(true);
          setError('PayPal failed to load. Please disable ad blockers and try again.');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    } catch (err) {
      setPaypalFailed(true);
      setError('Failed to initialize PayPal.');
      return false;
    }
  }, []);

  // Render PayPal buttons into the current container
  const renderPayPalButtons = useCallback(() => {
    if (!window.paypal || !paypalContainerRef.current) return;

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
          const amount = amountRef.current;
          if (!amount || amount < 1) {
            setError('Please select a valid amount (minimum $1)');
            throw new Error('Invalid amount');
          }

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
          setError('');
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
              logActivity('contributed', amountRef.current, 'one-time');
              localStorage.setItem('contribution_popup_last_shown', Date.now().toString());
              if (toastService) {
                toastService.success('Thank you for your contribution! 💜');
              }
              onClose();
            } else {
              setError(captureData.detail || 'Payment failed. Please try again.');
            }
          } catch (err) {
            setError('Payment failed. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          logActivity('payment_cancelled');
        },
        onError: (err) => {
          setError('PayPal encountered an error. Please try again.');
        }
      }).render(paypalContainerRef.current);

      setPaypalReady(true);
    } catch (err) {
      setPaypalFailed(true);
    }
  }, [logActivity, onClose]);

  // Keep amountRef in sync and debounce paypalKey bump to avoid duplicate buttons
  useEffect(() => {
    const newAmount = getAmount();
    amountRef.current = newAmount;

    if (!paypalInitialized.current) return;

    // Debounce for custom input (user typing), instant for preset amounts
    const delay = selectedAmount === 'custom' ? 800 : 50;
    const timer = setTimeout(() => {
      setPaypalKey(k => k + 1);
      setPaypalReady(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [getAmount, selectedAmount]);

  // Re-render PayPal buttons when container remounts (key changed)
  useEffect(() => {
    if (isOpen && paypalScriptLoaded.current && window.paypal && paypalContainerRef.current && !paypalReady) {
      renderPayPalButtons();
    }
  }, [paypalKey, isOpen, paypalReady, renderPayPalButtons]);

  // ESC key handler
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

  // Handle body scroll lock when popup opens/closes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      logActivity('popup_shown');
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, logActivity]);

  // Load PayPal SDK once and render buttons on first open
  useEffect(() => {
    if (isOpen && !paypalInitialized.current && !paypalFailed) {
      const initPayPal = async () => {
        const loaded = await loadPayPalScript();
        if (loaded) {
          paypalInitialized.current = true;
          setTimeout(() => renderPayPalButtons(), 200);
        }
      };
      initPayPal();
    }
  }, [isOpen, paypalFailed, loadPayPalScript, renderPayPalButtons]);


  // Handle dismiss
  const handleDismiss = () => {
    if (!loading) {
      logActivity('popup_dismissed');
      onClose();
    }
  };

  return (
    <div className="contribution-popup-overlay" onClick={handleDismiss} style={{ display: isOpen ? 'flex' : 'none' }}>
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
            {amounts.map((amt) => (
              <label 
                key={amt} 
                className={`contribution-amount-option ${selectedAmount === amt ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="contributionAmount"
                  value={amt}
                  checked={selectedAmount === amt}
                  onChange={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                    setError('');
                  }}
                  disabled={loading}
                />
                <span className="contribution-amount-label">${amt}</span>
                {amt === 15 && <span className="popular-badge">Popular</span>}
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
                    setError('');
                  }}
                  placeholder="Enter amount"
                  min="1"
                  disabled={loading}
                />
              </span>
            </label>
          </div>

          {/* PayPal Buttons */}
          <div className="contribution-paypal-section">
            {loading && (
              <div className="paypal-processing">
                <span className="spinner"></span>
                Processing payment...
              </div>
            )}
            
            {!paypalReady && !paypalFailed && (
              <div className="paypal-loading">
                <span className="spinner"></span>
                Loading PayPal...
              </div>
            )}

            {/* Key forces clean React unmount/remount when amount changes */}
            <div 
              key={paypalKey}
              ref={paypalContainerRef} 
              id="contribution-paypal-buttons"
              style={{ display: paypalFailed ? 'none' : 'block' }}
            />

            {paypalFailed && (
              <div className="paypal-fallback">
                <p>PayPal is currently unavailable.</p>
                <button 
                  className="contribution-proceed-btn"
                  onClick={() => {
                    setPaypalFailed(false);
                    setError('');
                    loadPayPalScript().then((loaded) => {
                      if (loaded) renderPayPalButtons();
                    });
                  }}
                >
                  Retry PayPal
                </button>
              </div>
            )}
          </div>

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
