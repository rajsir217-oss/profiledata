import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PaymentResult.css';

const ContributionCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="payment-result-container">
      <div className="payment-result-card cancel">
        <div className="result-icon cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
          </svg>
        </div>
        
        <h1>Contribution Cancelled</h1>
        <p className="result-message">
          No worries! You can support us anytime you're ready.
        </p>

        <div className="result-actions">
          <button 
            className="btn-primary"
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </button>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/search')}
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContributionCancel;
