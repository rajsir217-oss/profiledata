import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import './PaymentResult.css';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifyPayment(sessionId);
    } else {
      setVerifying(false);
    }
  }, [searchParams]);

  const verifyPayment = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/stripe/verify-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });
      const data = await response.json();
      if (data.success && data.status === 'paid') {
        setVerified(true);
        setPaymentDetails(data);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="payment-result-page">
        <div className="result-container">
          <div className="spinner"></div>
          <h2>Verifying your payment...</h2>
          <p>Please wait while we confirm your transaction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page success">
      <div className="result-container">
        <div className="result-icon success-icon">✓</div>
        <h1>Payment Successful!</h1>
        <p className="result-message">
          {verified 
            ? 'Your premium membership has been activated.'
            : 'Thank you for your purchase. Your membership is being processed.'}
        </p>
        {paymentDetails && (
          <div className="payment-details">
            <p><strong>Amount:</strong> ${paymentDetails.amountTotal?.toFixed(2)}</p>
            {paymentDetails.customerEmail && (
              <p><strong>Receipt sent to:</strong> {paymentDetails.customerEmail}</p>
            )}
          </div>
        )}
        <div className="result-actions">
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
          <button className="btn-secondary" onClick={() => navigate('/search')}>
            Start Searching
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
