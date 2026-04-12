import React, { useState, useEffect } from 'react';
import api from '../api';
import logger from '../utils/logger';
import toastService from '../services/toastService';

const InactivityAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    totalInactive: 0,
    escalationTiers: {
      "15": { count: 0, sent: 0, reactivated: 0 },
      "30": { count: 0, sent: 0, reactivated: 0 },
      "60": { count: 0, sent: 0, reactivated: 0 }
    },
    channelEffectiveness: {
      email: { sent: 0, opened: 0, clicked: 0 },
      sms: { sent: 0, delivered: 0 },
      push: { sent: 0, opened: 0 }
    },
    reactivationRate: 0,
    optOutRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [jobId, setJobId] = useState('');
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [testModal, setTestModal] = useState({
    show: false,
    username: '',
    escalationDays: 15,
    channels: ['email']
  });

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, jobId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange) params.append('date_range', dateRange);
      if (jobId) params.append('job_id', jobId);

      const response = await api.get(`/api/admin/engagement/inactivity-analytics?${params}`);
      setAnalytics(response.data);
    } catch (error) {
      logger.error('Error loading inactivity analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInactiveUsers = async (days) => {
    try {
      const response = await api.get(`/api/admin/engagement/inactive-users?days=${days}&limit=100`);
      setInactiveUsers(response.data);
      setShowInactiveUsers(true);
    } catch (error) {
      logger.error('Error loading inactive users:', error);
    }
  };

  const sendTestReminder = async () => {
    try {
      const response = await api.post('/api/admin/engagement/inactivity-test', testModal);
      
      if (response.data.success) {
        toastService.success(`Test reminder sent to ${testModal.username} via ${response.data.sent.join(', ')}`);
        setTestModal({ show: false, username: '', escalationDays: 15, channels: ['email'] });
      } else {
        toastService.error('Failed to send test reminder');
      }
    } catch (error) {
      logger.error('Error sending test reminder:', error);
      toastService.error('Error sending test reminder');
    }
  };

  const getReactivationRate = (tier) => {
    const stats = analytics.escalationTiers[tier];
    if (!stats || stats.sent === 0) return 0;
    return ((stats.reactivated / stats.sent) * 100).toFixed(1);
  };

  const getChannelRate = (channel, metric) => {
    const stats = analytics.channelEffectiveness[channel];
    if (!stats || stats.sent === 0) return 0;
    const value = stats[metric] || stats.delivered || stats.opened || 0;
    return ((value / stats.sent) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="admin-section">
        <h3>🔄 Inactivity Analytics</h3>
        <div className="loading-spinner">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h3>🔄 Inactivity Analytics</h3>
        <div className="analytics-controls">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="analytics-select"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          
          <button 
            onClick={() => setTestModal({ ...testModal, show: true })}
            className="btn btn-primary"
          >
            🧪 Send Test
          </button>
          
          <button onClick={loadAnalytics} className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card">
          <h4>Total Inactive Users</h4>
          <div className="summary-value">{analytics.totalInactive.toLocaleString()}</div>
        </div>
        
        <div className="summary-card">
          <h4>Reactivation Rate</h4>
          <div className="summary-value">{analytics.reactivationRate}%</div>
        </div>
        
        <div className="summary-card">
          <h4>Opt-Out Rate</h4>
          <div className="summary-value">{analytics.optOutRate}%</div>
        </div>
      </div>

      {/* Escalation Tier Performance */}
      <div className="analytics-section">
        <h4>📊 Escalation Tier Performance</h4>
        <div className="tier-grid">
          {Object.entries(analytics.escalationTiers).map(([days, stats]) => (
            <div key={days} className="tier-card">
              <h5>{days}-Day Inactivity</h5>
              <div className="tier-stats">
                <div className="stat-row">
                  <span className="stat-label">Inactive Users:</span>
                  <span className="stat-value">{stats.count.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Reminders Sent:</span>
                  <span className="stat-value">{stats.sent.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Reactivated:</span>
                  <span className="stat-value">{stats.reactivated.toLocaleString()}</span>
                </div>
                <div className="stat-row highlight">
                  <span className="stat-label">Rate:</span>
                  <span className="stat-value">{getReactivationRate(days)}%</span>
                </div>
                <button 
                  onClick={() => loadInactiveUsers(days)}
                  className="btn btn-sm btn-outline"
                >
                  View Users
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Effectiveness */}
      <div className="analytics-section">
        <h4>📡 Channel Effectiveness</h4>
        <div className="channel-grid">
          {Object.entries(analytics.channelEffectiveness).map(([channel, stats]) => (
            <div key={channel} className="channel-card">
              <h5>{channel.toUpperCase()}</h5>
              <div className="channel-stats">
                <div className="stat-row">
                  <span className="stat-label">Sent:</span>
                  <span className="stat-value">{stats.sent.toLocaleString()}</span>
                </div>
                {stats.delivered !== undefined && (
                  <div className="stat-row">
                    <span className="stat-label">Delivered:</span>
                    <span className="stat-value">{stats.delivered.toLocaleString()}</span>
                  </div>
                )}
                {stats.opened !== undefined && (
                  <div className="stat-row">
                    <span className="stat-label">Opened:</span>
                    <span className="stat-value">{stats.opened.toLocaleString()}</span>
                  </div>
                )}
                <div className="stat-row highlight">
                  <span className="stat-label">Rate:</span>
                  <span className="stat-value">
                    {getChannelRate(channel, 'opened') || getChannelRate(channel, 'delivered')}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inactive Users Modal */}
      {showInactiveUsers && (
        <div className="modal-overlay" onClick={() => setShowInactiveUsers(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Inactive Users</h4>
              <button className="modal-close" onClick={() => setShowInactiveUsers(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="users-table">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>First Name</th>
                      <th>Days Inactive</th>
                      <th>Last Login</th>
                      <th>Login Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.map((user) => (
                      <tr key={user.username}>
                        <td>{user.username}</td>
                        <td>{user.firstName || '-'}</td>
                        <td>{user.daysInactive}</td>
                        <td>{new Date(user.lastLogin).toLocaleDateString()}</td>
                        <td>{user.loginCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Reminder Modal */}
      {testModal.show && (
        <div className="modal-overlay" onClick={() => setTestModal({ ...testModal, show: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>🧪 Send Test Reminder</h4>
              <button className="modal-close" onClick={() => setTestModal({ ...testModal, show: false })}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={testModal.username}
                  onChange={(e) => setTestModal({ ...testModal, username: e.target.value })}
                  placeholder="Enter username"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>Escalation Days:</label>
                <select
                  value={testModal.escalationDays}
                  onChange={(e) => setTestModal({ ...testModal, escalationDays: parseInt(e.target.value) })}
                  className="form-select"
                >
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Channels:</label>
                <div className="checkbox-group">
                  {['email', 'sms', 'push'].map((channel) => (
                    <label key={channel} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={testModal.channels.includes(channel)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTestModal({ 
                              ...testModal, 
                              channels: [...testModal.channels, channel] 
                            });
                          } else {
                            setTestModal({ 
                              ...testModal, 
                              channels: testModal.channels.filter(c => c !== channel) 
                            });
                          }
                        }}
                      />
                      {channel.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setTestModal({ ...testModal, show: false })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={sendTestReminder}
                className="btn btn-primary"
                disabled={!testModal.username || testModal.channels.length === 0}
              >
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .analytics-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin: 2rem 0;
        }

        .summary-card {
          background: var(--card-background);
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          text-align: center;
        }

        .summary-card h4 {
          margin: 0 0 0.5rem 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .summary-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--primary-color);
        }

        .analytics-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .analytics-select {
          padding: 0.5rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--card-background);
          color: var(--text-color);
        }

        .tier-grid, .channel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .tier-card, .channel-card {
          background: var(--card-background);
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .tier-card h5, .channel-card h5 {
          margin: 0 0 1rem 0;
          color: var(--text-color);
          font-size: 1.1rem;
          font-weight: 600;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .stat-row:last-child {
          border-bottom: none;
        }

        .stat-row.highlight {
          background: var(--primary-color);
          color: white;
          padding: 0.75rem;
          border-radius: var(--radius-md);
          margin-top: 0.5rem;
          font-weight: 600;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .stat-value {
          font-weight: 600;
          color: var(--text-color);
        }

        .users-table {
          max-height: 400px;
          overflow-y: auto;
        }

        .users-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th,
        .users-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .users-table th {
          background: var(--surface-color);
          font-weight: 600;
          position: sticky;
          top: 0;
        }

        .checkbox-group {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .loading-spinner {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default InactivityAnalytics;
