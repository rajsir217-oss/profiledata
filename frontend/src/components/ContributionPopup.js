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
  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal', 'venmo-qr', 'paypal-qr', 'clover'
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const [cloverConfig, setCloverConfig] = useState(null);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);
  const [cloverSuccess, setCloverSuccess] = useState(false);
  const [cloverRecurring, setCloverRecurring] = useState(false);

  // Use amounts from config and always ensure $50 is included
  const baseAmounts = contributionConfig?.amounts || [10, 15, 25];
  const amounts = [...new Set([...baseAmounts, 50])].sort((a, b) => a - b);

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
      }).render(paypalContainerRef.current)
        .then(() => {
          setPaypalReady(true);
        })
        .catch((renderErr) => {
          // Suppress 'container removed from DOM' errors when popup closes
          const msg = renderErr?.message || String(renderErr);
          if (!msg.includes('container') && !msg.includes('removed') && !msg.includes('DOM')) {
            setPaypalFailed(true);
          }
        });
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

  // Initialize Clover SDK when Card tab is selected
  useEffect(() => {
    if (!isOpen || paymentMethod !== 'clover') return;
    if (cloverMountedRef.current) return;

    const initClover = async () => {
      try {
        // Fetch SDK config from backend
        const token = localStorage.getItem('token');
        const res = await fetch(`${getBackendUrl()}/api/clover/sdk-config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const config = await res.json();
        if (!config.public_key) {
          setError('Clover card payments not available.');
          return;
        }
        setCloverConfig(config);

        // Load Clover SDK script if not already loaded
        if (!window.Clover) {
          await new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${config.sdk_url}"]`);
            if (existing) { resolve(); return; }
            const script = document.createElement('script');
            script.src = config.sdk_url;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Clover SDK'));
            document.head.appendChild(script);
          });
        }

        // Initialize Clover instance
        const clover = new window.Clover(config.public_key, { merchantId: config.merchant_id });
        cloverInstanceRef.current = clover;
        const elements = clover.elements();

        // Mount card elements into DOM containers
        const styles = {
          body: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '14px' },
          input: { fontSize: '15px', padding: '10px 8px' }
        };
        const cardNumber = elements.create('CARD_NUMBER', styles);
        const cardDate = elements.create('CARD_DATE', styles);
        const cardCvv = elements.create('CARD_CVV', styles);
        const cardPostalCode = elements.create('CARD_POSTAL_CODE', styles);

        // Small delay to ensure DOM containers are rendered
        setTimeout(() => {
          try {
            cardNumber.mount('#clover-card-number');
            cardDate.mount('#clover-card-date');
            cardCvv.mount('#clover-card-cvv');
            cardPostalCode.mount('#clover-card-zip');
            cloverMountedRef.current = true;
            setCloverReady(true);
          } catch (mountErr) {
            setError('Failed to mount card form. Please try again.');
          }
        }, 300);
      } catch (err) {
        setError('Failed to initialize card payment form.');
      }
    };
    initClover();

    return () => {
      cloverMountedRef.current = false;
      setCloverReady(false);
    };
  }, [isOpen, paymentMethod]);

  // Handle Clover card payment submission
  const handleCloverPay = useCallback(async () => {
    if (!cloverInstanceRef.current) return;
    const amount = getAmount();
    if (!amount || amount < 1) {
      setError('Please select a valid amount (minimum $1)');
      return;
    }
    setCloverLoading(true);
    setError('');
    try {
      const result = await cloverInstanceRef.current.createToken();
      if (result.errors) {
        const errMsgs = Object.values(result.errors).map(e => typeof e === 'string' ? e : (e?.message || JSON.stringify(e)));
        setError(errMsgs.join(', '));
        setCloverLoading(false);
        return;
      }
      const sourceToken = result.token;
      logActivity('proceed_to_payment', amount, 'clover-card');

      // Send token to backend to create charge
      const authToken = localStorage.getItem('token');
      const chargeRes = await fetch(`${getBackendUrl()}/api/clover/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          source: sourceToken,
          amount: amount.toFixed(2),
          description: `Contribution - $${amount.toFixed(2)}`,
          recurring: cloverRecurring
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.success) {
        setCloverSuccess(true);
        if (toastService) {
          const recurMsg = cloverRecurring ? ' (monthly recurring)' : '';
          toastService.success(`Payment of $${amount.toFixed(2)}${recurMsg} successful! Thank you!`);
        }
        setTimeout(() => onClose(), 2500);
      } else {
        const detail = chargeData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : (detail?.msg || 'Card charge failed. Please try again.');
        setError(msg);
      }
    } catch (err) {
      setError('Failed to process card payment. Please try again.');
    } finally {
      setCloverLoading(false);
    }
  }, [getAmount, logActivity, onClose, cloverRecurring]);

  // Handle dismiss
  const handleDismiss = () => {
    if (!loading) {
      logActivity('popup_dismissed');
      localStorage.setItem('contribution_dismissed_at', Date.now().toString());
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
              <button
                className={`payment-method-btn ${paymentMethod === 'clover' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('clover')}
                disabled={loading || cloverLoading}
              >
                <span className="clover-icon">☘</span>
                Card
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
              <div >
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

          {/* Clover Card Payment (iframe SDK) */}
          {paymentMethod === 'clover' && (
            <div className="clover-checkout-section">
              {cloverSuccess ? (
                <div className="clover-success-msg">
                  <span className="clover-success-icon">✓</span>
                  <p>Payment successful! Thank you for your contribution.</p>
                </div>
              ) : (
                <>
                  <div className="clover-info">
                    <p>Pay securely with credit or debit card.</p>
                  </div>
                  <div className="clover-card-form">
                    <div className="clover-field">
                      <label className="clover-label">Card Number</label>
                      <div id="clover-card-number" className="clover-input-container"></div>
                    </div>
                    <div className="clover-field-row">
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">Expiry</label>
                        <div id="clover-card-date" className="clover-input-container"></div>
                      </div>
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">CVV</label>
                        <div id="clover-card-cvv" className="clover-input-container"></div>
                      </div>
                    </div>
                    <div className="clover-field">
                      <label className="clover-label">ZIP Code</label>
                      <div id="clover-card-zip" className="clover-input-container"></div>
                    </div>
                  </div>
                  <div
                    className={`clover-recurring-toggle ${cloverRecurring ? 'active' : ''}`}
                    onClick={() => setCloverRecurring(prev => !prev)}
                  >
                    <div className={`clover-recurring-switch ${cloverRecurring ? 'on' : ''}`} />
                    <div className="clover-recurring-label">
                      <span>Monthly recurring</span>
                      <span>{cloverRecurring ? `$${getAmount().toFixed(2)}/month auto-charge` : 'One-time payment'}</span>
                    </div>
                  </div>
                  <button
                    className="contribution-proceed-btn clover-pay-btn"
                    onClick={handleCloverPay}
                    disabled={cloverLoading || !cloverReady || loading}
                  >
                    {cloverLoading ? (
                      <><span className="spinner"></span> Processing...</>
                    ) : !cloverReady ? (
                      <><span className="spinner"></span> Loading card form...</>
                    ) : (
                      <>{cloverRecurring ? `Pay $${getAmount().toFixed(2)}/mo` : `Pay $${getAmount().toFixed(2)}`}</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* PayPal QR Code */}
          {paymentMethod === 'paypal-qr' && (
            <div className="qr-code-section">
              <div >
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
