import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import LoadMore from './LoadMore';
import './InviteFriends.css';

const InviteFriends = () => {
  const location = useLocation();
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // User's promo code (auto-applied, hidden from UI)
  const [userPromoCode, setUserPromoCode] = useState('USVEDIKA');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    channel: 'email',
    emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
    customMessage: '',
    sendImmediately: true
  });

  const loadInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/user-invitations/my-invitations`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      } else {
        toastService.error('Failed to load invitations');
      }
    } catch (err) {
      toastService.error('Error loading invitations: ' + err.message);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/user-invitations/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadUserPromoCode = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/my-code`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.promoCode) {
          setUserPromoCode(data.promoCode);
        }
      }
    } catch (err) {
      console.error('Error loading user promo code:', err);
      // Keep default USVEDIKA
    }
  };

  const loadData = async () => {
    await Promise.all([loadInvitations(), loadStats(), loadUserPromoCode()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if modal should be opened automatically (from navigation state)
  useEffect(() => {
    if (location.state?.openModal) {
      setShowAddModal(true);
      // Clear the state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // ESC key handler to close modal (Modal 1 style requirement)
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showAddModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      // Auto-apply user's promo code to the invitation
      const invitationData = {
        ...formData,
        promoCode: userPromoCode
      };
      console.log('📤 Sending invitation with promo code:', invitationData);
      const response = await fetch(`${getBackendUrl()}/api/user-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(invitationData)
      });

      console.log('📥 Response status:', response.status);
      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          channel: 'email',
          emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
          customMessage: '',
          sendImmediately: true
        });
        toastService.success('Invitation sent successfully!');
        loadData();
      } else {
        const data = await response.json();
        console.error('❌ Error response:', data);
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to send invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      console.error('❌ Exception:', err);
      toastService.error('Error sending invitation: ' + err.message);
    }
  };

  const handleResend = async (invitationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/user-invitations/${invitationId}/resend?channel=email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        toastService.success('Invitation resent!');
        loadData();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to resend');
      }
    } catch (err) {
      toastService.error('Error: ' + err.message);
    }
  };

  const handleCancel = async (invitationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/user-invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        toastService.success('Invitation cancelled');
        loadData();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to cancel');
      }
    } catch (err) {
      toastService.error('Error: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending': { class: 'status-pending', label: 'Pending' },
      'sent': { class: 'status-sent', label: 'Sent' },
      'delivered': { class: 'status-delivered', label: 'Delivered' },
      'failed': { class: 'status-failed', label: 'Failed' },
      'accepted': { class: 'status-accepted', label: 'Accepted ✓' },
      'expired': { class: 'status-expired', label: 'Expired' }
    };

    const config = statusConfig[status] || statusConfig['pending'];

    return (
      <span className={`status-badge ${config.class}`}>
        {config.label}
      </span>
    );
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => prev + 20);
      setLoadingMore(false);
    }, 300);
  };

  // Slice invitations for pagination
  const displayedInvitations = invitations.slice(0, displayedCount);

  if (loading) {
    return <div className="invite-friends"><p>Loading...</p></div>;
  }

  return (
    <div className="invite-friends">
      <div className="invite-header">
        <h1>👥 Invite Friends & Family</h1>
        <p className="subtitle">Share L3V3LMATCH with people you care about</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalSent}</div>
            <div className="stat-label">Total Sent</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.accepted}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-value">{stats.remaining}</div>
            <div className="stat-label">Remaining</div>
            <div className="stat-note">of {stats.maxAllowed} total</div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar">
        <button 
          className="btn-primary" 
          onClick={() => setShowAddModal(true)}
          disabled={stats && stats.remaining === 0}
        >
          ➕ Invite Someone
        </button>
        {stats && stats.remaining === 0 && (
          <span className="limit-message">
            ⚠️ You've reached your invitation limit
          </span>
        )}
      </div>

      {/* Invitations List */}
      <div className="invitations-container">
        {invitations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📧</div>
            <h3>No invitations yet</h3>
            <p>Invite your friends and family to join L3V3LMATCH!</p>
            {stats && stats.remaining > 0 && (
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                Send Your First Invitation
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="invitations-list">
              {displayedInvitations.map((invitation) => (
              <div 
                key={invitation.id} 
                className={`invitation-card ${invitation.archived ? 'archived' : ''}`}
              >
                <div className="invitation-info">
                  <div className="invitation-name">
                    {invitation.name}
                  </div>
                  <div className="invitation-email">
                    <a href={`mailto:${invitation.email}`}>{invitation.email}</a>
                  </div>
                  <div className="invitation-meta">
                    Sent {invitation.timeLapse}
                  </div>
                </div>
                
                <div className="invitation-status">
                  {getStatusBadge(invitation.emailStatus)}
                </div>
                
                <div className="invitation-actions">
                  {invitation.emailStatus === 'accepted' ? (
                    <span className="success-text">
                      ✓ Joined as {invitation.registeredUsername}
                    </span>
                  ) : invitation.archived ? (
                    <span className="cancelled-text">Cancelled</span>
                  ) : (
                    <>
                      <button
                        className="btn-action btn-resend"
                        onClick={() => handleResend(invitation.id)}
                        title="Resend invitation"
                      >
                        📤 Resend
                      </button>
                      <button
                        className="btn-action btn-cancel"
                        onClick={() => handleCancel(invitation.id)}
                        title="Cancel invitation"
                      >
                        ✕ Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              ))}
            </div>

            {/* Load More Component */}
            <LoadMore
              currentCount={Math.min(displayedCount, invitations.length)}
              totalCount={invitations.length}
              onLoadMore={handleLoadMore}
              loading={loadingMore}
              itemsPerLoad={20}
              itemLabel="invitations"
            />
          </>
        )}
      </div>

      {/* Add Invitation Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👥 Invite Someone</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Friend's name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="friend@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone (Optional)</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div className="form-group">
                <label>Email Subject *</label>
                <input
                  type="text"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                  placeholder="Email subject line"
                  required
                />
              </div>

              <div className="form-group">
                <label>Personal Message (Optional)</label>
                <textarea
                  value={formData.customMessage}
                  onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                  rows="3"
                  placeholder="Add a personal note to your invitation..."
                />
                <small className="form-hint">
                  💡 Tip: Add a personal touch to encourage them to join!
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  📤 Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteFriends;
