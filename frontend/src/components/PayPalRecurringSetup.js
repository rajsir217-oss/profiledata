import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import './PayPalRecurringSetup.css';

const PayPalRecurringSetup = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [setupToken, setSetupToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get setup token from localStorage
    const token = localStorage.getItem('paypal_setup_token_id');
    const amount = localStorage.getItem('recurring_setup_amount');
    
    if (!token || !amount) {
      navigate('/contribute');
      return;
    }
    
    setSetupToken(token);
    
    // First get PayPal client ID from backend
    const loadPayPalSDK = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/paypal/client-id`);
        const data = await response.json();
        
        if (data.client_id) {
          // Load PayPal SDK with dynamic client ID
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${data.client_id}&vault=true&intent=setup`;
          script.addEventListener('load', () => {
            setLoading(false);
            renderPayPalButton(token);
          });
          script.addEventListener('error', () => {
            setError('PayPal SDK failed to load. This might be due to an ad blocker. Please disable ad blockers and try again.');
            setLoading(false);
          });
          document.body.appendChild(script);
        } else {
          setError('PayPal is not configured. Please contact support.');
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to initialize PayPal. Please try again.');
        setLoading(false);
        console.error(err);
      }
    };
    
    loadPayPalSDK();
    
    return () => {
      const scripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      scripts.forEach(script => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      });
    };
  }, [navigate]);

  const renderPayPalButton = (token) => {
    console.log('PayPal SDK loaded, rendering buttons with token:', token);
    
    if (window.paypal) {
      window.paypal.Buttons({
        // Call your server to set up the transaction
        createSetupToken: () => {
          console.log('Creating setup token with:', token);
          return token;
        },
        
        onApprove: async (data, actions) => {
          console.log('PayPal approved:', data);
          try {
            // Create payment token from setup token
            const response = await fetch(`${getBackendUrl()}/api/paypal/create-payment-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                setup_token_id: data.setupTokenId
              })
            });
            
            const result = await response.json();
            console.log('Payment token result:', result);
            
            if (result.payment_token_id) {
              // Save payment token and create recurring contribution
              await createRecurringContribution(result.payment_token_id);
            } else {
              setError(result.detail || 'Failed to save payment method');
            }
          } catch (err) {
            setError('An error occurred. Please try again.');
            console.error(err);
          }
        },
        
        onCancel: () => {
          console.log('PayPal cancelled');
          navigate('/contribute');
        },
        
        onError: (err) => {
          console.error('PayPal error:', err);
          setError('PayPal encountered an error. Please try again.');
        }
      }).render('#paypal-button-container');
    } else {
      console.error('PayPal SDK not loaded');
      setError('PayPal SDK failed to load. Please refresh the page.');
    }
  };

  const createRecurringContribution = async (paymentToken) => {
    try {
      const amount = localStorage.getItem('recurring_setup_amount');
      const response = await fetch(`${getBackendUrl()}/api/contributions/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payment_method: 'paypal',
          payment_token_id: paymentToken,
          recurring_days: 30
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Clear localStorage
        localStorage.removeItem('paypal_setup_token_id');
        localStorage.removeItem('recurring_setup_amount');
        
        // Redirect to success page
        navigate('/contribution/success', { 
          state: { 
            type: 'recurring',
            amount: amount,
            message: 'Your monthly contribution has been set up successfully!' 
          } 
        });
      } else {
        setError(result.detail || 'Failed to set up recurring contribution');
      }
    } catch (err) {
      setError('An error occurred while saving your contribution. Please try again.');
      console.error(err);
    }
  };

  const handleCancel = () => {
    navigate('/contribute');
  };

  if (loading) {
    return (
      <div className="paypal-setup-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading PayPal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="paypal-setup-container">
      <div className="paypal-setup-card">
        <h2>Set Up Monthly Contribution</h2>
        <p className="setup-description">
          You're setting up a monthly contribution of ${localStorage.getItem('recurring_setup_amount')}.
          Click the button below to approve the payment with PayPal.
        </p>
        
        {error && (
          <div className="error-message">
            {error}
            <div className="error-actions">
              <button 
                className="retry-btn" 
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
              <button 
                className="back-btn" 
                onClick={handleCancel}
              >
                Back to Contribution
              </button>
            </div>
          </div>
        )}
        
        <div id="paypal-button-container">
          <div className="paypal-loading-text">Loading PayPal buttons...</div>
        </div>
        
        <button className="cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PayPalRecurringSetup;
