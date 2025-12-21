import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import api from '../api';
import { getImageUrl } from '../utils/urlHelper';
import { emitPIIAccessChange } from '../utils/piiAccessEvents';
import ImageManagerModal from './ImageManagerModal';
import UniversalTabContainer from './UniversalTabContainer';
import PIIRequestsTable from './PIIRequestsTable';
import './PIIManagement.css';

const PIIManagement = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  const [grantedAccess, setGrantedAccess] = useState([]);
  const [receivedAccess, setReceivedAccess] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [allIncomingRequests, setAllIncomingRequests] = useState([]); // All statuses for table view
  
  // History data
  const [revokedAccess, setRevokedAccess] = useState([]);
  const [expiredAccess, setExpiredAccess] = useState([]);
  const [rejectedIncoming, setRejectedIncoming] = useState([]);
  const [rejectedOutgoing, setRejectedOutgoing] = useState([]);
  
  // ImageManager modal state
  const [showImageManager, setShowImageManager] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [ownerImages, setOwnerImages] = useState([]);
  
  // Current user's visibility settings (to show "Member Visible" badges)
  const [visibilitySettings, setVisibilitySettings] = useState({
    contactEmailVisible: false,
    contactNumberVisible: false,
    linkedinUrlVisible: false
  });
  
  const currentUsername = localStorage.getItem('username');

  const getDefaultTabFromUrl = () => {
    const params = new URLSearchParams(location.search);
    const tab = (params.get('tab') || '').toLowerCase();
    const allowed = new Set(['inbox', 'sent', 'archive']);
    return allowed.has(tab) ? tab : 'inbox';
  };

  // Handle tab change (no need to reload data - it's already loaded)
  const handleTabChange = (tabId) => {
    console.log(`✅ Switched to tab: ${tabId}`);
    // Data is already loaded via useEffect, no need to reload on tab switch
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Load PII Access data (granted/received/revoked/expired)
      const [grantedRes, receivedRes, revokedRes, expiredRes, profileRes] = await Promise.all([
        api.get(`/pii-access/${currentUsername}/granted`),
        api.get(`/pii-access/${currentUsername}/received`),
        api.get(`/pii-access/${currentUsername}/revoked`),
        api.get(`/pii-access/${currentUsername}/expired`),
        api.get(`/profile/${currentUsername}`)
      ]);
      
      // Extract visibility settings from profile
      const profile = profileRes.data;
      setVisibilitySettings({
        contactEmailVisible: profile.contactEmailVisible || false,
        contactNumberVisible: profile.contactNumberVisible || false,
        linkedinUrlVisible: profile.linkedinUrlVisible || false
      });

      setGrantedAccess(grantedRes.data.grantedAccess || []);
      setReceivedAccess(receivedRes.data.receivedAccess || []);
      setRevokedAccess(revokedRes.data.grantedAccess || []);
      setExpiredAccess(expiredRes.data.expiredAccess || []);
      
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
        
        // Store all incoming requests for table view (pending, approved, rejected)
        setAllIncomingRequests(incoming);
        
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
        const allImages = profileRes.data.images || [];
        const publicImages = profileRes.data.publicImages || [];
        
        // Filter out images that are already public (member-visible)
        // IMPORTANT: Keep track of original indices for proper access control
        const privateImagesWithIndices = allImages
          .map((img, originalIndex) => ({ img, originalIndex }))
          .filter(({ img }) => {
            const imgFilename = img.split('/').pop();
            return !publicImages.some(pubImg => pubImg.split('/').pop() === imgFilename);
          });
        
        if (privateImagesWithIndices.length === 0) {
          setError('All photos are already visible to members. No private photos to grant access to.');
          return;
        }
        
        // Pass both the images and their original indices to the modal
        setOwnerImages(privateImagesWithIndices.map(p => p.img));
        setSelectedRequest({ 
          request, 
          requesterProfile,
          originalIndices: privateImagesWithIndices.map(p => p.originalIndex)
        });
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
    
    const { request, requesterProfile, originalIndices } = selectedRequest;
    
    try {
      console.log('📸 Granting image access with durations:', pictureDurations);
      console.log('📸 Original indices mapping:', originalIndices);
      
      // Map filtered indices back to original image indices
      // pictureDurations uses filtered indices (0, 1, 2...) but we need original indices
      let mappedDurations = pictureDurations;
      if (originalIndices && originalIndices.length > 0) {
        mappedDurations = {};
        Object.entries(pictureDurations).forEach(([filteredIdx, duration]) => {
          const originalIdx = originalIndices[parseInt(filteredIdx)];
          if (originalIdx !== undefined) {
            mappedDurations[originalIdx] = duration;
          }
        });
        console.log('📸 Mapped to original indices:', mappedDurations);
      }
      
      // Approve the PII request with individual picture durations (using original indices)
      const approvalData = {
        responseMessage,
        pictureDurations: mappedDurations
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

  const handleDeleteHistoryItem = async (type, id) => {
    try {
      if (type === 'access') {
        await api.delete(`/pii-access/${id}?username=${currentUsername}`);
      } else if (type === 'request') {
        await api.delete(`/pii-requests/${id}/history?username=${currentUsername}`);
      }
      await loadAllData();
      setSuccessMessage('History item deleted successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting history item:', err);
      setError('Failed to delete history item');
    }
  };

  const handleClearAllHistory = async (historyType) => {
    try {
      await api.delete(`/pii-history/${currentUsername}?type=${historyType}`);
      await loadAllData();
      setSuccessMessage('History cleared successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error clearing history:', err);
      setError('Failed to clear history');
    }
  };

  const getAccessTypeLabel = (type) => {
    const labels = {
      'images': '📷 Photos',
      'contact_number': '📞 Contact Number',
      'contact_email': '📧 Contact Email',
      'contact_info': '📧 Contact Info',
      'linkedin_url': '🔗 LinkedIn',
      'date_of_birth': '🎂 Date of Birth'
    };
    return labels[type] || type;
  };

  const getAccessTypeIcon = (type) => {
    const icons = {
      'images': '📷',
      'contact_number': '📞',
      'contact_email': '📧',
      'contact_info': '📧',
      'linkedin_url': '🔗',
      'date_of_birth': '🎂'
    };
    return icons[type] || '📄';
  };

  // Group ALL incoming requests by requester username (for table view with status badges)
  const groupedIncomingRequests = useMemo(() => {
    const grouped = {};
    allIncomingRequests.forEach(req => {
      const username = req.requesterUsername || req.requesterProfile?.username;
      if (!username) return;
      
      if (!grouped[username]) {
        grouped[username] = {
          profile: req.requesterProfile,
          requests: [],
          oldestRequestDate: req.requestedAt,
          hasPending: false
        };
      }
      grouped[username].requests.push(req);
      // Track if user has any pending requests
      if (req.status === 'pending') {
        grouped[username].hasPending = true;
      }
      // Track oldest request for expiry warning (only pending)
      if (req.status === 'pending' && new Date(req.requestedAt) < new Date(grouped[username].oldestRequestDate)) {
        grouped[username].oldestRequestDate = req.requestedAt;
      }
    });
    return grouped;
  }, [allIncomingRequests]);

  // Calculate days until expiry (7 day limit)
  const getDaysUntilExpiry = (requestedAt) => {
    const requestDate = new Date(requestedAt);
    const expiryDate = new Date(requestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
    return daysLeft;
  };

  // Format relative time
  const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  // Handle approve all requests from a user
  const handleApproveAllFromUser = async (username, requests) => {
    try {
      // Check if any are photo requests - if so, we need special handling
      const photoRequests = requests.filter(r => 
        r.requestType === 'images' || r.requestType === 'photos'
      );
      const nonPhotoRequests = requests.filter(r => 
        r.requestType !== 'images' && r.requestType !== 'photos'
      );
      
      // Approve non-photo requests directly
      for (const req of nonPhotoRequests) {
        await api.put(`/pii-requests/${req.id}/approve?username=${currentUsername}`, {});
      }
      
      // For photo requests, open the ImageManager for the first one
      if (photoRequests.length > 0) {
        const req = photoRequests[0];
        await handleApproveRequest(req, req.requesterProfile);
        return; // ImageManager will handle the rest
      }
      
      await loadAllData();
      setSuccessMessage(`All requests from ${username} approved!`);
      setTimeout(() => setSuccessMessage(''), 5000);
      emitPIIAccessChange('granted', username, currentUsername);
    } catch (err) {
      console.error('Error approving all requests:', err);
      setError('Failed to approve requests');
    }
  };

  // Handle reject all requests from a user
  const handleRejectAllFromUser = async (username, requests) => {
    try {
      for (const req of requests) {
        await api.put(`/pii-requests/${req.id}/reject?username=${currentUsername}`);
      }
      await loadAllData();
      setSuccessMessage(`All requests from ${username} rejected.`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error rejecting all requests:', err);
      setError('Failed to reject requests');
    }
  };

  // Get icons for what requester will share (mutual exchange preview)
  const getMutualExchangeIcons = (profile, requestedTypes) => {
    const icons = [];
    const piiTypes = ['contact_number', 'contact_email', 'linkedin_url', 'images'];
    
    piiTypes.forEach(type => {
      // Only show icon if this type was requested AND requester has the data
      if (requestedTypes[type]) {
        let hasData = false;
        let icon = '';
        let label = '';
        
        switch (type) {
          case 'contact_number':
            hasData = profile?.contactNumber && profile.contactNumber.trim() !== '';
            icon = '📞';
            label = 'Contact Number';
            break;
          case 'contact_email':
            hasData = profile?.contactEmail && profile.contactEmail.trim() !== '';
            icon = '📧';
            label = 'Email';
            break;
          case 'linkedin_url':
            hasData = profile?.linkedinUrl && profile.linkedinUrl.trim() !== '';
            icon = '🔗';
            label = 'LinkedIn';
            break;
          case 'images':
            hasData = profile?.images && profile.images.length > 0;
            icon = '📷';
            label = `${profile?.images?.length || 0} Photos`;
            break;
          default:
            break;
        }
        
        if (hasData) {
          icons.push({ icon, label, type });
        }
      }
    });
    
    return icons;
  };

  // Render the table-based requests view
  const renderRequestsTable = () => {
    const usernames = Object.keys(groupedIncomingRequests);
    const uniqueUsersCount = usernames.length;
    const totalRequestsCount = allIncomingRequests.length;
    const pendingCount = incomingRequests.length;
    
    if (totalRequestsCount === 0) {
      return (
        <div className="empty-state-small">
          <p>No requests</p>
        </div>
      );
    }

    // Define all possible PII types for columns
    const piiTypes = ['contact_number', 'contact_email', 'linkedin_url', 'images'];
    
    return (
      <div className="pii-requests-table-container">
        <div className="table-summary">
          {pendingCount > 0 ? (
            <>{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</>
          ) : (
            <>No pending requests</>
          )}
          {totalRequestsCount > pendingCount && (
            <span className="processed-count"> • {totalRequestsCount - pendingCount} processed</span>
          )}
          <span className="mutual-info"> • 🔄 Mutual exchange</span>
        </div>
        
        <div className="pii-requests-table-wrapper">
          <table className="pii-requests-table">
            <thead>
              <tr>
                <th className="col-profile">Profile</th>
                <th className="col-requested">Requested</th>
                <th className="col-pii">📞 Contact #</th>
                <th className="col-pii">📧 Email</th>
                <th className="col-pii">🔗 LinkedIn</th>
                <th className="col-pii">📷 Photos</th>
                <th className="col-exchange">🔄 You'll Get</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usernames.map(username => {
                const { profile, requests, oldestRequestDate } = groupedIncomingRequests[username];
                const daysLeft = getDaysUntilExpiry(oldestRequestDate);
                const isExpiringSoon = daysLeft <= 2;
                
                // Create a map of requested types for this user
                const requestedTypes = {};
                requests.forEach(req => {
                  requestedTypes[req.requestType] = req;
                });
                
                // Get mutual exchange icons
                const exchangeIcons = getMutualExchangeIcons(profile, requestedTypes);
                
                return (
                  <tr key={username} className={isExpiringSoon ? 'expiring-soon' : ''}>
                    <td className="col-profile">
                      <div 
                        className="table-user-info clickable"
                        onClick={() => handleProfileClick(username)}
                      >
                        {profile?.images?.[0] ? (
                          <img 
                            src={getImageUrl(profile.images[0])} 
                            alt={username} 
                            className="table-avatar" 
                          />
                        ) : (
                          <div className="table-avatar-placeholder">
                            {profile?.firstName?.[0] || username[0].toUpperCase()}
                          </div>
                        )}
                        <div className="table-user-details">
                          <span className="table-user-name">
                            {profile?.firstName || username}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="col-requested">
                      <span className={`time-badge ${isExpiringSoon ? 'warning' : ''}`}>
                        {getRelativeTime(oldestRequestDate)}
                        {isExpiringSoon && <span className="expiry-warning"> ⚠️</span>}
                      </span>
                    </td>
                    {piiTypes.map(type => {
                      const request = requestedTypes[type];
                      return (
                        <td key={type} className="col-pii">
                          {request ? (
                            request.status === 'pending' ? (
                              <div className="pii-cell-actions">
                                <button
                                  className="btn-cell-approve"
                                  onClick={() => handleApproveRequest(request, profile)}
                                  title="Approve"
                                >
                                  ✅
                                </button>
                                <button
                                  className="btn-cell-reject"
                                  onClick={() => handleRejectRequest(request.id)}
                                  title="Reject"
                                >
                                  ❌
                                </button>
                              </div>
                            ) : request.status === 'approved' ? (
                              <span className="status-badge-approved" title="Approved">✅</span>
                            ) : request.status === 'rejected' ? (
                              <span className="status-badge-rejected" title="Rejected">❌</span>
                            ) : (
                              <span className="not-requested">➖</span>
                            )
                          ) : (
                            <span className="not-requested">➖</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="col-exchange">
                      <div className="exchange-icons" title="What you'll receive if you approve">
                        {exchangeIcons.length > 0 ? (
                          exchangeIcons.map(({ icon, label, type }) => (
                            <span 
                              key={type} 
                              className="exchange-icon" 
                              title={label}
                            >
                              {icon}
                            </span>
                          ))
                        ) : (
                          <span className="no-exchange" title="Requester has no matching data">—</span>
                        )}
                      </div>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          className="btn-row-approve"
                          onClick={() => handleApproveAllFromUser(username, requests)}
                          title={`Approve all ${requests.length} requests`}
                        >
                          ✓ All
                        </button>
                        <button
                          className="btn-row-reject"
                          onClick={() => handleRejectAllFromUser(username, requests)}
                          title={`Reject all ${requests.length} requests`}
                        >
                          ✗ All
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="table-legend">
          <span><span className="legend-icon">✅</span> Approve</span>
          <span><span className="legend-icon">❌</span> Reject</span>
          <span><span className="legend-icon">➖</span> Not Requested</span>
          <span><span className="legend-icon">🔄</span> Mutual Exchange</span>
          <span><span className="legend-icon">⚠️</span> Expires soon (7-day limit)</span>
        </div>
      </div>
    );
  };

  // Memoized archive items for PIIRequestsTable
  const archiveItems = useMemo(() => {
    return [
      ...revokedAccess.map(item => ({
        type: 'revoked',
        profile: item.userProfile,
        accessTypes: item.accessTypes,
        date: item.grantedAt,
        direction: 'outgoing'
      })),
      ...expiredAccess.map(item => ({
        type: 'expired',
        profile: item.userProfile,
        accessTypes: item.accessTypes,
        date: item.grantedAt,
        direction: 'outgoing'
      })),
      ...rejectedIncoming.map(req => ({
        type: 'rejected',
        profile: req.requesterProfile,
        accessTypes: [req.requestType],
        date: req.respondedAt || req.requestedAt,
        direction: 'incoming'
      })),
      ...rejectedOutgoing.map(req => ({
        type: 'rejected',
        profile: req.profileOwner,
        accessTypes: [req.requestType],
        date: req.respondedAt || req.requestedAt,
        direction: 'outgoing'
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [revokedAccess, expiredAccess, rejectedIncoming, rejectedOutgoing]);

  // Render the Archive table view (kept for backward compatibility, now uses PIIRequestsTable)
  const renderArchiveTable = () => {
    const totalCount = archiveItems.length;

    if (totalCount === 0) {
      return (
        <div className="empty-state">
          <span className="empty-icon">📁</span>
          <p>No archived items</p>
        </div>
      );
    }

    const getStatusBadgeClass = (type) => {
      switch (type) {
        case 'revoked': return 'badge-revoked';
        case 'expired': return 'badge-expired';
        case 'rejected': return 'badge-rejected';
        default: return '';
      }
    };

    const getStatusLabel = (type, direction) => {
      switch (type) {
        case 'revoked': return '🚫 Revoked';
        case 'expired': return '⏱️ Expired';
        case 'rejected': return direction === 'incoming' ? '❌ You Rejected' : '⛔ They Rejected';
        default: return type;
      }
    };

    return (
      <div className="pii-requests-table-container archive-table">
        <div className="table-summary archive-summary">
          {totalCount} archived item{totalCount !== 1 ? 's' : ''}
          <button 
            className="btn-clear-all-archive"
            onClick={() => {
              // Clear all history types
              handleClearAllHistory('all');
            }}
            title="Clear all archive"
          >
            🗑️ Clear All
          </button>
        </div>
        
        <div className="pii-requests-table-wrapper">
          <table className="pii-requests-table">
            <thead>
              <tr>
                <th className="col-profile">Profile</th>
                <th className="col-status">Status</th>
                <th className="col-types">Access Types</th>
                <th className="col-date">Date</th>
              </tr>
            </thead>
            <tbody>
              {archiveItems.map((item, index) => (
                <tr key={`${item.profile?.username}-${index}`}>
                  <td className="col-profile">
                    <div 
                      className="table-user-info clickable"
                      onClick={() => handleProfileClick(item.profile?.username)}
                    >
                      {item.profile?.images?.[0] ? (
                        <img 
                          src={getImageUrl(item.profile.images[0])} 
                          alt={item.profile.username} 
                          className="table-avatar" 
                        />
                      ) : (
                        <div className="table-avatar-placeholder">
                          {item.profile?.firstName?.[0] || item.profile?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="table-user-name">
                        {item.profile?.firstName || item.profile?.username || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="col-status">
                    <span className={`archive-status-badge ${getStatusBadgeClass(item.type)}`}>
                      {getStatusLabel(item.type, item.direction)}
                    </span>
                  </td>
                  <td className="col-types">
                    <div className="archive-types">
                      {item.accessTypes.map((type, idx) => (
                        <span key={idx} className="archive-type-icon" title={getAccessTypeLabel(type)}>
                          {getAccessTypeIcon(type)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="col-date">
                    <span className="archive-date">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="table-legend archive-legend">
          <span><span className="legend-icon">🚫</span> Revoked</span>
          <span><span className="legend-icon">⏱️</span> Expired</span>
          <span><span className="legend-icon">❌</span> Rejected</span>
          <span><span className="legend-icon">⚠️</span> Archived items will be auto-removed after 7 days</span>
        </div>
      </div>
    );
  };

  // Group outgoing requests by target user (moved outside render function for hooks compliance)
  const groupedOutgoingRequests = useMemo(() => {
    const grouped = {};
    outgoingRequests.forEach(req => {
      const username = req.profileOwner?.username;
      if (!username) return;
      if (!grouped[username]) {
        grouped[username] = {
          profile: req.profileOwner,
          requests: []
        };
      }
      grouped[username].requests.push(req);
    });
    return grouped;
  }, [outgoingRequests]);

  // Render the Requests Sent table view (same columns as Inbox)
  const renderSentRequestsTable = () => {
    const totalCount = outgoingRequests.length;
    // Use snake_case to match PIIRequestModal values stored in DB
    const piiTypesForSent = ['contact_number', 'contact_email', 'linkedin_url', 'images'];

    if (totalCount === 0) {
      return (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No requests sent</p>
        </div>
      );
    }

    const usernames = Object.keys(groupedOutgoingRequests);

    return (
      <div className="pii-requests-table-container sent-table">
        <div className="table-summary sent-summary">
          {totalCount} pending request{totalCount !== 1 ? 's' : ''} to {usernames.length} user{usernames.length !== 1 ? 's' : ''}
        </div>
        
        <div className="pii-requests-table-wrapper">
          <table className="pii-requests-table">
            <thead>
              <tr>
                <th className="col-profile">To</th>
                <th className="col-requested">Requested</th>
                <th className="col-pii">📞 Contact #</th>
                <th className="col-pii">📧 Email</th>
                <th className="col-pii">🔗 LinkedIn</th>
                <th className="col-pii">📷 Photos</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usernames.map(username => {
                const { profile, requests } = groupedOutgoingRequests[username];
                const requestedTypes = {};
                requests.forEach(req => {
                  // Store by original requestType (snake_case from DB)
                  requestedTypes[req.requestType] = req;
                });
                
                // Get earliest request time
                const earliestRequest = requests.reduce((earliest, req) => 
                  new Date(req.requestedAt) < new Date(earliest.requestedAt) ? req : earliest
                , requests[0]);

                return (
                  <tr key={username}>
                    <td className="col-profile">
                      <div 
                        className="table-user-info clickable"
                        onClick={() => handleProfileClick(username)}
                      >
                        {profile?.images?.[0] ? (
                          <img 
                            src={getImageUrl(profile.images[0])} 
                            alt={username} 
                            className="table-avatar" 
                          />
                        ) : (
                          <div className="table-avatar-placeholder">
                            {profile?.firstName?.[0] || username[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="table-user-name">
                          {profile?.firstName || username}
                        </span>
                      </div>
                    </td>
                    <td className="col-requested">
                      <span className="time-badge">
                        {getRelativeTime(earliestRequest.requestedAt)}
                      </span>
                    </td>
                    {piiTypesForSent.map(type => {
                      const request = requestedTypes[type];
                      return (
                        <td key={type} className="col-pii">
                          {request ? (
                            <span className="sent-pending-badge" title={`Pending - ${getAccessTypeLabel(type)}`}>
                              ⏳
                            </span>
                          ) : (
                            <span className="not-requested">➖</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="col-actions">
                      <button
                        className="btn-cancel-request"
                        onClick={() => {
                          // Cancel all requests to this user
                          requests.forEach(req => handleCancelRequest(req.id));
                        }}
                        title={`Cancel all ${requests.length} request(s)`}
                      >
                        ✗ Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="table-legend">
          <span><span className="legend-icon">⏳</span> Pending</span>
          <span><span className="legend-icon">➖</span> Not Requested</span>
        </div>
      </div>
    );
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
    const expiredTypes = item.expiredTypes || [];

    return (
      <div 
        key={profile.username} 
        className="access-card clickable"
        onClick={() => handleProfileClick(profile.username)}
      >
        <div className="access-card-header">
          <div className="user-info">
            {profile.images?.[0] ? (
              <img src={getImageUrl(profile.images[0])} alt={profile.username} className="access-avatar" />
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
            {item.accessTypes.map((accessType, typeIdx) => {
              const isExpired = expiredTypes.includes(accessType);
              // Check if this access type is now member-visible (only for granted tab)
              const isMemberVisible = isGranted && (
                (accessType === 'contact_email' && visibilitySettings.contactEmailVisible) ||
                (accessType === 'contact_number' && visibilitySettings.contactNumberVisible) ||
                (accessType === 'linkedin_url' && visibilitySettings.linkedinUrlVisible)
              );
              return (
                <span 
                  key={`${accessType}-${typeIdx}`} 
                  className={`access-type-badge ${isExpired ? 'expired' : ''} ${isMemberVisible ? 'member-visible' : ''}`}
                  title={isMemberVisible ? 'This info is now visible to all members' : isExpired ? 'Access has expired (one-time view used)' : ''}
                >
                  {getAccessTypeLabel(accessType)}
                  {isExpired && <span className="expired-indicator"> ⏱️ Expired</span>}
                  {isMemberVisible && <span className="member-visible-indicator"> 👁️</span>}
                </span>
              );
            })}
          </div>
          {/* Show note if any access type is now member-visible */}
          {isGranted && item.accessTypes.some(t => 
            (t === 'contact_email' && visibilitySettings.contactEmailVisible) ||
            (t === 'contact_number' && visibilitySettings.contactNumberVisible) ||
            (t === 'linkedin_url' && visibilitySettings.linkedinUrlVisible)
          ) && (
            <p className="member-visible-note">
              ℹ️ Some info is now visible to all members
            </p>
          )}
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
              <img src={getImageUrl(profile.images[0])} alt={profile.username} className="access-avatar" />
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

      {/* Tabs - Using UniversalTabContainer with pill style */}
      <UniversalTabContainer
        variant="pills"
        defaultTab={getDefaultTabFromUrl()}
        key={getDefaultTabFromUrl()}
        onTabChange={handleTabChange}
        tabs={[
          {
            id: 'inbox',
            icon: '📬',
            label: 'Requests Inbox',
            badge: allIncomingRequests.length,
            content: (
              <PIIRequestsTable
                requests={allIncomingRequests}
                type="inbox"
                onApprove={handleApproveRequest}
                onReject={handleRejectRequest}
                onApproveAll={handleApproveAllFromUser}
                onRejectAll={handleRejectAllFromUser}
                onProfileClick={(username) => navigate(`/profile/${username}`)}
                showMutualExchange={true}
              />
            )
          },
          {
            id: 'sent',
            icon: '📤',
            label: 'Requests Sent',
            badge: outgoingRequests.length,
            content: (
              <PIIRequestsTable
                requests={outgoingRequests}
                type="sent"
                onCancel={handleCancelRequest}
                onProfileClick={(username) => navigate(`/profile/${username}`)}
              />
            )
          },
          {
            id: 'archive',
            icon: '📁',
            label: 'Archive',
            badge: archiveItems.length,
            content: (
              <PIIRequestsTable
                requests={archiveItems}
                type="archive"
                onClearAll={() => handleClearAllHistory('all')}
                onProfileClick={(username) => navigate(`/profile/${username}`)}
              />
            )
          }
        ]}
      />
      
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
