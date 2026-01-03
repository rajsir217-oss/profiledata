import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../utils/urlHelper';
import './PIIRequestsTable.css';

/**
 * PIIRequestsTable - Reusable table component for PII requests
 * 
 * @param {Object} props
 * @param {Array} props.requests - Array of request objects
 * @param {string} props.type - Table type: 'inbox' | 'sent' | 'archive'
 * @param {Function} props.onApprove - Callback for approve action (request, profile)
 * @param {Function} props.onReject - Callback for reject action (requestId)
 * @param {Function} props.onCancel - Callback for cancel action (requestId)
 * @param {Function} props.onApproveAll - Callback for bulk approve (username, requests)
 * @param {Function} props.onRejectAll - Callback for bulk reject (username, requests)
 * @param {Function} props.onClearAll - Callback for clear all archive
 * @param {Function} props.onProfileClick - Callback for profile click (username)
 * @param {boolean} props.showMutualExchange - Show mutual exchange column (default: true for inbox)
 * @param {boolean} props.compact - Compact mode for dashboard embed
 * @param {string} props.emptyMessage - Custom empty state message
 */
const PIIRequestsTable = ({
  requests = [],
  type = 'inbox',
  onApprove,
  onReject,
  onCancel,
  onApproveAll,
  onRejectAll,
  onRevokeAll,  // New: for revoking approved access
  onClearAll,
  onProfileClick,
  showMutualExchange = true,
  compact = false,
  emptyMessage
}) => {
  const navigate = useNavigate();

  // PII types for columns
  const piiTypes = ['contact_number', 'contact_email', 'linkedin_url', 'images'];

  // Helper: Get access type label
  const getAccessTypeLabel = (piiType) => {
    const labels = {
      'images': '📷 Photos',
      'contact_number': '📞 Contact Number',
      'contact_email': '📧 Contact Email',
      'contact_info': '📧 Contact Info',
      'linkedin_url': '🔗 LinkedIn',
      'date_of_birth': '🎂 Date of Birth'
    };
    return labels[piiType] || piiType;
  };

  // Helper: Get access type icon
  const getAccessTypeIcon = (piiType) => {
    const icons = {
      'images': '📷',
      'contact_number': '📞',
      'contact_email': '📧',
      'contact_info': '📧',
      'linkedin_url': '🔗',
      'date_of_birth': '🎂'
    };
    return icons[piiType] || '📄';
  };

  // Helper: Format relative time
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

  // Helper: Check if PII type is member visible (no request needed)
  const isPiiMemberVisible = (profile, piiType) => {
    if (!profile) return false;
    
    // For images: use new 3-bucket system - check if onRequest bucket is empty
    if (piiType === 'images') {
      const imageVisibility = profile.imageVisibility;
      if (imageVisibility) {
        // If no onRequest photos, all images are already visible
        return (imageVisibility.onRequest || []).length === 0;
      }
      // Legacy fallback - assume no onRequest photos if no imageVisibility
      return true;
    }
    
    // For other PII types: use legacy visibility flags
    const visibilityMap = {
      'contact_number': 'contactNumberVisible',
      'contact_email': 'contactEmailVisible',
      'linkedin_url': 'linkedinUrlVisible'
    };
    const visibilityKey = visibilityMap[piiType];
    return visibilityKey ? profile[visibilityKey] === true : false;
  };

  // Helper: Calculate days until expiry (7 day limit)
  const getDaysUntilExpiry = (requestedAt) => {
    const requestDate = new Date(requestedAt);
    const expiryDate = new Date(requestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
    return daysLeft;
  };

  // Helper: Get mutual exchange icons
  const getMutualExchangeIcons = (profile, requestedTypes) => {
    const icons = [];
    
    piiTypes.forEach(piiType => {
      if (requestedTypes[piiType]) {
        let hasData = false;
        let icon = '';
        let label = '';
        
        switch (piiType) {
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
          icons.push({ icon, label, type: piiType });
        }
      }
    });
    
    return icons;
  };

  // Handle profile click
  const handleProfileClick = (username) => {
    if (onProfileClick) {
      onProfileClick(username);
    } else {
      navigate(`/profile/${username}`);
    }
  };

  // Group requests by user
  const groupedRequests = useMemo(() => {
    const grouped = {};
    
    requests.forEach(req => {
      let username;
      let profile;
      
      if (type === 'inbox') {
        username = req.requesterUsername || req.requesterProfile?.username;
        profile = req.requesterProfile;
      } else if (type === 'sent') {
        username = req.profileOwner?.username || req.requestedUsername || req.profileUsername;
        profile = req.profileOwner;
      } else if (type === 'archive') {
        username = req.profile?.username;
        profile = req.profile;
      }
      
      if (!username) return;
      
      if (!grouped[username]) {
        grouped[username] = {
          profile,
          requests: [],
          oldestRequestDate: req.requestedAt || req.date,
          hasPending: false
        };
      } else if (!grouped[username].profile && profile) {
        // Update profile if it was missing before
        grouped[username].profile = profile;
      } else if (profile?.images?.length && !grouped[username].profile?.images?.length) {
        // Update profile if current one has images but grouped one doesn't
        grouped[username].profile = profile;
      }
      grouped[username].requests.push(req);
      
      if (req.status === 'pending') {
        grouped[username].hasPending = true;
      }
      
      const reqDate = req.requestedAt || req.date;
      if (req.status === 'pending' && new Date(reqDate) < new Date(grouped[username].oldestRequestDate)) {
        grouped[username].oldestRequestDate = reqDate;
      }
    });
    
    return grouped;
  }, [requests, type]);

  const usernames = Object.keys(groupedRequests);
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // Empty state
  if (totalCount === 0) {
    const defaultMessages = {
      inbox: 'No requests',
      sent: 'No requests sent',
      archive: 'No archived items'
    };
    const defaultIcons = {
      inbox: '📬',
      sent: '📭',
      archive: '📁'
    };
    
    return (
      <div className="pii-table-empty-state">
        <span className="empty-icon">{defaultIcons[type]}</span>
        <p>{emptyMessage || defaultMessages[type]}</p>
      </div>
    );
  }

  // Render INBOX table
  if (type === 'inbox') {
    return (
      <div className={`pii-requests-table-container ${compact ? 'compact' : ''}`}>
        <div className="table-summary">
          {pendingCount > 0 ? (
            <>{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</>
          ) : (
            <>No pending requests</>
          )}
          {totalCount > pendingCount && (
            <span className="processed-count"> • {totalCount - pendingCount} processed</span>
          )}
          {showMutualExchange && <span className="mutual-info"> • 🔄 Mutual exchange</span>}
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
                {showMutualExchange && <th className="col-exchange">🔄 You'll Get</th>}
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usernames.map(username => {
                const { profile, requests: userRequests, oldestRequestDate } = groupedRequests[username];
                const daysLeft = getDaysUntilExpiry(oldestRequestDate);
                const isExpiringSoon = daysLeft <= 2;
                
                // Group by request type, keeping the MOST RECENT request for each type
                const requestedTypes = {};
                userRequests.forEach(req => {
                  const existing = requestedTypes[req.requestType];
                  if (!existing) {
                    requestedTypes[req.requestType] = req;
                  } else {
                    // Keep the more recent request (by requestedAt date)
                    const existingDate = new Date(existing.requestedAt || 0);
                    const newDate = new Date(req.requestedAt || 0);
                    if (newDate > existingDate) {
                      requestedTypes[req.requestType] = req;
                    }
                  }
                });
                
                const exchangeIcons = getMutualExchangeIcons(profile, requestedTypes);
                
                // Check request states for button logic
                // State machine: Pending → Approve/Reject, Approved → Revoke → back to Pending
                const hasPendingRequests = userRequests.some(req => req.status === 'pending');
                const hasApprovedRequests = userRequests.some(req => req.status === 'approved');
                
                // Button states:
                // - If APPROVED: Show disabled ✓All + enabled Revoke
                // - If PENDING: Show enabled ✓All + enabled ✗All
                // - After Revoke: Goes back to PENDING state
                
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
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="table-avatar-placeholder"
                          style={{ display: profile?.images?.[0] ? 'none' : 'flex' }}
                        >
                          {profile?.firstName?.[0] || username[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="table-user-name">
                          {profile?.firstName || username}
                        </span>
                      </div>
                    </td>
                    <td className="col-requested">
                      <span className={`time-badge ${isExpiringSoon ? 'warning' : ''}`}>
                        {getRelativeTime(oldestRequestDate)}
                        {isExpiringSoon && <span className="expiry-warning"> ⚠️</span>}
                      </span>
                    </td>
                    {piiTypes.map(piiType => {
                      const request = requestedTypes[piiType];
                      return (
                        <td key={piiType} className="col-pii">
                          {request ? (
                            request.status === 'pending' ? (
                              <div className="pii-cell-actions">
                                <button
                                  className="btn-cell-approve"
                                  onClick={() => onApprove && onApprove(request, profile)}
                                  title="Approve"
                                >
                                  ✅
                                </button>
                                <button
                                  className="btn-cell-reject"
                                  onClick={() => onReject && onReject(request.id)}
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
                    {showMutualExchange && (
                      <td className="col-exchange">
                        <div className="exchange-icons" title="What you'll receive if you approve">
                          {exchangeIcons.length > 0 ? (
                            exchangeIcons.map(({ icon, label, type: iconType }) => (
                              <span key={iconType} className="exchange-icon" title={label}>
                                {icon}
                              </span>
                            ))
                          ) : (
                            <span className="no-exchange" title="Requester has no matching data">—</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          className={`btn-row-approve ${!hasPendingRequests ? 'disabled' : ''}`}
                          onClick={() => hasPendingRequests && onApproveAll && onApproveAll(username, userRequests)}
                          title={hasPendingRequests ? `Approve all pending requests` : 'Already approved'}
                          disabled={!hasPendingRequests}
                        >
                          ✓ All
                        </button>
                        {hasApprovedRequests ? (
                          <button
                            className="btn-row-revoke"
                            onClick={() => onRevokeAll && onRevokeAll(username, userRequests)}
                            title="Revoke all granted access"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            className={`btn-row-reject ${!hasPendingRequests ? 'disabled' : ''}`}
                            onClick={() => hasPendingRequests && onRejectAll && onRejectAll(username, userRequests)}
                            title={hasPendingRequests ? `Reject all pending requests` : 'No pending requests'}
                            disabled={!hasPendingRequests}
                          >
                            ✗ All
                          </button>
                        )}
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
          {showMutualExchange && <span><span className="legend-icon">🔄</span> Mutual Exchange</span>}
          <span><span className="legend-icon">⚠️</span> Expires soon (7-day limit)</span>
        </div>
      </div>
    );
  }

  // Render SENT table
  if (type === 'sent') {
    return (
      <div className={`pii-requests-table-container sent-table ${compact ? 'compact' : ''}`}>
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
                const { profile, requests: userRequests } = groupedRequests[username];
                // Group by request type, keeping the MOST RECENT request for each type
                const requestedTypes = {};
                userRequests.forEach(req => {
                  const existing = requestedTypes[req.requestType];
                  if (!existing) {
                    requestedTypes[req.requestType] = req;
                  } else {
                    // Keep the more recent request (by requestedAt date)
                    const existingDate = new Date(existing.requestedAt || 0);
                    const newDate = new Date(req.requestedAt || 0);
                    if (newDate > existingDate) {
                      requestedTypes[req.requestType] = req;
                    }
                  }
                });
                
                const earliestRequest = userRequests.reduce((earliest, req) => 
                  new Date(req.requestedAt) < new Date(earliest.requestedAt) ? req : earliest
                , userRequests[0]);

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
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="table-avatar-placeholder"
                          style={{ display: profile?.images?.[0] ? 'none' : 'flex' }}
                        >
                          {profile?.firstName?.[0] || username[0]?.toUpperCase() || '?'}
                        </div>
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
                    {piiTypes.map(piiType => {
                      const request = requestedTypes[piiType];
                      const isMemberVisible = isPiiMemberVisible(profile, piiType);
                      return (
                        <td key={piiType} className="col-pii">
                          {/* Show member-visible badge if data is publicly accessible */}
                          {isMemberVisible && (
                            <span className="member-visible-badge" title={`${getAccessTypeLabel(piiType)} - Visible to all members`}>
                              👁️
                            </span>
                          )}
                          {request ? (
                            request.status === 'approved' ? (
                              <span className="sent-approved-badge" title={`Approved - ${getAccessTypeLabel(piiType)}`}>
                                ✅
                              </span>
                            ) : request.status === 'rejected' ? (
                              <span className="sent-rejected-badge" title={`Rejected - ${getAccessTypeLabel(piiType)}`}>
                                ❌
                              </span>
                            ) : request.status === 'cancelled' ? (
                              <span className="sent-cancelled-badge" title={`Cancelled - ${getAccessTypeLabel(piiType)}`}>
                                🚫
                              </span>
                            ) : request.status === 'revoked' ? (
                              <span className="sent-revoked-badge" title={`Access Revoked - ${getAccessTypeLabel(piiType)}`}>
                                🔒
                              </span>
                            ) : request.status === 'expired' ? (
                              <span className="sent-expired-badge" title={`Request Expired - ${getAccessTypeLabel(piiType)}`}>
                                ⏱️
                              </span>
                            ) : (
                              <span className="sent-pending-badge" title={`Pending - ${getAccessTypeLabel(piiType)}`}>
                                ⏳
                              </span>
                            )
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
                          userRequests.forEach(req => onCancel && onCancel(req.id));
                        }}
                        title={`Cancel all ${userRequests.length} request(s)`}
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
          <span><span className="legend-icon approved">✅</span> Approved</span>
          <span><span className="legend-icon rejected">❌</span> Rejected</span>
          <span><span className="legend-icon cancelled">🚫</span> Cancelled</span>
          <span><span className="legend-icon revoked">🔒</span> Revoked</span>
          <span><span className="legend-icon expired">⏱️</span> Expired</span>
          <span><span className="legend-icon">➖</span> Not Requested</span>
          <span><span className="legend-icon member-visible">👁️</span> Member Visible</span>
        </div>
      </div>
    );
  }

  // Render HISTORY table (received PII access grants)
  if (type === 'history') {
    // API returns: { userProfile, accessTypes, grantedAt, expiresAt, accessIds }
    // Group by granter username
    const groupedAccess = {};
    requests.forEach(access => {
      // Handle API structure: userProfile contains the granter's profile
      const profile = access.userProfile || access.granterProfile || access.profile;
      const granterUsername = profile?.username || access.granterUsername || access.username;
      if (!granterUsername) return;
      
      if (!groupedAccess[granterUsername]) {
        groupedAccess[granterUsername] = {
          profile: profile || { username: granterUsername },
          accessTypes: [],
          grantedAt: access.grantedAt
        };
      }
      
      // Add access types
      if (access.accessTypes) {
        groupedAccess[granterUsername].accessTypes = [...new Set([
          ...groupedAccess[granterUsername].accessTypes,
          ...access.accessTypes
        ])];
      } else if (access.accessType) {
        if (!groupedAccess[granterUsername].accessTypes.includes(access.accessType)) {
          groupedAccess[granterUsername].accessTypes.push(access.accessType);
        }
      }
    });

    const usernames = Object.keys(groupedAccess);

    if (usernames.length === 0) {
      return (
        <div className={`pii-requests-table-container history-table ${compact ? 'compact' : ''}`}>
          <div className="empty-state">
            <span className="empty-icon">🔐</span>
            <p>{emptyMessage || 'No active access grants'}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`pii-requests-table-container history-table ${compact ? 'compact' : ''}`}>
        <div className="table-summary">
          {usernames.length} user{usernames.length !== 1 ? 's' : ''} granted you access
        </div>
        
        <div className="pii-requests-table-wrapper">
          <table className="pii-requests-table">
            <thead>
              <tr>
                <th className="col-profile">From</th>
                <th className="col-date">Granted</th>
                <th className="col-pii">📞 Contact</th>
                <th className="col-pii">📧 Email</th>
                <th className="col-pii">🔗 LinkedIn</th>
                <th className="col-pii">📷 Photos</th>
              </tr>
            </thead>
            <tbody>
              {usernames.map(username => {
                const { profile, accessTypes, grantedAt } = groupedAccess[username];
                
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
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="table-avatar-placeholder"
                          style={{ display: profile?.images?.[0] ? 'none' : 'flex' }}
                        >
                          {(profile?.firstName?.[0] || username?.[0] || '?').toUpperCase()}
                        </div>
                        <span className="table-username">{profile?.firstName || username}</span>
                      </div>
                    </td>
                    <td className="col-date">
                      <span className="time-badge">
                        {grantedAt ? getRelativeTime(grantedAt) : '-'}
                      </span>
                    </td>
                    {piiTypes.map(piiType => {
                      const hasAccess = accessTypes.includes(piiType);
                      return (
                        <td key={piiType} className="col-pii">
                          {hasAccess ? (
                            <span className="access-granted-badge" title={`${getAccessTypeLabel(piiType)} - Access granted`}>
                              ✅
                            </span>
                          ) : (
                            <span className="no-access">➖</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="table-legend">
          <span><span className="legend-icon">✅</span> Access Granted</span>
          <span><span className="legend-icon">➖</span> Not Granted</span>
          <span><span className="legend-icon">⚠️</span> Access expires after 5 days</span>
        </div>
      </div>
    );
  }

  // Render ARCHIVE table
  if (type === 'archive') {
    const getStatusBadgeClass = (status) => {
      switch (status) {
        case 'revoked': return 'badge-revoked';
        case 'expired': return 'badge-expired';
        case 'rejected': return 'badge-rejected';
        default: return '';
      }
    };

    const getStatusLabel = (status, direction) => {
      switch (status) {
        case 'revoked': return '🚫 Revoked';
        case 'expired': return '⏱️ Expired';
        case 'rejected': return direction === 'incoming' ? '❌ You Rejected' : '⛔ They Rejected';
        default: return status;
      }
    };

    return (
      <div className={`pii-requests-table-container archive-table ${compact ? 'compact' : ''}`}>
        <div className="table-summary archive-summary">
          {totalCount} archived item{totalCount !== 1 ? 's' : ''}
          {onClearAll && (
            <button 
              className="btn-clear-all-archive"
              onClick={onClearAll}
              title="Clear all archive"
            >
              🗑️ Clear All
            </button>
          )}
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
              {requests.map((item, index) => (
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
                      {item.accessTypes?.map((accessType, idx) => (
                        <span key={idx} className="archive-type-icon" title={getAccessTypeLabel(accessType)}>
                          {getAccessTypeIcon(accessType)}
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
  }

  return null;
};

export default PIIRequestsTable;
