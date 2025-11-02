import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import './InvitationManager.css';

const InvitationManager = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Form state for new invitation
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    channel: 'email',
    customMessage: '',
    sendImmediately: true
  });

  // Check admin access
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Load invitations
  useEffect(() => {
    loadInvitations();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const loadInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations?include_archived=${includeArchived}`,
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
        alert('Invitation resent successfully!');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to resend invitation';
        alert(errorMsg);
      }
    } catch (err) {
      alert('Error resending invitation: ' + err.message);
    }
  };

  const handleArchive = async (invitationId) => {
    if (!window.confirm('Are you sure you want to archive this invitation?')) {
      return;
    }

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
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to archive invitation';
        alert(errorMsg);
      }
    } catch (err) {
      alert('Error archiving invitation: ' + err.message);
    }
  };

  const handleDelete = async (invitationId) => {
    if (!window.confirm('Are you sure you want to permanently delete this invitation? This cannot be undone.')) {
      return;
    }

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
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to delete invitation';
        alert(errorMsg);
      }
    } catch (err) {
      alert('Error deleting invitation: ' + err.message);
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
      <span className={`status-badge ${statusClasses[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

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
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ New Invitation
        </button>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show Archived
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Invitations Table */}
      <div className="table-container">
        <table className="invitation-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
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
            {invitations.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                  No invitations found. Create your first invitation!
                </td>
              </tr>
            ) : (
              invitations.map((invitation) => (
                <tr key={invitation.id} className={invitation.archived ? 'archived-row' : ''}>
                  <td>{invitation.name}</td>
                  <td>
                    <a href={`mailto:${invitation.email}`}>{invitation.email}</a>
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
    </div>
  );
};

export default InvitationManager;
