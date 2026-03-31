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
  const [paypalKey, setPaypalKey] = useState(0);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const amountRef = useRef(25);
  const paypalInitialized = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');

  const amounts = [10, 15, 25, 50];

  // Get current amount
  const getAmount = useCallback(() => {
    if (selectedAmount === 'custom') {
      return parseFloat(customAmount) || 0;
    }
    return parseFloat(selectedAmount) || 0;
  }, [selectedAmount, customAmount]);

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
      }).render(paypalContainerRef.current);

      setPaypalReady(true);
    } catch (err) {
      setPaypalFailed(true);
    }
  }, [pollData, onComplete]);

  // Keep amountRef in sync and re-render PayPal buttons when amount changes
  useEffect(() => {
    const newAmount = getAmount();
    amountRef.current = newAmount;

    if (!paypalInitialized.current) return;

    const delay = selectedAmount === 'custom' ? 800 : 50;
    const timer = setTimeout(() => {
      setPaypalKey(k => k + 1);
      setPaypalReady(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [getAmount, selectedAmount]);

  // Re-render PayPal buttons when container remounts
  useEffect(() => {
    if (isVisible && paypalScriptLoaded.current && window.paypal && paypalContainerRef.current && !paypalReady) {
      renderPayPalButtons();
    }
  }, [paypalKey, isVisible, paypalReady, renderPayPalButtons]);

  // Load PayPal SDK on first open
  useEffect(() => {
    if (isVisible && !paypalInitialized.current && !paypalFailed) {
      const initPayPal = async () => {
        const loaded = await loadPayPalScript();
        if (loaded) {
          paypalInitialized.current = true;
          setTimeout(() => renderPayPalButtons(), 200);
        }
      };
      initPayPal();
    }
  }, [isVisible, paypalFailed, loadPayPalScript, renderPayPalButtons]);

  if (!isVisible) return null;

  return (
    <div className="poll-payment-inline">
      {error && <div className="contribution-error">{error}</div>}

      {/* Amount Selection - same as ContributionPopup */}
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

      {/* Payment Method Tabs - same as ContributionPopup */}
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
            disabled={loading}
          >
            <span className="clover-icon">☘</span>
            Card
          </button>
        </div>
      </div>

      {/* PayPal Buttons - same as ContributionPopup */}
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

          <div
            key={paypalKey}
            ref={paypalContainerRef}
            id="poll-paypal-buttons"
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

      {/* Card placeholder */}
      {paymentMethod === 'clover' && (
        <div className="qr-code-section">
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
            Card payment coming soon. Please use PayPal or QR code methods.
          </div>
        </div>
      )}
    </div>
  );
};

export default PollPaymentInline;
