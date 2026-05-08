import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './UsVedikaMetrics.css';

const UsVedikaMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getBackendUrl()}/api/messenger/us-vedika/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMetrics(response.data.metrics);
      logger.info('US Vedika metrics loaded successfully');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to load metrics';
      setError(detail);
      logger.error('Failed to load US Vedika metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (email) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getBackendUrl()}/api/messenger/us-vedika/unsubscribe`, 
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info(`Removed participant ${email}`);
      loadMetrics(); // Refresh metrics
    } catch (err) {
      logger.error('Failed to remove participant:', err);
      alert('Failed to remove participant');
    }
  };

  const handleApproveParticipant = async (email) => {
    // This would typically send an approval email or update status
    logger.info(`Approved participant ${email} - sending registration invitation`);
    alert(`Registration invitation sent to ${email}`);
  };

  const handleRejectParticipant = async (email) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${getBackendUrl()}/api/messenger/us-vedika/unsubscribe`, 
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info(`Rejected participant ${email}`);
      loadMetrics(); // Refresh metrics
    } catch (err) {
      logger.error('Failed to reject participant:', err);
      alert('Failed to reject participant');
    }
  };

  if (loading) {
    return (
      <div className="uvm-page">
        <div className="uvm-container">
          <div className="uvm-loading">Loading US Vedika metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="uvm-page">
        <div className="uvm-container">
          <div className="uvm-error">{error}</div>
          <button className="uvm-btn" onClick={loadMetrics}>Retry</button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="uvm-page">
        <div className="uvm-container">
          <div className="uvm-empty">US Vedika conversation not found. Create it first via the messenger.</div>
        </div>
      </div>
    );
  }

  const { funnel, conversionRates, topInviters, publicEmailMessages, publicParticipants } = metrics;

  return (
    <div className="uvm-page">
      <div className="uvm-container">
        <h1 className="uvm-title">🇺🇸 US Vedika Invitee Metrics</h1>
        <p className="uvm-subtitle">Track conversion funnel from email invitation to registered member</p>

        {/* Funnel Metrics */}
        <div className="uvm-section">
          <h2 className="uvm-section-title">Funnel Overview</h2>
          <div className="uvm-funnel">
            <div className="uvm-funnel-step">
              <div className="uvm-funnel-number">{funnel.invited}</div>
              <div className="uvm-funnel-label">Invited</div>
              <div className="uvm-funnel-desc">Total email invites sent</div>
            </div>
            <div className="uvm-funnel-arrow">↓</div>
            <div className="uvm-funnel-step">
              <div className="uvm-funnel-number">{funnel.interested}</div>
              <div className="uvm-funnel-label">Interested</div>
              <div className="uvm-funnel-desc">Replied via email</div>
            </div>
            <div className="uvm-funnel-arrow">↓</div>
            <div className="uvm-funnel-step">
              <div className="uvm-funnel-number">{funnel.registrationInterests}</div>
              <div className="uvm-funnel-label">Reg Interest</div>
              <div className="uvm-funnel-desc">Submitted registration form</div>
            </div>
            <div className="uvm-funnel-arrow">↓</div>
            <div className="uvm-funnel-step">
              <div className="uvm-funnel-number uvm-funnel-number-success">{funnel.registered}</div>
              <div className="uvm-funnel-label">Registered</div>
              <div className="uvm-funnel-desc">Became full members</div>
            </div>
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="uvm-section">
          <h2 className="uvm-section-title">Conversion Rates</h2>
          <div className="uvm-cards">
            <div className="uvm-card">
              <div className="uvm-card-label">Invited → Interested</div>
              <div className="uvm-card-value">{conversionRates.invitedToInterested}%</div>
              <div className="uvm-card-bar">
                <div className="uvm-bar-fill" style={{ width: `${conversionRates.invitedToInterested}%` }}></div>
              </div>
            </div>
            <div className="uvm-card">
              <div className="uvm-card-label">Interested → Registered</div>
              <div className="uvm-card-value">{conversionRates.interestedToRegistered}%</div>
              <div className="uvm-card-bar">
                <div className="uvm-bar-fill" style={{ width: `${conversionRates.interestedToRegistered}%` }}></div>
              </div>
            </div>
            <div className="uvm-card">
              <div className="uvm-card-label">Overall Conversion</div>
              <div className="uvm-card-value uvm-card-value-primary">{conversionRates.overallConversion}%</div>
              <div className="uvm-card-bar">
                <div className="uvm-bar-fill uvm-bar-fill-primary" style={{ width: `${conversionRates.overallConversion}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Inviters */}
        <div className="uvm-section">
          <h2 className="uvm-section-title">Top Inviters</h2>
          <div className="uvm-table-container">
            <table className="uvm-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Invites Sent</th>
                </tr>
              </thead>
              <tbody>
                {topInviters.map((inviter, index) => (
                  <tr key={index}>
                    <td>{inviter.username}</td>
                    <td>{inviter.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Public Email Messages */}
        <div className="uvm-section">
          <h2 className="uvm-section-title">Email Activity</h2>
          <div className="uvm-stats">
            <div className="uvm-stat">
              <div className="uvm-stat-value">{publicEmailMessages}</div>
              <div className="uvm-stat-label">Public Email Replies</div>
            </div>
            <div className="uvm-stat">
              <div className="uvm-stat-value">{funnel.optedOut}</div>
              <div className="uvm-stat-label">Opted Out</div>
            </div>
          </div>
        </div>

        {/* Public Participants List */}
        <div className="uvm-section">
          <h2 className="uvm-section-title">All Public Participants ({publicParticipants.length})</h2>
          <div className="uvm-table-container">
            <table className="uvm-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Invited By</th>
                  <th>Added At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {publicParticipants.map((participant, index) => (
                  <tr key={index}>
                    <td>{participant.email}</td>
                    <td>
                      <span className={`uvm-badge uvm-badge-${participant.status}`}>
                        {participant.status}
                      </span>
                    </td>
                    <td>{participant.addedBy}</td>
                    <td>{new Date(participant.addedAt).toLocaleDateString()}</td>
                    <td>
                      {participant.status === 'invited' && (
                        <>
                          <button 
                            className="uvm-action-btn uvm-action-btn-remove"
                            onClick={() => handleRemoveParticipant(participant.email)}
                            title="Remove participant"
                          >
                            Remove
                          </button>
                        </>
                      )}
                      {participant.status === 'interested' && (
                        <>
                          <button 
                            className="uvm-action-btn uvm-action-btn-approve"
                            onClick={() => handleApproveParticipant(participant.email)}
                            title="Approve to registration"
                          >
                            Approve
                          </button>
                          <button 
                            className="uvm-action-btn uvm-action-btn-reject"
                            onClick={() => handleRejectParticipant(participant.email)}
                            title="Reject participant"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsVedikaMetrics;
