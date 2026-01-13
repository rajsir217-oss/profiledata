import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PaymentResult.css';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="payment-result-page cancel">
      <div className="result-container">
        <div className="result-icon cancel-icon">✕</div>
        <h1>Payment Cancelled</h1>
        <p className="result-message">
          Your payment was cancelled. No charges were made to your account.
        </p>
        <p className="result-subtext">
          If you experienced any issues or have questions, please contact our support team.
        </p>
        <div className="result-actions">
          <button className="btn-primary" onClick={() => navigate('/pricing')}>
            Try Again
          </button>
          <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
