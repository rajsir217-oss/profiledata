import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './EmailAnalytics.css';
import PageHeader from './PageHeader';
import { API_ENDPOINTS } from '../config/apiConfig';

const EmailAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Email Analytics');
      navigate('/dashboard');
    } else {
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, period]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_ENDPOINTS.BASE_URL}/api/email-tracking/stats/summary?days=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      } else {
        console.error('Failed to load email analytics');
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return num?.toLocaleString() || '0';
  };

  const formatPercent = (num) => {
    return num?.toFixed(1) || '0.0';
  };

  return (
    <div className="email-analytics">
      <PageHeader
        icon="📧"
        title="Email Analytics"
        subtitle="Track email opens, clicks, and engagement"
        variant="flat"
      />

      {/* Period Selector */}
      <div className="analytics-controls">
        <div className="period-selector">
          <label>Time Period:</label>
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <button className="btn btn-secondary" onClick={loadSummary} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-icon">📨</div>
              <div className="card-content">
                <div className="card-label">Emails Sent</div>
                <div className="card-value">{formatNumber(summary.total_emails_sent)}</div>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-icon">👀</div>
              <div className="card-content">
                <div className="card-label">Total Opens</div>
                <div className="card-value">{formatNumber(summary.total_opens)}</div>
                <div className="card-sublabel">{formatPercent(summary.open_rate)}% open rate</div>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-icon">🖱️</div>
              <div className="card-content">
                <div className="card-label">Total Clicks</div>
                <div className="card-value">{formatNumber(summary.total_clicks)}</div>
                <div className="card-sublabel">{formatPercent(summary.click_through_rate)}% CTR</div>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-icon">⚡</div>
              <div className="card-content">
                <div className="card-label">Engagement</div>
                <div className="card-value">{formatPercent(summary.engagement_rate)}%</div>
                <div className="card-sublabel">
                  {formatNumber(summary.unique_emails_opened)} unique opens
                </div>
              </div>
            </div>
          </div>

          {/* Performance Indicators */}
          <div className="performance-section">
            <h3>📊 Performance Indicators</h3>
            <div className="performance-grid">
              <div className="performance-item">
                <div className="performance-label">Open Rate</div>
                <div className="performance-bar">
                  <div 
                    className="performance-fill" 
                    style={{
                      width: `${Math.min(summary.open_rate, 100)}%`,
                      backgroundColor: summary.open_rate >= 25 ? 'var(--success-color)' : 
                                     summary.open_rate >= 15 ? 'var(--warning-color)' : 
                                     'var(--danger-color)'
                    }}
                  ></div>
                </div>
                <div className="performance-value">{formatPercent(summary.open_rate)}%</div>
                <div className="performance-benchmark">
                  {summary.open_rate >= 25 ? '✅ Excellent' : 
                   summary.open_rate >= 15 ? '⚠️ Average' : 
                   '❌ Needs Improvement'}
                </div>
              </div>

              <div className="performance-item">
                <div className="performance-label">Click-Through Rate</div>
                <div className="performance-bar">
                  <div 
                    className="performance-fill" 
                    style={{
                      width: `${Math.min(summary.click_through_rate * 2, 100)}%`,
                      backgroundColor: summary.click_through_rate >= 5 ? 'var(--success-color)' : 
                                     summary.click_through_rate >= 2 ? 'var(--warning-color)' : 
                                     'var(--danger-color)'
                    }}
                  ></div>
                </div>
                <div className="performance-value">{formatPercent(summary.click_through_rate)}%</div>
                <div className="performance-benchmark">
                  {summary.click_through_rate >= 5 ? '✅ Excellent' : 
                   summary.click_through_rate >= 2 ? '⚠️ Average' : 
                   '❌ Needs Improvement'}
                </div>
              </div>

              <div className="performance-item">
                <div className="performance-label">Overall Engagement</div>
                <div className="performance-bar">
                  <div 
                    className="performance-fill" 
                    style={{
                      width: `${Math.min(summary.engagement_rate * 2, 100)}%`,
                      backgroundColor: summary.engagement_rate >= 10 ? 'var(--success-color)' : 
                                     summary.engagement_rate >= 5 ? 'var(--warning-color)' : 
                                     'var(--danger-color)'
                    }}
                  ></div>
                </div>
                <div className="performance-value">{formatPercent(summary.engagement_rate)}%</div>
                <div className="performance-benchmark">
                  {summary.engagement_rate >= 10 ? '✅ Excellent' : 
                   summary.engagement_rate >= 5 ? '⚠️ Average' : 
                   '❌ Needs Improvement'}
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="info-card">
            <h4>📈 Industry Benchmarks</h4>
            <ul>
              <li><strong>Open Rate:</strong> 15-25% is average, 25%+ is excellent</li>
              <li><strong>Click-Through Rate:</strong> 2-5% is average, 5%+ is excellent</li>
              <li><strong>Engagement:</strong> 5-10% is average, 10%+ is excellent</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>📭 No email data available for the selected period</p>
          <p className="empty-subtitle">Emails will appear here once tracking is enabled</p>
        </div>
      )}
    </div>
  );
};

export default EmailAnalytics;
