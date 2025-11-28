import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './InvitationManager.css';

const InvitationManager = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filterBySender, setFilterBySender] = useState('all');
  const [sendersList, setSendersList] = useState([]);
  
  // Bulk selection state
  const [selectedInvitations, setSelectedInvitations] = useState([]);
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("You're Invited to Join USVedika for US Citizens & GC Holders");
  const [bulkSending, setBulkSending] = useState(false);
  
  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Form state for new invitation
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    channel: 'email',
    customMessage: '',
    emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
    sendImmediately: true
  });

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Load invitations
  useEffect(() => {
    loadInvitations();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  // Extract unique senders when invitations load
  useEffect(() => {
    if (invitations.length > 0) {
      const uniqueSenders = [...new Set(invitations.map(inv => inv.invitedBy))];
      setSendersList(uniqueSenders.sort());
    }
  }, [invitations]);

  // Reset displayed count and selection when filter changes
  useEffect(() => {
    setDisplayedCount(20);
    setSelectedInvitations([]);
  }, [filterBySender, includeArchived]);

  const loadInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations?include_archived=${includeArchived}&status=pending`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations);
      } else {
        setError('Failed to load invitations');
      }
    } catch (err) {
      setError('Error loading invitations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/invitations/stats`, {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          channel: 'email',
          customMessage: '',
          emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
          sendImmediately: true
        });
        loadInvitations();
        loadStats();
      } else {
        const data = await response.json();
        // Handle both string errors and validation error objects
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || JSON.stringify(data.detail) || 'Failed to create invitation';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Error creating invitation: ' + err.message);
    }
  };

  const handleResend = async (invitationId, channel) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${invitationId}/resend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ channel })
        }
      );

      if (response.ok) {
        loadInvitations();
        toastService.success('Invitation resent successfully!');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to resend invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error resending invitation: ' + err.message);
    }
  };

  const handleArchive = async (invitationId) => {
    // No confirmation needed - archive is reversible

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${invitationId}/archive`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        loadInvitations();
        loadStats();
        toastService.success('Invitation archived successfully');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to archive invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error archiving invitation: ' + err.message);
    }
  };

  const handleDelete = async (invitationId) => {
    // Delete archived invitations only (2-click pattern: Archive → Delete)

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        loadInvitations();
        loadStats();
        toastService.success('Invitation deleted permanently');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to delete invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error deleting invitation: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'pending': 'status-pending',
      'sent': 'status-sent',
      'delivered': 'status-delivered',
      'failed': 'status-failed',
      'accepted': 'status-accepted',
      'expired': 'status-expired'
    };

    return (
      <span className={`btn-action ${statusClasses[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
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

  // Bulk selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all pending invitations only
      const pendingInvitations = displayedInvitations
        .filter(inv => inv.emailStatus === 'pending' && !inv.archived)
        .map(inv => inv.id);
      setSelectedInvitations(pendingInvitations);
    } else {
      setSelectedInvitations([]);
    }
  };

  const handleToggleSelection = (invitationId) => {
    setSelectedInvitations(prev => {
      if (prev.includes(invitationId)) {
        return prev.filter(id => id !== invitationId);
      } else {
        return [...prev, invitationId];
      }
    });
  };

  const handleBulkSend = async () => {
    if (selectedInvitations.length === 0) {
      toastService.error('No invitations selected');
      return;
    }

    setBulkSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/bulk-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            invitationIds: selectedInvitations,
            channel: 'email',
            emailSubject: bulkEmailSubject
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toastService.success(data.message);
        setShowBulkSendModal(false);
        setSelectedInvitations([]);
        loadInvitations();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to send invitations');
      }
    } catch (err) {
      toastService.error('Error sending bulk invitations: ' + err.message);
    } finally {
      setBulkSending(false);
    }
  };

  // Filter and slice invitations for pagination
  const filteredInvitations = invitations.filter(
    inv => filterBySender === 'all' || inv.invitedBy === filterBySender
  );
  const displayedInvitations = filteredInvitations.slice(0, displayedCount);

  if (loading) {
    return <div className="invitation-manager"><p>Loading invitations...</p></div>;
  }

  return (
    <div className="invitation-manager">
      <div className="invitation-header">
        <h1>📧 Invitation Manager</h1>
        <p className="subtitle">Manage user invitations and track registration conversions</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalInvitations}</div>
            <div className="stat-label">Total Invitations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.pendingInvitations}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptedInvitations}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptanceRate}%</div>
            <div className="stat-label">Acceptance Rate</div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar">
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            ➕ New Invitation
          </button>
          {selectedInvitations.length > 0 && (
            <button 
              className="btn-primary" 
              onClick={() => setShowBulkSendModal(true)}
              style={{ background: 'var(--success-color)' }}
            >
              📧 Send Selected ({selectedInvitations.length})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show Archived
          </label>
          
          {sendersList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-color)', fontWeight: '600' }}>
                Filter by sender:
              </label>
              <select
                value={filterBySender}
                onChange={(e) => setFilterBySender(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All ({invitations.length})</option>
                {sendersList.map(sender => {
                  const count = invitations.filter(inv => inv.invitedBy === sender).length;
                  return (
                    <option key={sender} value={sender}>
                      {sender === 'admin' ? '👤 Admin' : `👥 ${sender}`} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Invitations Table */}
      <div className="table-container">
        <table className="invitation-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedInvitations.length > 0 && selectedInvitations.length === displayedInvitations.filter(inv => inv.emailStatus === 'pending' && !inv.archived).length}
                  title="Select all pending invitations"
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Comments</th>
              <th>Email Subject</th>
              <th>Invited By</th>
              <th>Email Status</th>
              <th>Action</th>
              <th>SMS</th>
              <th>SMS Status</th>
              <th>Action</th>
              <th>Time Lapse</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvitations.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                  No invitations found. Create your first invitation!
                </td>
              </tr>
            ) : (
              displayedInvitations.map((invitation) => (
                <tr key={invitation.id} className={invitation.archived ? 'archived-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    {invitation.emailStatus === 'pending' && !invitation.archived && (
                      <input
                        type="checkbox"
                        checked={selectedInvitations.includes(invitation.id)}
                        onChange={() => handleToggleSelection(invitation.id)}
                      />
                    )}
                  </td>
                  <td>{invitation.name}</td>
                  <td>
                    <a href={`mailto:${invitation.email}`}>{invitation.email}</a>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {invitation.comments || '-'}
                    </span>
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {invitation.emailSubject || 'Default subject'}
                  </td>
                  <td>
                    <span className="invited-by-badge" title={`Invited by ${invitation.invitedBy}`}>
                      {invitation.invitedBy === 'admin' ? '👤 Admin' : `👥 ${invitation.invitedBy}`}
                    </span>
                  </td>
                  <td>{getStatusBadge(invitation.emailStatus)}</td>
                  <td>
                    {invitation.emailStatus !== 'accepted' && (
                      <button
                        className="btn-action btn-email"
                        onClick={() => handleResend(invitation.id, 'email')}
                        disabled={invitation.archived}
                      >
                        {invitation.emailStatus === 'pending' ? 'Send' : 'Resend'}
                      </button>
                    )}
                  </td>
                  <td>{invitation.phone || '-'}</td>
                  <td>
                    {invitation.phone ? getStatusBadge(invitation.smsStatus) : '-'}
                  </td>
                  <td>
                    {invitation.phone && invitation.smsStatus !== 'accepted' && (
                      <button
                        className="btn-action btn-sms"
                        onClick={() => handleResend(invitation.id, 'sms')}
                        disabled={invitation.archived}
                      >
                        {invitation.smsStatus === 'pending' ? 'Send' : 'Resend'}
                      </button>
                    )}
                  </td>
                  <td>{invitation.timeLapse}</td>
                  <td>
                    <div className="action-buttons">
                      {!invitation.archived ? (
                        <button
                          className="btn-icon"
                          onClick={() => handleArchive(invitation.id)}
                          title="Archive"
                        >
                          🗄️
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(invitation.id)}
                          title="Delete Permanently"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View More Pagination */}
      {filteredInvitations.length > 0 && (
        <div className="pagination-container">
          {displayedCount < filteredInvitations.length ? (
            <div className="pagination-controls">
              <button
                className="view-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                View more ({Math.min(20, filteredInvitations.length - displayedCount)} more) of {displayedCount}/{filteredInvitations.length}
              </button>
            </div>
          ) : (
            <div className="pagination-controls">
              <div className="all-loaded-message">
                ✓ All {filteredInvitations.length} invitations loaded
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Invitation Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Invitation</h2>
              <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                <label>Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                >
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                  <option value="both">Both Email & SMS</option>
                </select>
              </div>

              <div className="form-group">
                <label>Email Subject *</label>
                <input
                  type="text"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                  required
                  placeholder="Email subject line"
                />
              </div>

              <div className="form-group">
                <label>Custom Message (Optional)</label>
                <textarea
                  value={formData.customMessage}
                  onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                  rows="3"
                  placeholder="Add a personal message to the invitation..."
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.sendImmediately}
                    onChange={(e) => setFormData({ ...formData, sendImmediately: e.target.checked })}
                  />
                  Send invitation immediately
                </label>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Send Modal */}
      {showBulkSendModal && (
        <div className="modal-overlay" onClick={() => !bulkSending && setShowBulkSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>📧 Send Bulk Invitations</h2>
              <button className="btn-close" onClick={() => setShowBulkSendModal(false)} disabled={bulkSending}>✕</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ 
                background: 'var(--info-bg)', 
                padding: '15px', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '20px',
                border: '1px solid var(--info-color)'
              }}>
                <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '14px' }}>
                  📊 <strong>{selectedInvitations.length} invitations</strong> selected and ready to send
                </p>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Email Subject Line:
                </label>
                <input
                  type="text"
                  value={bulkEmailSubject}
                  onChange={(e) => setBulkEmailSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-color)',
                    fontSize: '14px'
                  }}
                  disabled={bulkSending}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  This subject line will be used for all selected invitations
                </p>
              </div>

              <div style={{ 
                background: 'var(--warning-bg)', 
                padding: '12px', 
                borderRadius: 'var(--radius-md)', 
                marginTop: '20px',
                border: '1px solid var(--warning-color)'
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                  ⚠️ <strong>Note:</strong> Emails will be sent immediately. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowBulkSendModal(false)}
                disabled={bulkSending}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleBulkSend}
                disabled={bulkSending}
                style={{ background: 'var(--success-color)' }}
              >
                {bulkSending ? '⏳ Sending...' : `📧 Send ${selectedInvitations.length} Invitation${selectedInvitations.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications handled by ToastContainer in App.js */}
    </div>
  );
};

export default InvitationManager;
