import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import { createApiInstance } from '../api';
import './ContributionSlideOut.css';

const pollsApi = createApiInstance();

/**
 * Slide-out version of ContributionPopup for poll RSVP payments
 * Reuses all payment logic from ContributionPopup but with slide-out UI
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onComplete: () => void
 *  - pollData: { pollId, optionId, paymentAmount, pollTitle }
 */
const PollPaymentSlideOut = ({ isOpen, onClose, onComplete, pollData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const [paypalKey, setPaypalKey] = useState(0);
  const paypalContainerRef = useRef(null);
  const paypalScriptLoaded = useRef(false);
  const paypalInitialized = useRef(false);
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [cloverLoading, setCloverLoading] = useState(false);
  const [cloverReady, setCloverReady] = useState(false);
  const [cloverConfig, setCloverConfig] = useState(null);
  const cloverInstanceRef = useRef(null);
  const cloverMountedRef = useRef(false);
  const [cloverSuccess, setCloverSuccess] = useState(false);

  const amount = pollData?.paymentAmount || 5.00;
  const slideRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Initialize PayPal when slide opens
  useEffect(() => {
    if (isOpen && paymentMethod === 'paypal') {
      console.log('🚀 Opening slide-out, loading PayPal...');
      loadPayPalScript();
    }
  }, [isOpen, paymentMethod]);

  // Load PayPal script (simplified)
  const loadPayPalScript = useCallback(async () => {
    try {
      // Get PayPal client ID from backend
      const response = await pollsApi.get('/api/paypal/client-id');
      const clientId = response.data.clientId;
      
      console.log('🔑 Got PayPal client ID:', clientId);
      
      // Clear any existing PayPal
      if (paypalContainerRef.current) {
        paypalContainerRef.current.innerHTML = '';
      }
      
      // Load PayPal SDK if not already loaded
      if (!window.paypal) {
        console.log('📦 Loading PayPal SDK...');
        const script = document.createElement('script');
        // Only disable the legacy PayPal Credit funding source. Keep 'card'
        // so the "Debit or Credit Card" button renders alongside PayPal.
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&disable-funding=credit`;
        script.async = true;
        script.onload = () => {
          console.log('✅ PayPal SDK loaded, rendering buttons...');
          renderPayPalButtons(clientId);
        };
        script.onerror = () => {
          console.error('❌ Failed to load PayPal SDK');
          setPaypalFailed(true);
          setError('Failed to load PayPal. Please refresh and try again.');
        };
        document.head.appendChild(script);
      } else {
        console.log('🔧 PayPal already loaded, rendering buttons...');
        renderPayPalButtons(clientId);
      }
    } catch (err) {
      console.error('❌ Error loading PayPal:', err);
      setPaypalFailed(true);
      setError('Failed to initialize payment. Please try again.');
    }
  }, []);

  // Render PayPal buttons (simplified)
  const renderPayPalButtons = useCallback((clientId) => {
    if (!paypalContainerRef.current) {
      console.log('❌ Container not ready');
      return;
    }

    if (!window.paypal?.Buttons) {
      console.log('❌ PayPal.Buttons not available');
      return;
    }

    console.log('✅ Rendering PayPal buttons in container...');
    console.log('📦 Container before:', paypalContainerRef.current.innerHTML);
    console.log('📏 Container dimensions:', {
      width: paypalContainerRef.current.offsetWidth,
      height: paypalContainerRef.current.offsetHeight,
      visible: paypalContainerRef.current.offsetParent !== null
    });

    setPaypalReady(true);

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
        try {
          setLoading(true);
          setError('');
          
          // Use same endpoint as ContributionPopup
          const response = await pollsApi.post('/api/paypal/create-order', {
            amount: amount.toFixed(2),
            currency: 'USD',
            plan_id: 'poll_rsvp',
            description: `RSVP Payment - $${amount.toFixed(2)}`
          });
          
          if (response.data.order_id) {
            return response.data.order_id;
          }
          throw new Error(response.data.detail || 'Failed to create order');
        } catch (err) {
          setError('Failed to create payment. Please try again.');
          setLoading(false);
          throw err;
        }
      },
      onApprove: async (data) => {
        try {
          setLoading(true);

          // Backend /pay-and-respond captures the PayPal order server-side,
          // so we MUST NOT call /api/paypal/capture-order here (double capture causes 400).
          const payload = {
            poll_id: pollData.pollId,
            selected_options: [pollData.optionId],
            payment_required: true,
            payment_status: 'completed',
            payment_amount: amount,
            payment_id: data.orderID,
            payment_method: 'paypal'
          };

          const pollResponse = await pollsApi.post(`/api/polls/${pollData.pollId}/pay-and-respond`, payload);

          if (pollResponse.data.success) {
            onComplete();
          } else {
            setError(pollResponse.data.detail || 'Failed to submit RSVP');
          }
        } catch (err) {
          setError('Payment confirmation failed. Please contact support.');
        } finally {
          setLoading(false);
        }
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        setError('Payment failed. Please try again.');
        setLoading(false);
      },
      onCancel: () => {
        setLoading(false);
      }
    }).render(paypalContainerRef.current).then(() => {
      console.log('✅ PayPal button successfully rendered to container');
      setTimeout(() => {
        console.log('🔍 Final container state:', {
          innerHTML: paypalContainerRef.current.innerHTML,
          children: paypalContainerRef.current.children.length,
          iframes: paypalContainerRef.current.querySelectorAll('iframe').length
        });
      }, 2000);
    }).catch((err) => {
      console.error('❌ Failed to render PayPal button:', err);
      setPaypalFailed(true);
      setError('Failed to render PayPal button. Please try again.');
    });
  }, [amount, pollData, onComplete]);

  // Reset PayPal when closed
  useEffect(() => {
    if (!isOpen) {
      // Simple reset when closed
      setTimeout(() => {
        setPaypalReady(false);
        setPaypalFailed(false);
        console.log('🔄 PayPal state reset on close');
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  console.log('💳 PollPaymentSlideOut rendering:', { isOpen, pollData });

  return (
    <>
      {/* Backdrop */}
      <div className="contribution-slideout-backdrop" onClick={onClose}></div>
      
      {/* Slide-out panel */}
      <div ref={slideRef} className={`contribution-slideout-panel ${isOpen ? 'open' : ''}`}>
        <div className="contribution-slideout-header">
          <div className="contribution-slideout-title">
            <h3>Complete Your RSVP</h3>
            <p>Payment required to confirm your attendance</p>
          </div>
          <button className="contribution-slideout-close" onClick={onClose}>×</button>
        </div>
        
        <div className="contribution-slideout-body">
          {/* Event Details */}
          <div className="contribution-event-details">
            <h4>{pollData?.pollTitle}</h4>
            <div className="contribution-amount-display">
              <span>Amount:</span>
              <span className="contribution-amount">${amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="contribution-payment-methods">
            <h5>Choose Payment Method</h5>
            
            {/* PayPal Option */}
            <div className="contribution-payment-method">
              <div className="contribution-method-header">
                <div className="contribution-method-info">
                  <input 
                    type="radio" 
                    id="paypal" 
                    name="payment-method" 
                    value="paypal"
                    defaultChecked
                    readOnly
                  />
                  <label htmlFor="paypal">
                    <strong>PayPal</strong>
                    <span>Pay with PayPal account or card</span>
                  </label>
                </div>
                <div className="paypal-logo">
                  <img src="https://www.paypalobjects.com/webstatic/mktg/logo/AM_SbyPP_mc_vs_ms_ae.png" alt="PayPal" />
                </div>
              </div>
              
              <div className="paypal-button-container">
                <div ref={paypalContainerRef}></div>
                {paypalFailed && (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ color: 'var(--danger-color)', marginBottom: '0.5rem' }}>
                      PayPal unavailable
                    </div>
                    <button 
                      className="contribution-cancel-btn"
                      onClick={() => {
                        setPaypalFailed(false);
                        loadPayPalScript();
                      }}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!paypalReady && !paypalFailed && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem'
                  }}>
                    <div className="contribution-spinner"></div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Loading PayPal...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Clover Option (if available) */}
            {cloverConfig && (
              <div className="contribution-payment-method">
                <div className="contribution-method-header">
                  <div className="contribution-method-info">
                    <input 
                      type="radio" 
                      id="clover" 
                      name="payment-method" 
                      value="clover"
                      onChange={() => setPaymentMethod('clover')}
                    />
                    <label htmlFor="clover">
                      <strong>Credit Card</strong>
                      <span>Pay securely with credit card</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="contribution-error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="contribution-loading-state">
              <div className="contribution-spinner"></div>
              <span>Processing payment...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="contribution-slideout-footer">
          <button 
            className="contribution-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default PollPaymentSlideOut;
