import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './PIIManagement.css';

const PIIManagement = () => {
  const [activeTab, setActiveTab] = useState('granted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const [grantedAccess, setGrantedAccess] = useState([]);
  const [receivedAccess, setReceivedAccess] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
      return;
    }
    loadAllData();
  }, [currentUsername]);

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const [grantedRes, receivedRes, incomingRes, outgoingRes] = await Promise.all([
        api.get(`/pii-access/${currentUsername}/granted`),
        api.get(`/pii-access/${currentUsername}/received`),
        api.get(`/pii-requests/${currentUsername}/incoming?status_filter=pending`),
        api.get(`/pii-requests/${currentUsername}/outgoing`)
      ]);

      setGrantedAccess(grantedRes.data.grantedAccess || []);
      setReceivedAccess(receivedRes.data.receivedAccess || []);
      setIncomingRequests(incomingRes.data.requests || []);
      setOutgoingRequests(outgoingRes.data.requests || []);
    } catch (err) {
      console.error('Error loading PII data:', err);
      setError('Failed to load PII management data');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (accessIds, username) => {
    if (!window.confirm(`Revoke all access for ${username}?`)) return;

    try {
      // Revoke all access types for this user
      await Promise.all(
        accessIds.map(id => api.delete(`/pii-access/${id}?username=${currentUsername}`))
      );
      
      // Reload data
      await loadAllData();
    } catch (err) {
      console.error('Error revoking access:', err);
      setError('Failed to revoke access');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await api.put(`/pii-requests/${requestId}/approve?username=${currentUsername}`);
      await loadAllData();
    } catch (err) {
      console.error('Error approving request:', err);
      setError('Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.put(`/pii-requests/${requestId}/reject?username=${currentUsername}`);
      await loadAllData();
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError('Failed to reject request');
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await api.delete(`/pii-requests/${requestId}?username=${currentUsername}`);
      await loadAllData();
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError('Failed to cancel request');
    }
  };

  const getAccessTypeLabel = (type) => {
    const labels = {
      'images': '📷 Photos',
      'contact_info': '📧 Contact Info',
      'dob': '🎂 Date of Birth'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { label: 'Pending', class: 'badge-pending' },
      'approved': { label: 'Approved', class: 'badge-approved' },
      'rejected': { label: 'Rejected', class: 'badge-rejected' },
      'cancelled': { label: 'Cancelled', class: 'badge-cancelled' }
    };
    return badges[status] || { label: status, class: 'badge-default' };
  };

  const renderAccessCard = (item, type) => {
    const profile = item.userProfile;
    const isGranted = type === 'granted';

    return (
      <div key={profile.username} className="access-card">
        <div className="access-card-header">
          <div className="user-info">
            {profile.images?.[0] ? (
              <img src={profile.images[0]} alt={profile.username} className="access-avatar" />
            ) : (
              <div className="access-avatar-placeholder">
                {profile.firstName?.[0] || profile.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <h4>{profile.firstName || profile.username}</h4>
              <p className="access-username">@{profile.username}</p>
            </div>
          </div>
        </div>

        <div className="access-card-body">
          <div className="access-types">
            {item.accessTypes.map(type => (
              <span key={type} className="access-type-badge">
                {getAccessTypeLabel(type)}
              </span>
            ))}
          </div>
          <p className="access-date">
            {isGranted ? 'Granted' : 'Received'}: {new Date(item.grantedAt).toLocaleDateString()}
          </p>
        </div>

        {isGranted && (
          <div className="access-card-actions">
            <button
              className="btn-revoke"
              onClick={() => handleRevokeAccess(item.accessIds, profile.username)}
            >
              🚫 Revoke Access
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderRequestCard = (request, isIncoming) => {
    const profile = isIncoming ? request.requesterProfile : request.profileOwner;
    const badge = getStatusBadge(request.status);

    return (
      <div key={request.id} className="request-card">
        <div className="request-card-header">
          <div className="user-info">
            {profile.images?.[0] ? (
              <img src={profile.images[0]} alt={profile.username} className="access-avatar" />
            ) : (
              <div className="access-avatar-placeholder">
                {profile.firstName?.[0] || profile.username[0].toUpperCase()}
              </div>
            )}
            <div>
              <h4>{profile.firstName || profile.username}</h4>
              <p className="access-username">@{profile.username}</p>
            </div>
          </div>
          <span className={`status-badge ${badge.class}`}>{badge.label}</span>
        </div>

        <div className="request-card-body">
          <div className="request-type">
            <strong>Requested:</strong> {getAccessTypeLabel(request.requestType)}
          </div>
          {request.message && (
            <div className="request-message">
              <strong>Message:</strong> {request.message}
            </div>
          )}
          <p className="request-date">
            Requested: {new Date(request.requestedAt).toLocaleString()}
          </p>
        </div>

        {request.status === 'pending' && (
          <div className="request-card-actions">
            {isIncoming ? (
              <>
                <button
                  className="btn-approve"
                  onClick={() => handleApproveRequest(request.id)}
                >
                  ✅ Approve
                </button>
                <button
                  className="btn-reject"
                  onClick={() => handleRejectRequest(request.id)}
                >
                  ❌ Reject
                </button>
              </>
            ) : (
              <button
                className="btn-cancel"
                onClick={() => handleCancelRequest(request.id)}
              >
                🚫 Cancel Request
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="pii-loading">
        <div className="spinner-border text-primary"></div>
        <p>Loading PII management data...</p>
      </div>
    );
  }

  return (
    <div className="pii-management-page">
      <div className="pii-header">
        <h2>🔒 Privacy & Data Management</h2>
        <p>Manage who can access your private information</p>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible">
          {error}
          <button onClick={() => setError('')} className="btn-close">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="pii-tabs">
        <button
          className={`pii-tab ${activeTab === 'granted' ? 'active' : ''}`}
          onClick={() => setActiveTab('granted')}
        >
          <span className="tab-icon">🔓</span>
          <span className="tab-label">Access I've Granted</span>
          <span className="tab-count">{grantedAccess.length}</span>
        </button>
        <button
          className={`pii-tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          <span className="tab-icon">✅</span>
          <span className="tab-label">Access I Have</span>
          <span className="tab-count">{receivedAccess.length}</span>
        </button>
        <button
          className={`pii-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <span className="tab-icon">📬</span>
          <span className="tab-label">Pending Requests</span>
          <span className="tab-count">{incomingRequests.length + outgoingRequests.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pii-tab-content">
        {activeTab === 'granted' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>People Who Can See Your Information</h3>
              <p>You've granted these users access to your private data</p>
            </div>
            {grantedAccess.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🔒</span>
                <p>You haven't granted access to anyone yet</p>
              </div>
            ) : (
              <div className="access-grid">
                {grantedAccess.map(item => renderAccessCard(item, 'granted'))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'received' && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Information You Can Access</h3>
              <p>These users have granted you access to their private data</p>
            </div>
            {receivedAccess.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>You don't have access to anyone's private information yet</p>
              </div>
            ) : (
              <div className="access-grid">
                {receivedAccess.map(item => renderAccessCard(item, 'received'))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="tab-panel">
            {/* Incoming Requests */}
            <div className="requests-section">
              <div className="panel-header">
                <h3>Requests to You ({incomingRequests.length})</h3>
                <p>People requesting access to your information</p>
              </div>
              {incomingRequests.length === 0 ? (
                <div className="empty-state-small">
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="request-grid">
                  {incomingRequests.map(req => renderRequestCard(req, true))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="requests-section">
              <div className="panel-header">
                <h3>Your Requests ({outgoingRequests.length})</h3>
                <p>Requests you've sent to others</p>
              </div>
              {outgoingRequests.length === 0 ? (
                <div className="empty-state-small">
                  <p>No requests sent</p>
                </div>
              ) : (
                <div className="request-grid">
                  {outgoingRequests.map(req => renderRequestCard(req, false))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PIIManagement;
