import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { emitPIIAccessChange } from '../utils/piiAccessEvents';
import PageHeader from './PageHeader';
import ImageManagerModal from './ImageManagerModal';
import './PIIManagement.css';

const PIIManagement = () => {
  const [activeTab, setActiveTab] = useState('granted');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  const navigate = useNavigate();
  
  const [grantedAccess, setGrantedAccess] = useState([]);
  const [receivedAccess, setReceivedAccess] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  
  // History data
  const [revokedAccess, setRevokedAccess] = useState([]);
  const [rejectedIncoming, setRejectedIncoming] = useState([]);
  const [rejectedOutgoing, setRejectedOutgoing] = useState([]);
  
  // ImageManager modal state
  const [showImageManager, setShowImageManager] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [ownerImages, setOwnerImages] = useState([]);
  
  const currentUsername = localStorage.getItem('username');

  // Handle tab change with backend refresh
  const handleTabChange = async (tabName) => {
    console.log(`🔄 Switching to tab: ${tabName} - Refreshing data from backend...`);
    setActiveTab(tabName);
    setLoading(true); // Show loading state
    await loadAllData(); // Refresh data from backend
    console.log(`✅ Tab ${tabName} data refreshed`);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Load PII Access data (granted/received/revoked)
      const [grantedRes, receivedRes, revokedRes] = await Promise.all([
        api.get(`/pii-access/${currentUsername}/granted`),
        api.get(`/pii-access/${currentUsername}/received`),
        api.get(`/pii-access/${currentUsername}/revoked`)
      ]);

      setGrantedAccess(grantedRes.data.grantedAccess || []);
      setReceivedAccess(receivedRes.data.receivedAccess || []);
      setRevokedAccess(revokedRes.data.grantedAccess || []);
      
      // Load PII Requests (incoming/outgoing)
      try {
        const [incomingRes, outgoingRes] = await Promise.all([
          api.get(`/pii-requests/${currentUsername}/incoming`),
          api.get(`/pii-requests/${currentUsername}/outgoing`)
        ]);
        
        // Map incoming requests (have requesterProfile)
        const mapIncomingRequest = (req) => ({
          id: req.id,
          requestType: req.requestType,
          requestedInfo: [req.requestType],
          requesterUsername: req.requesterProfile?.username,
          requesterProfile: req.requesterProfile,
          profileOwner: null,
          requestedAt: req.requestedAt,
          respondedAt: req.respondedAt,
          status: req.status,
          message: req.message
        });
        
        // Map outgoing requests (have profileOwner)
        const mapOutgoingRequest = (req) => ({
          id: req.id,
          requestType: req.requestType,
          requestedInfo: [req.requestType],
          requesterUsername: null,
          requesterProfile: null,
          profileOwner: req.profileOwner,
          requestedAt: req.requestedAt,
          respondedAt: req.respondedAt,
          status: req.status,
          message: req.message
        });
        
        const incoming = (incomingRes.data.requests || []).map(mapIncomingRequest);
        const outgoing = (outgoingRes.data.requests || []).map(mapOutgoingRequest);
        
        // Filter by status
        setIncomingRequests(incoming.filter(r => r.status === 'pending'));
        setOutgoingRequests(outgoing.filter(r => r.status === 'pending'));
        
        // Split history into rejected incoming/outgoing
        setRejectedIncoming(incoming.filter(r => r.status === 'rejected'));
        setRejectedOutgoing(outgoing.filter(r => r.status === 'rejected'));
      } catch (requestErr) {
        console.error('Error loading image access requests:', requestErr);
        // Continue even if requests fail
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setRejectedIncoming([]);
        setRejectedOutgoing([]);
      }
      
    } catch (err) {
      console.error('Error loading PII data:', err);
      setError('Failed to load PII management data');
    } finally {
      setLoading(false);
    }
  }, [currentUsername]);

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
      return;
    }
    loadAllData();
  }, [currentUsername, navigate, loadAllData]);

  const handleRevokeAccess = async (accessIds, username, accessTypes) => {
    // TODO: Replace with custom confirmation component (no browser modals per user preference)
    // For now, proceed directly with revoke
    
    try {
      console.log('🔓 Revoking access for:', username, 'AccessIDs:', accessIds);
      
      // Revoke ALL access types using PII access endpoint
      await Promise.all(
        accessIds.map(id => api.delete(`/pii-access/${id}?username=${currentUsername}`))
      );
      
      console.log('✅ Access revoked successfully');
      
      // Reload data
      await loadAllData();
      setSuccessMessage(`Access revoked for ${username} successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Emit event to notify other components
      emitPIIAccessChange('revoked', username, currentUsername);
    } catch (err) {
      console.error('Error revoking access:', err);
      setError('Failed to revoke access');
    }
  };

  const handleApproveRequest = async (request, requesterProfile) => {
    // Check if this is a photo request - if so, open ImageManager
    console.log('🔍 Approve Request Debug:', {
      request,
      requestedInfo: request.requestedInfo,
      requestType: request.requestType,
      requesterProfile
    });
    
    const requestedInfo = Array.isArray(request.requestedInfo) ? request.requestedInfo : [];
    const requestType = request.requestType || '';
    
    // Check multiple possible field names for photo requests
    const isPhotoRequest = 
      requestedInfo.includes('images') || 
      requestedInfo.includes('photos') ||
      requestType === 'images' ||
      requestType === 'photos' ||
      requestType.toLowerCase().includes('photo');
    
    console.log('📸 Is Photo Request?', isPhotoRequest);
    
    if (isPhotoRequest) {
      // Open ImageManager modal for photo requests
      try {
        // Fetch owner's images
        const profileRes = await api.get(`/profile/${currentUsername}`);
        setOwnerImages(profileRes.data.images || []);
        setSelectedRequest({ request, requesterProfile });
        setShowImageManager(true);
      } catch (err) {
        console.error('Error loading owner images:', err);
        setError('Failed to load images');
      }
      return;
    }
    
    // For non-photo requests, approve directly (permanent access)
    try {
      await api.put(`/pii-requests/${request.id}/approve?username=${currentUsername}`, {});
      await loadAllData();
      setSuccessMessage('Request approved! Access granted successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Emit event to notify other components
      emitPIIAccessChange('granted', requesterProfile.username, currentUsername);
    } catch (err) {
      console.error('Error approving request:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to approve request');
    }
  };
  
  const handleImageAccessGrant = async ({ pictureDurations, responseMessage }) => {
    if (!selectedRequest) return;
    
    const { request, requesterProfile } = selectedRequest;
    
    try {
      console.log('📸 Granting image access with durations:', pictureDurations);
      
      // Approve the PII request with individual picture durations
      const approvalData = {
        responseMessage,
        pictureDurations  // Send individual durations for each picture
      };
      
      await api.put(`/pii-requests/${request.id}/approve?username=${currentUsername}`, approvalData);
      
      // Close modal
      setShowImageManager(false);
      setSelectedRequest(null);
      
      // Reload data
      await loadAllData();
      
      // Create success message
      const hasOnetime = Object.values(pictureDurations).some(d => d === 'onetime');
      const hasPermanent = Object.values(pictureDurations).some(d => d === 'permanent');
      const hasTimed = Object.values(pictureDurations).some(d => typeof d === 'number');
      
      let accessMsg = 'Image access granted to ' + requesterProfile.firstName;
      if (hasOnetime && !hasTimed && !hasPermanent) {
        accessMsg += ' (one-time view only)';
      } else if (hasPermanent && !hasTimed && !hasOnetime) {
        accessMsg += ' (permanent access)';
      } else {
        accessMsg += ' with custom durations';
      }
      
      setSuccessMessage(accessMsg);
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Emit event to notify other components
      emitPIIAccessChange('granted', requesterProfile.username, currentUsername);
    } catch (err) {
      console.error('Error granting image access:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to grant image access. Please try again.');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.put(`/pii-requests/${requestId}/reject?username=${currentUsername}`);
      await loadAllData();
      setSuccessMessage('Request rejected successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError('Failed to reject request');
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      await api.delete(`/pii-requests/${requestId}?username=${currentUsername}`);
      await loadAllData();
      setSuccessMessage('Request cancelled successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error cancelling request:', err);
      setError('Failed to cancel request');
    }
  };

  const getAccessTypeLabel = (type) => {
    const labels = {
      'images': '📷 Photos',
      'contact_info': '📧 Contact Info',
      'date_of_birth': '🎂 Date of Birth'
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

  const handleProfileClick = (username) => {
    navigate(`/profile/${username}`);
  };

  const renderAccessCard = (item, type) => {
    const profile = item.userProfile;
    const isGranted = type === 'granted';

    return (
      <div 
        key={profile.username} 
        className="access-card clickable"
        onClick={() => handleProfileClick(profile.username)}
      >
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
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                handleRevokeAccess(item.accessIds, profile.username, item.accessTypes);
              }}
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

    // Safety check - if profile is undefined, skip rendering
    if (!profile) {
      console.error('Missing profile data for request:', request);
      return null;
    }

    return (
      <div 
        key={request.id} 
        className="request-card clickable"
        onClick={() => handleProfileClick(profile.username)}
      >
        <div className="request-card-header">
          <div className="user-info">
            {profile.images?.[0] ? (
              <img src={profile.images[0]} alt={profile.username} className="access-avatar" />
            ) : (
              <div className="access-avatar-placeholder">
                {profile.firstName?.[0] || profile.username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h4>{profile.firstName || profile.username || 'Unknown'}</h4>
              <p className="access-username">@{profile.username || 'unknown'}</p>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApproveRequest(request, profile);
                  }}
                >
                  ✅ Approve
                </button>
                <button
                  className="btn-reject"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectRequest(request.id);
                  }}
                >
                  ❌ Reject
                </button>
              </>
            ) : (
              <button
                className="btn-cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelRequest(request.id);
                }}
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
      {/* Error Message Bubble */}
      {error && (
        <div className="status-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>❌</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#721c24', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Error
            </strong>
            <p style={{ color: '#721c24', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {error}
            </p>
          </div>
          <button 
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#721c24',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Message Bubble */}
      {successMessage && (
        <div className="status-bubble" style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '350px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', flexShrink: 0 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: '#155724', display: 'block', fontSize: '13px', marginBottom: '4px' }}>
              Success
            </strong>
            <p style={{ color: '#155724', margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
              {successMessage}
            </p>
          </div>
          <button 
            onClick={() => setSuccessMessage('')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#155724',
              padding: '0',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <PageHeader
        icon="🔒"
        title="Privacy & Data Management"
        subtitle="Manage who can access your private information"
        variant="gradient"
        actions={
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ☰
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="pii-tabs">
        <button
          className={`pii-tab ${activeTab === 'granted' ? 'active' : ''}`}
          onClick={() => handleTabChange('granted')}
        >
          <span className="tab-icon">🔓</span>
          <span className="tab-label">Access I've Granted</span>
          <span className="tab-count">{grantedAccess.length}</span>
        </button>
        <button
          className={`pii-tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => handleTabChange('received')}
        >
          <span className="tab-icon">✅</span>
          <span className="tab-label">Access I Have</span>
          <span className="tab-count">{receivedAccess.length}</span>
        </button>
        <button
          className={`pii-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => handleTabChange('requests')}
        >
          <span className="tab-icon">📬</span>
          <span className="tab-label">Pending Requests</span>
          <span className="tab-count">{incomingRequests.length + outgoingRequests.length}</span>
        </button>
        <button
          className={`pii-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => handleTabChange('history')}
        >
          <span className="tab-icon">📜</span>
          <span className="tab-label">History</span>
          <span className="tab-count">{revokedAccess.length + rejectedIncoming.length + rejectedOutgoing.length}</span>
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
              <div className={viewMode === 'cards' ? 'access-grid-cards' : 'access-grid-rows'}>
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
              <div className={viewMode === 'cards' ? 'access-grid-cards' : 'access-grid-rows'}>
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
                <div className={viewMode === 'cards' ? 'request-grid-cards' : 'request-grid-rows'}>
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
                <div className={viewMode === 'cards' ? 'request-grid-cards' : 'request-grid-rows'}>
                  {outgoingRequests.map(req => renderRequestCard(req, false))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-panel">
            {/* Revoked Access */}
            <div className="requests-section">
              <div className="panel-header">
                <h3>🚫 Revoked Access ({revokedAccess.length})</h3>
                <p>Access you've revoked from others</p>
              </div>
              {revokedAccess.length === 0 ? (
                <div className="empty-state-small">
                  <p>No revoked access</p>
                </div>
              ) : (
                <div className={viewMode === 'cards' ? 'access-grid-cards' : 'access-grid-rows'}>
                  {revokedAccess.map(item => {
                    const profile = item.userProfile;
                    return (
                      <div 
                        key={profile.username} 
                        className="access-card clickable history-card"
                        onClick={() => handleProfileClick(profile.username)}
                      >
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
                          <span className="status-badge badge-cancelled">Revoked</span>
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
                            Revoked: {new Date(item.grantedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rejected Incoming Requests */}
            <div className="requests-section">
              <div className="panel-header">
                <h3>❌ Rejected Requests to You ({rejectedIncoming.length})</h3>
                <p>Requests you've rejected</p>
              </div>
              {rejectedIncoming.length === 0 ? (
                <div className="empty-state-small">
                  <p>No rejected requests</p>
                </div>
              ) : (
                <div className={viewMode === 'cards' ? 'request-grid-cards' : 'request-grid-rows'}>
                  {rejectedIncoming.map(request => {
                    const profile = request.requesterProfile;
                    return (
                      <div 
                        key={request.id} 
                        className="request-card clickable history-card"
                        onClick={() => handleProfileClick(profile.username)}
                      >
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
                          <span className="status-badge badge-rejected">Rejected</span>
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
                            Rejected: {new Date(request.respondedAt || request.requestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rejected Outgoing Requests */}
            <div className="requests-section">
              <div className="panel-header">
                <h3>⛔ Your Rejected Requests ({rejectedOutgoing.length})</h3>
                <p>Your requests that were rejected by others</p>
              </div>
              {rejectedOutgoing.length === 0 ? (
                <div className="empty-state-small">
                  <p>No rejected requests</p>
                </div>
              ) : (
                <div className={viewMode === 'cards' ? 'request-grid-cards' : 'request-grid-rows'}>
                  {rejectedOutgoing.map(request => {
                    const profile = request.profileOwner;
                    return (
                      <div 
                        key={request.id} 
                        className="request-card clickable history-card"
                        onClick={() => handleProfileClick(profile.username)}
                      >
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
                          <span className="status-badge badge-rejected">Rejected</span>
                        </div>
                        <div className="request-card-body">
                          <div className="request-type">
                            <strong>Requested:</strong> {getAccessTypeLabel(request.requestType)}
                          </div>
                          {request.message && (
                            <div className="request-message">
                              <strong>Your message:</strong> {request.message}
                            </div>
                          )}
                          <p className="request-date">
                            Rejected: {new Date(request.respondedAt || request.requestedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* ImageManager Modal for photo access grants */}
      {showImageManager && selectedRequest && (
        <ImageManagerModal
          isOpen={showImageManager}
          onClose={() => {
            setShowImageManager(false);
            setSelectedRequest(null);
          }}
          requester={selectedRequest.requesterProfile}
          ownerImages={ownerImages}
          onGrant={handleImageAccessGrant}
        />
      )}
    </div>
  );
};

export default PIIManagement;
