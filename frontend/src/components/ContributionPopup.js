import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './ContributionPopup.css';

const ContributionPopup = ({ isOpen, onClose, contributionConfig }) => {
  const [selectedAmount, setSelectedAmount] = useState(25); // Default to $25
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const [paypalKey, setPaypalKey] = useState(0);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const amountRef = useRef(25);
  const paypalInitialized = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal', 'venmo-qr', 'paypal-qr'

  // Use amounts from config or fallback to default
  const amounts = contributionConfig?.amounts || [10, 15, 25];

  // Log activity to backend (fire and forget)
  const logActivity = useCallback(async (action, amount = null, pType = null) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${getBackendUrl()}/api/contributions/log-contribution-activity`, {
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
                {amt === 25 && <span className="popular-badge">Popular</span>}
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

          {/* Payment Method Selection */}
          <div className="payment-method-section">
            <div className="payment-method-label">Choose Payment Method:</div>
            <div className="payment-method-toggle">
              <button
                className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal')}
                disabled={loading}
              >
                <span className="paypal-p">P</span>
                PayPal
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'venmo-qr' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('venmo-qr')}
                disabled={loading}
              >
                <span className="venmo-v">V</span>
                Venmo QR
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'paypal-qr' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal-qr')}
                disabled={loading}
              >
                <span className="paypal-p">P</span>
                PayPal QR
              </button>
            </div>
          </div>

          {/* PayPal Buttons */}
          {paymentMethod === 'paypal' && (
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
          )}

          {/* Venmo QR Code */}
          {paymentMethod === 'venmo-qr' && (
            <div className="qr-code-section">
              <div className="qr-code-container">
                <div className="qr-code-header">
                  <span className="venmo-v">V</span>
                  <h3>Scan with Venmo</h3>
                </div>
                <div className="qr-code-image">
                  <img 
                    src="/images/VenmoQR.png" 
                    alt="Venmo QR Code"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <div className="qr-code-fallback" style={{ display: 'none' }}>
                    <p>📱 Venmo QR Code</p>
                    <p className="qr-username">@username</p>
                    <p className="qr-amount">${getAmount().toFixed(2)}</p>
                  </div>
                </div>
                <div className="qr-code-instructions">
                  <p>1. Open Venmo app</p>
                  <p>2. Scan this QR code</p>
                  <p>3. Send ${getAmount().toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* PayPal QR Code */}
          {paymentMethod === 'paypal-qr' && (
            <div className="qr-code-section">
              <div className="qr-code-container">
                <div className="qr-code-header">
                  <span className="paypal-p">P</span>
                  <h3>Scan with PayPal</h3>
                </div>
                <div className="qr-code-image">
                  <img 
                    src="/images/PaypalQR.png" 
                    alt="PayPal QR Code"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  <div className="qr-code-fallback" style={{ display: 'none' }}>
                    <p>💳 PayPal QR Code</p>
                    <p className="qr-username">@username</p>
                    <p className="qr-amount">${getAmount().toFixed(2)}</p>
                  </div>
                </div>
                <div className="qr-code-instructions">
                  <p>1. Open PayPal app</p>
                  <p>2. Scan this QR code</p>
                  <p>3. Send ${getAmount().toFixed(2)}</p>
                </div>
              </div>
            </div>
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
