import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ActivitySummaryPanel.css';

const ActivitySummaryPanel = ({ username, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/user-activity-summary/${username}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load activity summary');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let relative;
    if (diffMins < 1) relative = 'just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays < 30) relative = `${diffDays}d ago`;
    else relative = `${Math.floor(diffDays / 30)}mo ago`;

    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${relative} (${dateStr} ${timeStr})`;
  };

  const userLink = (uname) => {
    if (!uname) return null;
    return (
      <span
        className="activity-user-link"
        onClick={() => navigate(`/profile/${uname}`)}
      >
        @{uname}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="activity-panel-overlay" onClick={onClose}>
        <div className="activity-panel" onClick={(e) => e.stopPropagation()}>
          <div className="activity-panel-loading">
            <div className="activity-spinner"></div>
            <p>Loading activity data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-panel-overlay" onClick={onClose}>
        <div className="activity-panel" onClick={(e) => e.stopPropagation()}>
          <div className="activity-panel-header">
            <h3>Activity Summary</h3>
            <button className="activity-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="activity-panel-error">{error}</div>
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="activity-panel-overlay" onClick={onClose}>
      <div className="activity-panel" onClick={(e) => e.stopPropagation()}>
        <div className="activity-panel-header">
          <h3>📊 Activity Summary — @{username}</h3>
          <button className="activity-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="activity-panel-body">
          {/* Account Overview */}
          <div className="activity-section">
            <h4>🏠 Account</h4>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Created</span>
                <span className="activity-value">{formatDate(d.accountCreated)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Status</span>
                <span className={`activity-status-badge status-${d.accountStatus}`}>{d.accountStatus}</span>
              </div>
              {d.profileCompletion != null && (
                <div className="activity-item">
                  <span className="activity-label">Profile Completion</span>
                  <span className="activity-value">{d.profileCompletion}%</span>
                </div>
              )}
              <div className="activity-item">
                <span className="activity-label">Activity (last 7 days)</span>
                <span className="activity-value highlight">{d.recentActivity?.last7Days || 0} actions</span>
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="activity-section">
            <h4>🔐 Authentication</h4>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Login</span>
                <span className="activity-value">{formatDate(d.authentication?.lastLogin)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Seen</span>
                <span className="activity-value">{formatDate(d.authentication?.lastSeen)}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="activity-section">
            <h4>💬 Messages</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.messages?.sentCount || 0}</span>
                <span className="stat-label">Sent</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.messages?.receivedCount || 0}</span>
                <span className="stat-label">Received</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.messages?.uniqueConversations || 0}</span>
                <span className="stat-label">Conversations</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Sent</span>
                <span className="activity-value">{formatDate(d.messages?.lastSent)} {userLink(d.messages?.lastSentTo)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Received</span>
                <span className="activity-value">{formatDate(d.messages?.lastReceived)} {userLink(d.messages?.lastReceivedFrom)}</span>
              </div>
            </div>
          </div>

          {/* PII Requests */}
          <div className="activity-section">
            <h4>🔒 Data Requests (PII)</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.piiRequests?.sentCount || 0}</span>
                <span className="stat-label">Sent</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.piiRequests?.receivedCount || 0}</span>
                <span className="stat-label">Received</span>
              </div>
              <div className="activity-stat approved">
                <span className="stat-number">{d.piiRequests?.approvedCount || 0}</span>
                <span className="stat-label">Approved</span>
              </div>
              <div className="activity-stat denied">
                <span className="stat-number">{d.piiRequests?.deniedCount || 0}</span>
                <span className="stat-label">Denied</span>
              </div>
              <div className="activity-stat pending">
                <span className="stat-number">{d.piiRequests?.pendingCount || 0}</span>
                <span className="stat-label">Pending</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Sent</span>
                <span className="activity-value">{formatDate(d.piiRequests?.lastSent)} {userLink(d.piiRequests?.lastSentTo)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Received</span>
                <span className="activity-value">{formatDate(d.piiRequests?.lastReceived)} {userLink(d.piiRequests?.lastReceivedFrom)}</span>
              </div>
            </div>
          </div>

          {/* Favorites */}
          <div className="activity-section">
            <h4>⭐ Favorites</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.favorites?.count || 0}</span>
                <span className="stat-label">Favorited</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.favorites?.favoritedByCount || 0}</span>
                <span className="stat-label">Favorited By</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Favorited</span>
                <span className="activity-value">{formatDate(d.favorites?.lastFavorite)} {userLink(d.favorites?.lastFavoriteUser)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Favorited By</span>
                <span className="activity-value">{formatDate(d.favorites?.lastFavoritedBy)} {userLink(d.favorites?.lastFavoritedByUser)}</span>
              </div>
            </div>
          </div>

          {/* Shortlists */}
          <div className="activity-section">
            <h4>📋 Shortlists</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.shortlists?.count || 0}</span>
                <span className="stat-label">Shortlisted</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.shortlists?.shortlistedByCount || 0}</span>
                <span className="stat-label">Shortlisted By</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Shortlisted</span>
                <span className="activity-value">{formatDate(d.shortlists?.lastShortlisted)} {userLink(d.shortlists?.lastShortlistedUser)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Shortlisted By</span>
                <span className="activity-value">{formatDate(d.shortlists?.lastShortlistedBy)} {userLink(d.shortlists?.lastShortlistedByUser)}</span>
              </div>
            </div>
          </div>

          {/* Profile Views */}
          <div className="activity-section">
            <h4>👁️ Profile Views</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.profileViews?.received || 0}</span>
                <span className="stat-label">Views Received</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.profileViews?.made || 0}</span>
                <span className="stat-label">Views Made</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Viewed By</span>
                <span className="activity-value">{formatDate(d.profileViews?.lastViewReceived)} {userLink(d.profileViews?.lastViewReceivedBy)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Profile Viewed</span>
                <span className="activity-value">{formatDate(d.profileViews?.lastViewMade)} {userLink(d.profileViews?.lastViewMadeOf)}</span>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="activity-section">
            <h4>🔔 Notifications</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.notifications?.emailCount || 0}</span>
                <span className="stat-label">Emails</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.notifications?.smsCount || 0}</span>
                <span className="stat-label">SMS</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Email</span>
                <span className="activity-value">{formatDate(d.notifications?.lastEmail)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last SMS</span>
                <span className="activity-value">{formatDate(d.notifications?.lastSms)}</span>
              </div>
            </div>
          </div>

          {/* Searches */}
          <div className="activity-section">
            <h4>🔍 Search Activity</h4>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Total Searches</span>
                <span className="activity-value">{d.searches?.count || 0}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Last Search</span>
                <span className="activity-value">{formatDate(d.searches?.lastSearch)}</span>
              </div>
            </div>
          </div>

          {/* Contributions */}
          <div className="activity-section">
            <h4>💝 Contributions</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">${(d.contributions?.totalAmount || 0).toFixed(2)}</span>
                <span className="stat-label">Total</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.contributions?.count || 0}</span>
                <span className="stat-label">Contributions</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">${(d.contributions?.averageAmount || 0).toFixed(2)}</span>
                <span className="stat-label">Avg Amount</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.contributions?.recurringCount || 0}</span>
                <span className="stat-label">Recurring</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Contribution</span>
                <span className="activity-value">{formatDate(d.contributions?.lastContribution)}</span>
              </div>
            </div>

            {/* Latest 10 contributions grid */}
            {d.contributions?.recent && d.contributions.recent.length > 0 ? (
              <div className="activity-table-wrapper">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th className="align-right">Amount</th>
                      <th>Type</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.contributions.recent.map((c) => (
                      <tr key={c.id}>
                        <td>{c.date ? new Date(c.date).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit'
                        }) : '—'}</td>
                        <td className="align-right amount-cell">${Number(c.amount || 0).toFixed(2)}</td>
                        <td>
                          <span className={`contrib-type-badge type-${c.type}`}>
                            {c.type === 'recurring' ? 'Recurring' : 'One-time'}
                          </span>
                        </td>
                        <td>{c.paymentMethod || '—'}</td>
                        <td>
                          <span className={`contrib-status-badge status-${(c.status || '').toLowerCase()}`}>
                            {c.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.contributions.count > d.contributions.recent.length && (
                  <p className="activity-table-footer">
                    Showing latest {d.contributions.recent.length} of {d.contributions.count}
                  </p>
                )}
              </div>
            ) : (
              <p className="activity-empty">No contributions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySummaryPanel;
