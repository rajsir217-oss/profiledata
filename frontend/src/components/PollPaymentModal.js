import React, { useState, useEffect, useRef } from 'react';
import { createApiInstance } from '../api';
import './PollPaymentModal.css';

const pollsApi = createApiInstance();

/**
 * Simple payment modal for poll RSVP responses
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onComplete: () => void
 *  - pollData: { pollId, optionId, paymentAmount, pollTitle }
 */
const PollPaymentModal = ({ isOpen, onClose, onComplete, pollData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('paypal');
  const [paypalReady, setPaypalReady] = useState(false);
  const paypalContainerRef = useRef(null);

  const amount = pollData?.paymentAmount || 5.00;

  console.log('💳 PollPaymentModal:', { isOpen, pollData });

  // Initialize PayPal
  useEffect(() => {
    if (isOpen && paymentMethod === 'paypal' && !paypalReady) {
      console.log('🔧 Loading PayPal...');
      loadPayPalScript();
    }
  }, [isOpen, paymentMethod, paypalReady]);

  const loadPayPalScript = async () => {
    try {
      // Get PayPal client ID from backend
      const response = await pollsApi.get('/api/paypal/client-id');
      const clientId = response.data.clientId;
      
      if (window.paypal) {
        renderPayPalButton(clientId);
        return;
      }

      const script = document.createElement('script');
      // Only disable the legacy PayPal Credit funding source. Keep 'card'
      // so the "Debit or Credit Card" button renders.
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&disable-funding=credit`;
      script.onload = () => renderPayPalButton(clientId);
      script.onerror = () => setError('Failed to load PayPal. Please refresh and try again.');
      document.body.appendChild(script);
    } catch (err) {
      setError('Failed to initialize payment. Please refresh and try again.');
    }
  };

  const renderPayPalButton = (clientId) => {
    console.log('🔧 renderPayPalButton called:', { 
      container: !!paypalContainerRef.current, 
      paypal: !!window.paypal,
      buttons: !!window.paypal?.Buttons 
    });
    
    if (!paypalContainerRef.current || !window.paypal?.Buttons) {
      console.log('❌ Cannot render PayPal button:', {
        hasContainer: !!paypalContainerRef.current,
        hasPaypal: !!window.paypal,
        hasButtons: !!window.paypal?.Buttons
      });
      return;
    }

    console.log('✅ Rendering PayPal button with client ID:', clientId);

    window.paypal.Buttons({
      createOrder: async (data, actions) => {
        try {
          // Create order on backend
          const response = await pollsApi.post('/api/paypal/create-order', {
            amount: amount,
            description: `RSVP Payment: ${pollData?.pollTitle}`
          });
          
          if (response.data.success) {
            return response.data.orderId;
          }
          throw new Error('Failed to create payment order');
        } catch (err) {
          setError('Failed to create payment. Please try again.');
          throw err;
        }
      },
      onApprove: async (data, actions) => {
        try {
          setLoading(true);
          
          // Capture payment and submit poll response
          const payload = {
            poll_id: pollData.pollId,
            selected_options: [pollData.optionId],
            payment_required: true,
            payment_status: 'completed',
            payment_amount: amount,
            payment_id: data.orderID,
            payment_method: 'paypal'
          };

          const response = await pollsApi.post(`/api/polls/${pollData.pollId}/pay-and-respond`, payload);
          
          if (response.data.success) {
            onComplete();
          } else {
            setError(response.data.detail || 'Payment failed. Please try again.');
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
      }
    }).render(paypalContainerRef.current);

    setPaypalReady(true);
  };

  if (!isOpen) return null;

  return (
    <div className="poll-payment-modal-overlay">
      <div className="poll-payment-modal">
        <div className="poll-payment-header">
          <h3>Confirm Your RSVP</h3>
          <button className="poll-payment-close" onClick={onClose}>×</button>
        </div>
        
        <div className="poll-payment-body">
          <div className="poll-payment-event">
            <h4>{pollData?.pollTitle}</h4>
            <p>Payment required to confirm "Yes" RSVP</p>
          </div>
          
          <div className="poll-payment-amount">
            <span className="amount-label">Amount:</span>
            <span className="amount-value">${amount.toFixed(2)}</span>
          </div>

          {error && (
            <div className="poll-payment-error">
              {error}
            </div>
          )}

          {paymentMethod === 'paypal' && (
            <div className="poll-payment-paypal">
              <div ref={paypalContainerRef} className="paypal-button-container"></div>
            </div>
          )}

          <div className="poll-payment-footer">
            <button 
              className="poll-payment-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollPaymentModal;
