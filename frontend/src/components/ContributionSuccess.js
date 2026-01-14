import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import './PaymentResult.css';

const ContributionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [contributionDetails, setContributionDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyContribution = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getBackendUrl()}/api/stripe/verify-contribution`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sessionId })
        });

        const data = await response.json();

        if (data.success) {
          setContributionDetails(data);
          // Mark contribution as completed
          localStorage.setItem('contribution_completed', 'true');
          localStorage.setItem('last_contribution_date', new Date().toISOString());
        } else {
          setError(data.detail || 'Failed to verify contribution');
        }
      } catch (err) {
        console.error('Error verifying contribution:', err);
        setError('Failed to verify contribution');
      } finally {
        setLoading(false);
      }
    };

    verifyContribution();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="payment-result-container">
        <div className="payment-result-card">
          <div className="loading-spinner"></div>
          <h2>Verifying your contribution...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-container">
      <div className="payment-result-card success">
        <div className="result-icon success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1>Thank You! 💜</h1>
        <p className="result-message">
          Your generous contribution helps us keep the platform running and improving.
        </p>

        {contributionDetails && (
          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">Amount:</span>
              <span className="detail-value">${contributionDetails.amount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Type:</span>
              <span className="detail-value">
                {contributionDetails.isRecurring ? 'Monthly Recurring' : 'One-time'}
              </span>
            </div>
            {contributionDetails.email && (
              <div className="detail-row">
                <span className="detail-label">Receipt sent to:</span>
                <span className="detail-value">{contributionDetails.email}</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="result-note warning">{error}</p>
        )}

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
            Start Searching
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContributionSuccess;
