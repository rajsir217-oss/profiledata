import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getBackendUrl } from '../config/apiConfig';
import DeleteButton from './DeleteButton';
import './ActivitySummaryPanel.css';

const ActivitySummaryPanel = ({ username, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activatingStatus, setActivatingStatus] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  // Reminder send state — 'email' | 'sms' while in flight, null otherwise.
  // `reminderToast` shows a transient success/error message under the buttons.
  const [reminderSending, setReminderSending] = useState(null);
  const [reminderToast, setReminderToast] = useState(null);
  const [grantMonths, setGrantMonths] = useState(1);
  const [grantConfirming, setGrantConfirming] = useState(null);
  const [grantLoading, setGrantLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeConfirming, setRevokeConfirming] = useState(false);
  const navigate = useNavigate();

  // Fire a single contribution reminder (email or SMS) to this profile's user.
  // Backend endpoint is admin/moderator gated and uses the same shared service
  // as the bulk scheduler jobs, so behavior matches the recurring reminders.
  const sendContributionReminder = async (channel) => {
    if (!username || reminderSending) return;
    setReminderSending(channel);
    setReminderToast(null);
    try {
      const res = await api.post(
        `${getBackendUrl()}/api/contributions/admin/send-reminder`,
        { username, channel },
      );
      const ok = res?.data?.success !== false;
      setReminderToast({
        type: ok ? 'success' : 'error',
        text: ok
          ? `${channel === 'email' ? '📧 Email' : '📱 SMS'} reminder sent to @${username}`
          : (res?.data?.message || 'Failed to send reminder'),
      });
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to send reminder';
      setReminderToast({ type: 'error', text: detail });
    } finally {
      setReminderSending(null);
      // Auto-clear the toast after 4s so the panel doesn't accumulate stale msgs.
      setTimeout(() => setReminderToast(null), 4000);
    }
  };

  // Reset user's membership for testing payment flow
  const handleResetMembership = async () => {
    if (!username) return;
    setShowResetConfirmModal(true);
  };

  const confirmResetMembership = async () => {
    setShowResetConfirmModal(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBackendUrl()}/api/contributions/membership/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (data.success) {
        setReminderToast({
          type: 'success',
          text: `✅ Membership reset for @${username}`
        });
        // Reload activity data to show updated status
        const activityRes = await api.get(`/user-activity-summary/${username}`);
        setData(activityRes.data);
        // Dispatch event to update TopBar membership status
        window.dispatchEvent(new CustomEvent('membershipChanged'));
      } else {
        setReminderToast({
          type: 'error',
          text: data.message || 'Failed to reset membership'
        });
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to reset membership';
      setReminderToast({ type: 'error', text: detail });
    } finally {
      setTimeout(() => setReminderToast(null), 4000);
    }
  };

  const handleGrantMembership = async (months) => {
    if (!username || grantLoading) return;
    setGrantLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBackendUrl()}/api/contributions/membership/grant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, months })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || `Grant failed (${res.status})`);
      }
      setReminderToast({
        type: 'success',
        text: `✅ Granted ${months} month${months > 1 ? 's' : ''} to @${username}`
      });
      const activityRes = await api.get(`/user-activity-summary/${username}`);
      setData(activityRes.data);
      window.dispatchEvent(new CustomEvent('membershipChanged'));
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to grant membership';
      setReminderToast({ type: 'error', text: detail });
    } finally {
      setGrantLoading(false);
      setGrantConfirming(null);
      setTimeout(() => setReminderToast(null), 4000);
    }
  };

  const handleGrantClick = () => {
    if (grantConfirming === grantMonths) {
      handleGrantMembership(grantMonths);
    } else {
      setGrantConfirming(grantMonths);
    }
  };

  const handleRevokeMembership = async () => {
    if (!username || revokeLoading) return;
    if (!data?.membership?.adminGranted) {
      setReminderToast({
        type: 'error',
        text: 'Only admin-granted memberships can be revoked'
      });
      setTimeout(() => setReminderToast(null), 4000);
      return;
    }
    const match = data.membership?.type?.match(/^(\d+)_month$/);
    const grantedMonths = match ? parseInt(match[1], 10) : null;
    if (!grantedMonths || grantedMonths !== grantMonths) {
      setReminderToast({
        type: 'error',
        text: 'Selected month does not match the admin-granted membership'
      });
      setTimeout(() => setReminderToast(null), 4000);
      return;
    }
    setRevokeLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${getBackendUrl()}/api/contributions/membership/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.detail || result.message || `Revoke failed (${res.status})`);
      }
      setReminderToast({
        type: 'success',
        text: `✅ Membership revoked for @${username}`
      });
      const activityRes = await api.get(`/user-activity-summary/${username}`);
      setData(activityRes.data);
      window.dispatchEvent(new CustomEvent('membershipChanged'));
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Failed to revoke membership';
      setReminderToast({ type: 'error', text: detail });
    } finally {
      setRevokeLoading(false);
      setTimeout(() => setReminderToast(null), 4000);
    }
  };

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
    const m = data?.membership;
    if (m?.type) {
      const match = m.type.match(/^(\d+)_month$/);
      if (match) {
        setGrantMonths(parseInt(match[1], 10));
      }
    }
  }, [data?.membership?.type]);

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

  const shortDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const accountStatusNormalized = String(d?.accountStatus || '').toLowerCase();
  const isPendingAdminApproval = accountStatusNormalized === 'pending_admin_approval';
  const isAdminViewer = (localStorage.getItem('userRole') || '').toLowerCase() === 'admin';

  const grantedAdminMonths = d.membership?.adminGranted && d.membership?.type ? parseInt(d.membership.type, 10) : null;
  const revokeAllowed = Number.isFinite(grantedAdminMonths) && grantedAdminMonths === grantMonths;

  const handleActivateAccount = async () => {
    if (!username || activatingStatus) return;
    setActivatingStatus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/admin/users/${encodeURIComponent(username)}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'active',
          reason: 'Activated from activity summary panel'
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || 'Failed to activate account');
      }

      setReminderToast({ type: 'success', text: `✅ @${username} activated successfully` });
      const refreshed = await api.get(`/user-activity-summary/${username}`);
      setData(refreshed.data);
      window.dispatchEvent(new CustomEvent('membershipChanged'));
    } catch (e) {
      const detail = e?.message || 'Failed to activate account';
      setReminderToast({ type: 'error', text: detail });
    } finally {
      setActivatingStatus(false);
      setTimeout(() => setReminderToast(null), 4000);
    }
  };

  return (
    <div className="activity-panel-overlay" onClick={onClose}>
      <div className="activity-panel" onClick={(e) => e.stopPropagation()}>
        <div className="activity-panel-header">
          <h3>📊 Activity Summary — @{username}</h3>
          <button className="activity-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="activity-panel-body">
          {reminderToast ? (
            <div className={`reminder-toast reminder-toast-${reminderToast.type}`}>
              {reminderToast.text}
            </div>
          ) : null}
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
                <div className="activity-status-actions">
                  <span className={`activity-status-badge status-${accountStatusNormalized}`}>{d.accountStatus}</span>
                  {isAdminViewer && isPendingAdminApproval && (
                    <button
                      type="button"
                      className="activity-status-activate-btn"
                      onClick={handleActivateAccount}
                      disabled={activatingStatus}
                    >
                      {activatingStatus ? 'Activating...' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
              {d.profileCompletion != null && (
                <div className="activity-item">
                  <span className="activity-label">Profile Completion</span>
                  <span className="activity-value">{d.profileCompletion}%</span>
                </div>
              )}
              <div className="activity-item activity-item-slim">
                <span className="activity-label">Activity (last 7 days)</span>
                <span className="activity-label">{d.recentActivity?.last7Days || 0} actions</span>
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
              <div className="activity-item">
                <span className="activity-label">Last Login Location</span>
                <span className="activity-value">{d.authentication?.lastLoginLocation || '—'}</span>
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

          {/* Membership */}
          <div className="activity-section">
            <h4>👑 Membership</h4>
            <div className="activity-stats-row">
              <div className="activity-stat">
                <span className="stat-number">{d.membership?.status || 'none'}</span>
                <span className="stat-label">Status</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">{d.membership?.type || '—'}</span>
                <span className="stat-label">Type</span>
              </div>
              <div className="activity-stat">
                <span className="stat-number">${(d.membership?.totalPaid || 0).toFixed(2)}</span>
                <span className="stat-label">Total Paid</span>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Start</span>
                <span className="activity-value">{formatDate(d.membership?.startDate)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">End</span>
                <span className="activity-value">{d.membership?.endDate ? formatDate(d.membership.endDate) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Contributions */}
          <div className="activity-section">
            <div className="activity-section-header">
              <h4>💝 Contributions</h4>
              {/* Tiny inline reminder buttons — admin/moderator only on the
                  backend; rendered for everyone here but the API rejects with
                  403 if the caller isn't privileged (caught by the toast). */}
              <div className="contribution-reminder-actions">
                <button
                  type="button"
                  className="reminder-mini-btn"
                  title="Send unpaid contribution reminder via email"
                  disabled={reminderSending !== null}
                  onClick={() => sendContributionReminder('email')}
                >
                  {reminderSending === 'email' ? '⏳' : '📧'}
                </button>
                <button
                  type="button"
                  className="reminder-mini-btn"
                  title="Send unpaid contribution reminder via SMS"
                  disabled={reminderSending !== null}
                  onClick={() => sendContributionReminder('sms')}
                >
                  {reminderSending === 'sms' ? '⏳' : '📱'}
                </button>
              </div>
            </div>
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
              <div className="activity-stat">
                <button
                  className="activity-reset-membership-btn"
                  onClick={handleResetMembership}
                  title="Reset membership to test payment flow"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="activity-label">Last Contribution</span>
                <span className="activity-value">{formatDate(d.contributions?.lastContribution)}</span>
              </div>
              {isAdminViewer && (
                <div className="activity-item">
                  <span className="activity-label">Grant Access</span>
                  <div className="admin-action-btns">
                    <select
                      className="month-grant-select"
                      value={String(grantMonths)}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        setGrantMonths(m);
                        setGrantConfirming(null);
                      }}
                      disabled={grantLoading}
                      title="Months to grant"
                    >
                      <option value="1">1 month</option>
                      <option value="2">2 months</option>
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                      <option value="24">24 months</option>
                      <option value="36">36 months</option>
                    </select>
                    <button
                      className={`btn-micro ${grantConfirming === grantMonths ? 'btn-micro-success' : 'btn-micro-primary'}`}
                      onClick={handleGrantClick}
                      disabled={grantLoading}
                      title={grantConfirming === grantMonths ? 'Click to confirm grant' : 'Grant membership'}
                    >
                      {grantLoading ? '⏳' : (grantConfirming === grantMonths ? '✓' : '📅')}
                    </button>
                    {grantConfirming === grantMonths && (
                      <span className="grant-confirm-text">Click again to grant</span>
                    )}
                    <DeleteButton
                      onDelete={handleRevokeMembership}
                      onConfirmStateChange={setRevokeConfirming}
                      itemName={
                        d.membership?.adminGranted
                          ? `admin-granted ${d.membership?.type || 'membership'} ending ${shortDate(d.membership?.endDate)}`
                          : 'membership (not admin-granted)'
                      }
                      size="small"
                      icon="🗑️"
                      confirmIcon="✓"
                      confirmText="Revoke?"
                      disabled={revokeLoading || !revokeAllowed}
                    />
                    {revokeConfirming && revokeAllowed && (
                      <span className="revoke-confirm-text">
                        Revoke admin-granted {d.membership?.type} ending {shortDate(d.membership?.endDate)}?
                      </span>
                    )}
                    {!d.membership?.adminGranted && (
                      <span className="revoke-confirm-text">No admin grant to revoke</span>
                    )}
                    {d.membership?.adminGranted && !revokeAllowed && Number.isFinite(grantedAdminMonths) && (
                      <span className="revoke-confirm-text">
                        Select {grantedAdminMonths} month{grantedAdminMonths > 1 ? 's' : ''} to revoke
                      </span>
                    )}
                  </div>
                </div>
              )}
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

      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="activity-modal-overlay" onClick={() => setShowResetConfirmModal(false)}>
          <div className="activity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="activity-modal-header">
              <h3>Reset Membership</h3>
              <button className="activity-close-btn" onClick={() => setShowResetConfirmModal(false)}>✕</button>
            </div>
            <div className="activity-modal-body">
              <p>Are you sure you want to reset the membership for <strong>@{username}</strong>?</p>
              <p style={{ color: 'var(--danger-color)', marginTop: '12px' }}>
                ⚠️ This will remove their current membership and they will need to pay again.
              </p>
            </div>
            <div className="activity-modal-footer">
              <button
                className="activity-modal-btn activity-modal-btn-secondary"
                onClick={() => setShowResetConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="activity-modal-btn activity-modal-btn-danger"
                onClick={confirmResetMembership}
              >
                Reset Membership
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivitySummaryPanel;
