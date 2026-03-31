import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import { createApiInstance } from '../api';
import './ContributionPopup.css';
import './PollPaymentInline.css';

const pollsApi = createApiInstance();

/**
 * Inline payment component for poll RSVP responses.
 * Reuses the exact same UI from ContributionPopup:
 *   - Amount selection buttons ($10, $15, $25, $50, Custom)
 *   - Payment method tabs (PayPal, Venmo QR, PayPal QR, Card)
 *   - PayPal iframe / QR code / Clover card form
 * Appears directly inside the poll card, below the "Yes" option.
 */
const PollPaymentInline = ({ isVisible, onComplete, onCancel, pollData }) => {
  const [selectedAmount, setSelectedAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const amountRef = useRef(25);
  const paypalInitialized = useRef(false);
  const paypalRetryCount = useRef(0);
  const paypalRenderedRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');

  // Clover card state
  const [cloverConfig, setCloverConfig] = useState(null);
  const [cloverReady, setCloverReady] = useState(false);
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverSuccess, setCloverSuccess] = useState(false);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);

  const amounts = [10, 15, 25, 50];

  // Check if this is a Virtual Meet event with fixed amount
  const isFixedAmountEvent = pollData?.paymentAmount && pollData.paymentAmount > 0;
  
  // Get current amount
  const getAmount = useCallback(() => {
    // For Virtual Meet events, use the admin-set amount
    if (isFixedAmountEvent) {
      return pollData.paymentAmount;
    }
    // Otherwise use user selection
    if (selectedAmount === 'custom') {
      return parseFloat(customAmount) || 0;
    }
    return parseFloat(selectedAmount) || 0;
  }, [selectedAmount, customAmount, isFixedAmountEvent, pollData?.paymentAmount]);

  // Load PayPal SDK script (reused from ContributionPopup)
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

  // Render PayPal buttons (reused from ContributionPopup)
  const renderPayPalButtons = useCallback((force = false) => {
    if (!window.paypal || !paypalContainerRef.current) return;
    
    // Skip if already rendered and not forced
    if (paypalRenderedRef.current && !force) return;
    
    // Clear container to prevent duplicate buttons
    paypalContainerRef.current.innerHTML = '';

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
          const currentAmount = amountRef.current;
          if (!currentAmount || currentAmount < 1) {
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
              amount: currentAmount.toFixed(2),
              currency: 'USD',
              plan_id: 'poll_rsvp',
              description: `RSVP Payment - $${currentAmount.toFixed(2)}`
            })
          });
          const data = await response.json();
          if (data.order_id) {
            return data.order_id;
          }
          throw new Error(data.detail || 'Failed to create order');
        },
        onApprove: async (data) => {
          setLoading(true);
          setError('');
          try {
            // Capture payment
            const captureResponse = await fetch(`${getBackendUrl()}/api/paypal/capture-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ order_id: data.orderID })
            });
            const captureData = await captureResponse.json();

            if (captureData.success) {
              // Submit poll response after successful payment
              const payload = {
                poll_id: pollData.pollId,
                selected_options: [pollData.optionId],
                payment_required: true,
                payment_status: 'completed',
                payment_amount: amountRef.current,
                payment_id: data.orderID,
                payment_method: 'paypal'
              };

              const pollResponse = await pollsApi.post(
                `/api/polls/${pollData.pollId}/pay-and-respond`,
                payload
              );

              if (pollResponse.data.success) {
                onComplete();
              } else {
                setError(pollResponse.data.detail || 'Failed to submit RSVP');
              }
            } else {
              setError(captureData.detail || 'Payment failed. Please try again.');
            }
          } catch (err) {
            setError('Payment confirmation failed. Please contact support.');
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {},
        onError: (err) => {
          setError('PayPal encountered an error. Please try again.');
        }
      }).render(paypalContainerRef.current)
        .then(() => {
          paypalRetryCount.current = 0;
          paypalRenderedRef.current = true;
          setPaypalReady(true);
        })
        .catch((renderErr) => {
          // Ignore 'container removed from DOM' errors — happens when
          // ContributionPopup or other PayPal instances unmount concurrently
          const msg = renderErr?.message || String(renderErr);
          if (msg.includes('container') || msg.includes('removed') || msg.includes('DOM')) {
            // Re-try render (max 2 retries) after a delay
            if (paypalRetryCount.current < 2) {
              paypalRetryCount.current += 1;
              setTimeout(() => {
                if (paypalContainerRef.current && window.paypal) {
                  paypalContainerRef.current.innerHTML = '';
                  renderPayPalButtons();
                }
              }, 500);
            }
          } else {
            setPaypalFailed(true);
          }
        });
    } catch (err) {
      setPaypalFailed(true);
    }
  }, [pollData, onComplete]);

  // Keep amountRef in sync
  useEffect(() => {
    amountRef.current = getAmount();
  }, [getAmount]);

  // Re-render PayPal buttons when amount changes (only for non-fixed-amount events)
  useEffect(() => {
    if (!paypalInitialized.current || !paypalRenderedRef.current) return;
    if (isFixedAmountEvent) return;

    const delay = selectedAmount === 'custom' ? 800 : 50;
    const timer = setTimeout(() => {
      if (paypalContainerRef.current && window.paypal) {
        renderPayPalButtons(true);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedAmount, customAmount, isFixedAmountEvent, renderPayPalButtons]);

  // Load PayPal SDK and render buttons once on first open
  useEffect(() => {
    if (!isVisible || paypalInitialized.current || paypalFailed) return;

    const initPayPal = async () => {
      const loaded = await loadPayPalScript();
      if (loaded) {
        paypalInitialized.current = true;
        setTimeout(() => {
          if (paypalContainerRef.current) {
            renderPayPalButtons();
          }
        }, 200);
      }
    };
    initPayPal();
  }, [isVisible, paypalFailed, loadPayPalScript, renderPayPalButtons]);

  // Initialize Clover SDK once when component becomes visible
  useEffect(() => {
    if (!isVisible || cloverMountedRef.current) return;

    const initClover = async () => {
      try {
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

        const clover = new window.Clover(config.public_key, { merchantId: config.merchant_id });
        cloverInstanceRef.current = clover;
        const elements = clover.elements();

        const styles = {
          body: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '14px' },
          input: { fontSize: '15px', padding: '10px 8px' }
        };
        const cardNumber = elements.create('CARD_NUMBER', styles);
        const cardDate = elements.create('CARD_DATE', styles);
        const cardCvv = elements.create('CARD_CVV', styles);
        const cardPostalCode = elements.create('CARD_POSTAL_CODE', styles);

        // Store elements in refs for later mounting
        cloverInstanceRef.current.elements = {
          cardNumber, cardDate, cardCvv, cardPostalCode
        };

        cloverMountedRef.current = true;
      } catch (err) {
        setError('Failed to initialize card payment form.');
      }
    };
    initClover();

    // Only cleanup when component unmounts
    return () => {
      if (!isVisible) {
        cloverMountedRef.current = false;
        setCloverReady(false);
      }
    };
  }, [isVisible]);

  // Mount/unmount Clover card elements when switching to/from Card tab
  useEffect(() => {
    if (!cloverMountedRef.current) return;

    if (paymentMethod === 'clover' && !cloverReady) {
      // Mount the elements
      const elements = cloverInstanceRef.current.elements;
      if (elements) {
        setTimeout(() => {
          try {
            elements.cardNumber.mount('#poll-clover-card-number');
            elements.cardDate.mount('#poll-clover-card-date');
            elements.cardCvv.mount('#poll-clover-card-cvv');
            elements.cardPostalCode.mount('#poll-clover-card-zip');
            setCloverReady(true);
          } catch (mountErr) {
            setError('Failed to mount card form. Please try again.');
          }
        }, 100);
      }
    } else if (paymentMethod !== 'clover' && cloverReady) {
      // Unmount the elements (but keep SDK loaded)
      const elements = cloverInstanceRef.current.elements;
      if (elements) {
        try {
          elements.cardNumber.unmount();
          elements.cardDate.unmount();
          elements.cardCvv.unmount();
          elements.cardPostalCode.unmount();
        } catch (e) {
          // Ignore unmount errors
        }
        setCloverReady(false);
      }
    }
  }, [paymentMethod, cloverMountedRef, cloverReady]);

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
          description: `RSVP Payment - $${amount.toFixed(2)}`
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.success) {
        setCloverSuccess(true);

        // Submit poll response after successful card payment
        const payload = {
          poll_id: pollData.pollId,
          selected_options: [pollData.optionId],
          payment_required: true,
          payment_status: 'completed',
          payment_amount: amount,
          payment_id: chargeData.charge_id || 'clover',
          payment_method: 'card'
        };
        const pollResponse = await pollsApi.post(
          `/api/polls/${pollData.pollId}/pay-and-respond`,
          payload
        );
        if (pollResponse.data.success) {
          onComplete();
        } else {
          setError(pollResponse.data.detail || 'Failed to submit RSVP');
        }
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
  }, [getAmount, pollData, onComplete]);

  return (
    <div className="poll-payment-inline" style={{ display: isVisible ? 'block' : 'none' }}>
      {error && <div className="contribution-error">{error}</div>}

      {/* Amount Display - fixed for Virtual Meet events, selectable for regular contributions */}
      {isFixedAmountEvent ? (
        <div className="contribution-fixed-amount">
          <div className="fixed-amount-display">
            <span className="fixed-amount-label">Event Fee:</span>
            <span className="fixed-amount-value">${getAmount().toFixed(2)}</span>
          </div>
          <div className="fixed-amount-description">
            Complete payment to confirm your RSVP for {pollData.pollTitle}
          </div>
        </div>
      ) : (
        <div className="contribution-amounts">
          {amounts.map((amt) => (
            <label
              key={amt}
              className={`contribution-amount-option ${selectedAmount === amt ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="pollContributionAmount"
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
              name="pollContributionAmount"
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
                placeholder="Enter"
                min="1"
                disabled={loading}
              />
            </span>
          </label>
        </div>
      )}

      {/* Payment Method Tabs - same as ContributionPopup */}
      <div className="payment-method-section">
        <div className="payment-method-label">Choose Payment Method:</div>
        <div className="payment-method-toggle">
          <button
            className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
            onClick={() => {
              setPaymentMethod('paypal');
            }}
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
            disabled={loading}
          >
            <span className="clover-icon">☘</span>
            Card
          </button>
        </div>
      </div>

      {/* PayPal Buttons - always mounted to avoid 'container removed from DOM' error */}
      <div className="contribution-paypal-section" style={{ display: paymentMethod === 'paypal' ? 'block' : 'none' }}>
        {loading && paymentMethod === 'paypal' && (
          <div className="paypal-processing">
            <span className="spinner"></span>
            Processing payment...
          </div>
        )}

        {!paypalReady && !paypalFailed && paymentMethod === 'paypal' && (
          <div className="paypal-loading">
            <span className="spinner"></span>
            Loading PayPal...
          </div>
        )}

        <div
          ref={paypalContainerRef}
          id="poll-paypal-buttons"
          style={{ display: paypalFailed ? 'none' : 'block' }}
        />

        {paypalFailed && paymentMethod === 'paypal' && (
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

      {/* Venmo QR Code - same as ContributionPopup */}
      {paymentMethod === 'venmo-qr' && (
        <div className="qr-code-section">
          <div>
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
                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <div className="qr-code-fallback" style={{ display: 'none' }}>
                <p>Venmo QR Code</p>
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

      {/* PayPal QR Code - same as ContributionPopup */}
      {paymentMethod === 'paypal-qr' && (
        <div className="qr-code-section">
          <div>
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
                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <div className="qr-code-fallback" style={{ display: 'none' }}>
                <p>PayPal QR Code</p>
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

      {/* Card / Clover - same as ContributionPopup */}
      {paymentMethod === 'clover' && (
        <div className="clover-card-section poll-clover-compact">
          {cloverSuccess ? (
            <div className="clover-success-msg">
              <div className="clover-success-icon">✓</div>
              <p>Payment successful! RSVP confirmed.</p>
            </div>
          ) : (
            <>
              <div className="clover-card-form">
                <div className="clover-field">
                  <span className="clover-label">CARD NUMBER</span>
                  <div id="poll-clover-card-number" className="clover-input-container"></div>
                </div>
                <div className="clover-field-row">
                  <div className="clover-field clover-field-half">
                    <span className="clover-label">EXPIRY</span>
                    <div id="poll-clover-card-date" className="clover-input-container"></div>
                  </div>
                  <div className="clover-field clover-field-half">
                    <span className="clover-label">CVV</span>
                    <div id="poll-clover-card-cvv" className="clover-input-container"></div>
                  </div>
                  <div className="clover-field clover-field-half">
                    <span className="clover-label">ZIP</span>
                    <div id="poll-clover-card-zip" className="clover-input-container"></div>
                  </div>
                </div>
              </div>
              <button
                className="contribution-proceed-btn"
                onClick={handleCloverPay}
                disabled={cloverLoading || !cloverReady}
              >
                {cloverLoading ? (
                  <><span className="spinner"></span> Processing...</>
                ) : (
                  `Pay $${getAmount().toFixed(2)} with Card`
                )}
              </button>
              {!cloverReady && (
                <div className="paypal-loading">
                  <span className="spinner"></span>
                  Loading card form...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PollPaymentInline;
