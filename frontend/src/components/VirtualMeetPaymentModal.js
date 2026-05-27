import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import { createApiInstance } from '../api';
import './ContributionPopup.css';

const vmApi = createApiInstance();

/**
 * In-app payment modal for Virtual Meets, reusing the ContributionPopup
 * PayPal SDK + Clover card payment patterns. Fixed amount from the event.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSuccess: () => void   (called after payment confirmed + access unlocked)
 *  - event: { poll_id, title, payment_amount }
 */
const VirtualMeetPaymentModal = ({ isOpen, onClose, onSuccess, event }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const paypalInitialized = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState('paypal'); // 'paypal' | 'clover'
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);
  const [cloverSuccess, setCloverSuccess] = useState(false);

  const amount = event?.payment_amount || 5.00;

  // Confirm payment with VM backend to unlock access
  const confirmPaymentBackend = useCallback(async (method, orderId) => {
    try {
      await vmApi.post(`/api/virtual-meets/${event.poll_id}/confirm-payment`, {
        order_id: orderId,
        payment_method: method
      });
    } catch (err) {
      // Even if backend confirm fails, PayPal/Clover already charged.
      // Log but don't block success UX.
    }
  }, [event?.poll_id]);

  // ─── PayPal SDK ──────────────────────────────────────────────────────

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
        script.onload = () => { paypalScriptLoaded.current = true; resolve(true); };
        script.onerror = () => {
          setPaypalFailed(true);
          setError('PayPal failed to load. Please disable ad blockers and try again.');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    } catch {
      setPaypalFailed(true);
      setError('Failed to initialize PayPal.');
      return false;
    }
  }, []);

  const renderPayPalButtons = useCallback(() => {
    if (!window.paypal || !paypalContainerRef.current) return;
    const token = localStorage.getItem('token');

    try {
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 40, tagline: false },
        createOrder: async () => {
          const response = await fetch(`${getBackendUrl()}/api/paypal/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              amount: amount.toFixed(2),
              currency: 'USD',
              plan_id: 'virtual_meet',
              description: `Virtual Meet Access – ${event?.title || 'Event'}`
            })
          });
          const data = await response.json();
          if (data.order_id) return data.order_id;
          throw new Error(data.detail || 'Failed to create order');
        },
        onApprove: async (data) => {
          setLoading(true);
          setError('');
          try {
            const response = await fetch(`${getBackendUrl()}/api/paypal/capture-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ order_id: data.orderID })
            });
            const captureData = await response.json();
            if (captureData.success) {
              await confirmPaymentBackend('paypal', data.orderID);
              onSuccess();
            } else {
              setError(captureData.detail || 'Payment failed. Please try again.');
            }
          } catch {
            setError('Payment failed. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {},
        onError: () => { setError('PayPal encountered an error. Please try again.'); }
      }).render(paypalContainerRef.current);
      setPaypalReady(true);
    } catch {
      setPaypalFailed(true);
    }
  }, [amount, event?.title, confirmPaymentBackend, onSuccess]);

  // Load PayPal SDK on first open
  useEffect(() => {
    if (isOpen && !paypalInitialized.current && !paypalFailed) {
      const init = async () => {
        const loaded = await loadPayPalScript();
        if (loaded) {
          paypalInitialized.current = true;
          setTimeout(() => renderPayPalButtons(), 200);
        }
      };
      init();
    }
  }, [isOpen, paypalFailed, loadPayPalScript, renderPayPalButtons]);

  // Re-render PayPal when switching back to paypal tab
  useEffect(() => {
    if (isOpen && paymentMethod === 'paypal' && paypalInitialized.current && !paypalReady && paypalContainerRef.current) {
      renderPayPalButtons();
    }
  }, [isOpen, paymentMethod, paypalReady, renderPayPalButtons]);

  // ─── Clover SDK ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || paymentMethod !== 'clover') return;
    if (cloverMountedRef.current) return;

    const initClover = async () => {
      try {
        if (!window.isSecureContext) {
          setError('Card payments require HTTPS. Please use PayPal.');
          return;
        }

        const token = localStorage.getItem('token');
        const res = await fetch(`${getBackendUrl()}/api/clover/sdk-config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const config = await res.json();
        if (!res.ok) {
          setError(config?.detail || 'Card payments not available.');
          return;
        }
        if (!config.public_key) {
          setError('Card payments not available.');
          return;
        }

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

        const clover = new window.Clover(config.public_key);
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

        setTimeout(() => {
          try {
            cardNumber.mount('#vm-clover-card-number');
            cardDate.mount('#vm-clover-card-date');
            cardCvv.mount('#vm-clover-card-cvv');
            cardPostalCode.mount('#vm-clover-card-zip');
            cloverMountedRef.current = true;
            setCloverReady(true);
          } catch {
            setError('Failed to mount card form. Please try again.');
          }
        }, 300);
      } catch {
        setError('Failed to initialize card payment form.');
      }
    };
    initClover();

    return () => {
      cloverMountedRef.current = false;
      setCloverReady(false);
    };
  }, [isOpen, paymentMethod]);

  const handleCloverPay = useCallback(async () => {
    if (!cloverInstanceRef.current) return;
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          source: sourceToken,
          amount: amount.toFixed(2),
          description: `Virtual Meet Access – ${event?.title || 'Event'}`,
          recurring: false
        })
      });
      const chargeData = await chargeRes.json();
      if (chargeData.success) {
        setCloverSuccess(true);
        await confirmPaymentBackend('clover', chargeData.charge_id || sourceToken);
        setTimeout(() => onSuccess(), 1500);
      } else {
        const detail = chargeData.detail;
        const msg = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : (detail?.msg || 'Card charge failed. Please try again.');
        setError(msg);
      }
    } catch {
      setError('Failed to process card payment. Please try again.');
    } finally {
      setCloverLoading(false);
    }
  }, [amount, event?.title, confirmPaymentBackend, onSuccess]);

  // ─── ESC + body scroll lock ──────────────────────────────────────────

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, loading, onClose]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setCloverSuccess(false);
      setPaypalReady(false);
    }
  }, [isOpen]);

  if (!isOpen || !event) return null;

  return (
    <div className="contribution-popup-overlay" onClick={() => { if (!loading) onClose(); }}>
      <div className="contribution-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="contribution-popup-header">
          <h2>
            <span className="contribution-icon">🎥</span>
            Unlock Virtual Meet Access
          </h2>
          <button className="contribution-popup-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="contribution-popup-body">
          <p className="contribution-message">
            Pay <strong>${amount.toFixed(2)}</strong> to unlock matches and 1:1 room requests for <strong>{event.title}</strong>.
          </p>

          {error && <div className="contribution-error">{error}</div>}

          {/* Payment Method Tabs */}
          <div className="payment-method-section">
            <div className="payment-method-toggle">
              <button
                className={`payment-method-btn ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => { setPaymentMethod('paypal'); setError(''); }}
                disabled={loading}
              >
                <span className="paypal-p">P</span>
                PayPal
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'clover' ? 'active' : ''}`}
                onClick={() => { setPaymentMethod('clover'); setError(''); }}
                disabled={loading || cloverLoading}
              >
                <span className="clover-icon">☘</span>
                Card
              </button>
            </div>
          </div>

          {/* PayPal Buttons (inline SDK) */}
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
              <div ref={paypalContainerRef} id="vm-paypal-buttons" style={{ display: paypalFailed ? 'none' : 'block' }} />
              {paypalFailed && (
                <div className="paypal-fallback">
                  <p>PayPal is currently unavailable.</p>
                  <button className="contribution-proceed-btn" onClick={() => {
                    setPaypalFailed(false);
                    setError('');
                    loadPayPalScript().then((loaded) => { if (loaded) renderPayPalButtons(); });
                  }}>
                    Retry PayPal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Clover Card Form */}
          {paymentMethod === 'clover' && (
            <div className="clover-checkout-section">
              {cloverSuccess ? (
                <div className="clover-success-msg">
                  <span className="clover-success-icon">✓</span>
                  <p>Payment successful! Unlocking your access...</p>
                </div>
              ) : (
                <>
                  <div className="clover-info">
                    <p>Pay securely with credit or debit card.</p>
                  </div>
                  <div className="clover-card-form">
                    <div className="clover-field">
                      <label className="clover-label">Card Number</label>
                      <div id="vm-clover-card-number" className="clover-input-container"></div>
                    </div>
                    <div className="clover-field-row">
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">Expiry</label>
                        <div id="vm-clover-card-date" className="clover-input-container"></div>
                      </div>
                      <div className="clover-field clover-field-half">
                        <label className="clover-label">CVV</label>
                        <div id="vm-clover-card-cvv" className="clover-input-container"></div>
                      </div>
                    </div>
                    <div className="clover-field">
                      <label className="clover-label">ZIP Code</label>
                      <div id="vm-clover-card-zip" className="clover-input-container"></div>
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
                      <>Pay ${amount.toFixed(2)}</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          <button className="contribution-remind-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualMeetPaymentModal;
