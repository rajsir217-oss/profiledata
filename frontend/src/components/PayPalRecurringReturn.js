import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './PayPalRecurringReturn.css';

const PayPalRecurringReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const completeRecurringSetup = async () => {
      const setupTokenId = searchParams.get('token');
      const paypalPayerId = searchParams.get('PayerID');
      
      if (!setupTokenId) {
        setError('No setup token found');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        
        // First create the payment token from setup token
        const paymentTokenResponse = await fetch(`${getBackendUrl()}/api/paypal/create-payment-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            setup_token_id: setupTokenId
          })
        });

        const paymentTokenData = await paymentTokenResponse.json();

        if (!paymentTokenData.success) {
          setError(paymentTokenData.detail || 'Failed to create payment token');
          setLoading(false);
          return;
        }

        // Get the saved amount from localStorage (temporarily stored during setup)
        const savedAmount = localStorage.getItem('recurring_setup_amount');
        const amount = savedAmount ? parseFloat(savedAmount) : 10.00;

        // Now set up the recurring contribution
        const recurringResponse = await fetch(`${getBackendUrl()}/api/contributions/recurring/setup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: amount,
            recurring_days: 30,
            paypal_vault_id: paymentTokenData.vault_id,
            notes: 'Monthly platform support contribution'
          })
        });

        const recurringData = await recurringResponse.json();

        if (recurringData.id) {
          // Success!
          setSuccess(true);
          toastService.success('✅ Monthly contribution set up successfully!');
          
          // Clean up localStorage
          localStorage.removeItem('recurring_setup_amount');
          // Notify the contribution hook to re-check eligibility.
          window.dispatchEvent(new Event('contributionMade'));
          
          // Redirect after a delay
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        } else {
          setError(recurringData.detail || 'Failed to set up recurring contribution');
        }
      } catch (err) {
        console.error('Recurring setup error:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    completeRecurringSetup();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="paypal-return-container">
        <div className="paypal-return-card">
          <div className="paypal-return-loading">
            <div className="spinner"></div>
            <h2>Setting up your monthly contribution...</h2>
            <p>Please wait while we complete the setup with PayPal.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="paypal-return-container">
        <div className="paypal-return-card error">
          <div className="paypal-return-error">
            <div className="error-icon">❌</div>
            <h2>Setup Failed</h2>
            <p>{error}</p>
            <button 
              className="retry-btn"
              onClick={() => navigate('/contribute')}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="paypal-return-container">
        <div className="paypal-return-card success">
          <div className="paypal-return-success">
            <div className="success-icon">✅</div>
            <h2>Monthly Contribution Set Up!</h2>
            <p>Thank you for your ongoing support! Your monthly contribution is now active.</p>
            <p>You will be charged automatically each month.</p>
            <p>Redirecting to dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PayPalRecurringReturn;
