import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createApiInstance } from '../api';
import './PollPaymentInline.css';

const pollsApi = createApiInstance();

/**
 * Inline payment component for poll RSVP responses
 * Appears directly in the poll widget between options
 * Props:
 *  - isVisible: boolean
 *  - onComplete: () => void
 *  - onCancel: () => void
 *  - pollData: { pollId, optionId, paymentAmount, pollTitle }
 */
const PollPaymentInline = ({ isVisible, onComplete, onCancel, pollData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalFailed, setPaypalFailed] = useState(false);
  const paypalContainerRef = useRef(null);

  const amount = pollData?.paymentAmount || 5.00;

  // Initialize PayPal when visible
  useEffect(() => {
    if (isVisible && !paypalReady) {
      loadPayPalScript();
    }
  }, [isVisible, paypalReady]);

  // Load PayPal script
  const loadPayPalScript = useCallback(async () => {
    try {
      // Get PayPal client ID from backend
      const response = await pollsApi.get('/api/paypal/client-id');
      const clientId = response.data.clientId;
      
      // Clear container
      if (paypalContainerRef.current) {
        paypalContainerRef.current.innerHTML = '';
      }
      
      // Load PayPal SDK if not already loaded
      if (!window.paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
        script.async = true;
        script.onload = () => renderPayPalButtons(clientId);
        script.onerror = () => {
          setPaypalFailed(true);
          setError('Failed to load PayPal. Please refresh and try again.');
        };
        document.head.appendChild(script);
      } else {
        renderPayPalButtons(clientId);
      }
    } catch (err) {
      setPaypalFailed(true);
      setError('Failed to initialize payment. Please try again.');
    }
  }, []);

  // Render PayPal buttons
  const renderPayPalButtons = useCallback((clientId) => {
    if (!paypalContainerRef.current || !window.paypal?.Buttons) return;

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
          
          const response = await pollsApi.post('/api/paypal/capture-order', {
            order_id: data.orderID
          });
          
          if (response.data.success) {
            // Submit poll response after successful payment
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
          } else {
            setError(response.data.detail || 'Payment failed');
          }
        } catch (err) {
          setError('Payment confirmation failed. Please contact support.');
        } finally {
          setLoading(false);
        }
      },
      onError: (err) => {
        setError('Payment failed. Please try again.');
        setLoading(false);
      },
      onCancel: () => {
        setLoading(false);
      }
    }).render(paypalContainerRef.current).catch((err) => {
      console.error('Failed to render PayPal button:', err);
      setPaypalFailed(true);
      setError('Failed to render PayPal button. Please try again.');
    });
  }, [amount, pollData, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="poll-payment-inline">
      <div className="poll-payment-header">
        <div className="poll-payment-title">
          <h4>Complete Your RSVP</h4>
          <p>Payment required to confirm your attendance</p>
        </div>
        <button className="poll-payment-close" onClick={onCancel}>×</button>
      </div>
      
      <div className="poll-payment-body">
        {/* Event Details */}
        <div className="poll-payment-event-info">
          <div className="poll-payment-event-title">{pollData?.pollTitle}</div>
          <div className="poll-payment-amount">
            <span>Amount:</span>
            <span className="amount-value">${amount.toFixed(2)}</span>
          </div>
        </div>

        {/* PayPal Container */}
        <div className="poll-payment-paypal-container">
          <div className="paypal-button-container">
            <div ref={paypalContainerRef}></div>
            {paypalFailed && (
              <div className="paypal-error-state">
                <div className="error-message">PayPal unavailable</div>
                <button 
                  className="retry-button"
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
              <div className="paypal-loading-state">
                <div className="loading-spinner"></div>
                <div>Loading PayPal...</div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="poll-payment-error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="poll-payment-loading">
            <div className="loading-spinner"></div>
            <span>Processing payment...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollPaymentInline;
