import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import PIIRequestModal from './PIIRequestModal';
import './SearchPage.css';

const Shortlist = () => {
  const [shortlist, setShortlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [piiRequests, setPiiRequests] = useState({});
  const [piiAccessMap, setPiiAccessMap] = useState({});
  const [piiRequestsMap, setPiiRequestsMap] = useState({});
  
  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // PII Request modal state
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    loadShortlist();
    loadPiiRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadShortlist = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/shortlist/${username}`);
      setShortlist(response.data.shortlist || []);
    } catch (err) {
      console.error('Error loading shortlist:', err);
      setError('Failed to load shortlist');
    } finally {
      setLoading(false);
    }
  };

  const loadPiiRequests = async () => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) return;

    try {
      const [requestsResponse, accessResponse] = await Promise.all([
        api.get(`/pii-requests/${currentUser}/outgoing`),
        api.get(`/pii-access/${currentUser}/received`)
      ]);

      const requests = requestsResponse.data.requests || [];
      const receivedAccess = accessResponse.data.receivedAccess || accessResponse.data.access || [];
      const requestStatus = {};
      const piiMap = {};
      const piiReqMap = {};

      // Track detailed request status
      requests.forEach(req => {
        const targetUsername = req.profileUsername || req.requestedUsername || req.profileOwner?.username;
        if (targetUsername && req.requestType) {
          if (!piiReqMap[targetUsername]) {
            piiReqMap[targetUsername] = {};
          }
          piiReqMap[targetUsername][req.requestType] = req.status;
          requestStatus[`${targetUsername}_${req.requestType}`] = req.status;
        }
      });

      // Track approved access
      receivedAccess.forEach(access => {
        const targetUsername = access.userProfile?.username;
        if (targetUsername) {
          piiMap[targetUsername] = {
            hasContactAccess: access.accessTypes?.includes('contact_info'),
            hasImageAccess: access.accessTypes?.includes('images'),
            hasDateOfBirthAccess: access.accessTypes?.includes('date_of_birth'),
            hasLinkedInAccess: access.accessTypes?.includes('linkedin_url')
          };
          access.accessTypes?.forEach(accessType => {
            requestStatus[`${targetUsername}_${accessType}`] = 'approved';
            if (!piiReqMap[targetUsername]) {
              piiReqMap[targetUsername] = {};
            }
            piiReqMap[targetUsername][accessType] = 'approved';
          });
        }
      });

      setPiiRequests(requestStatus);
      setPiiAccessMap(piiMap);
      setPiiRequestsMap(piiReqMap);
    } catch (err) {
      console.error('Error loading PII requests:', err);
    }
  };

  const hasPiiAccess = (targetUsername) => {
    return piiRequests[`${targetUsername}_contact_info`] === 'approved';
  };

  const hasImageAccess = (targetUsername) => {
    return piiRequests[`${targetUsername}_images`] === 'approved';
  };

  const isPiiRequestPending = (targetUsername) => {
    return piiRequests[`${targetUsername}_contact_info`] === 'pending';
  };

  const isImageRequestPending = (targetUsername) => {
    return piiRequests[`${targetUsername}_images`] === 'pending';
  };

  const handlePIIRequest = (user) => {
    setSelectedUserForPII(user);
    setShowPIIRequestModal(true);
  };

  const handlePIIRequestSuccess = async () => {
    await loadPiiRequests();
    setShowPIIRequestModal(false);
    setSelectedUserForPII(null);
  };

  const getPIIRequestStatus = (username) => {
    const userRequests = piiRequestsMap[username] || {};
    const userAccess = piiAccessMap[username] || {};
    
    return {
      images: userRequests.images || (userAccess.hasImageAccess ? 'approved' : null),
      contact_info: userRequests.contact_info || (userAccess.hasContactAccess ? 'approved' : null),
      date_of_birth: userRequests.date_of_birth || (userAccess.hasDateOfBirthAccess ? 'approved' : null),
      linkedin_url: userRequests.linkedin_url || (userAccess.hasLinkedInAccess ? 'approved' : null)
    };
  };

  const removeFromShortlist = async (user) => {
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/shortlist/${user.username}?username=${encodeURIComponent(username)}`);
      setShortlist(shortlist.filter(item => item.username !== user.username));
      setStatusMessage('✅ Removed from shortlist!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing from shortlist:', err);
      setError('Failed to remove from shortlist');
      setStatusMessage('❌ Failed to remove from shortlist');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleMessage = async (user) => {
    // If user object doesn't have full profile data, fetch it
    if (!user.firstName && !user.location && user.username) {
      try {
        const response = await api.get(`/profile/${user.username}?requester=${currentUsername}`);
        setSelectedUser(response.data);
      } catch (err) {
        console.error('Error loading user profile:', err);
        // Fallback to existing user object
        setSelectedUser(user);
      }
    } else {
      setSelectedUser(user);
    }
    setShowMessageModal(true);
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="search-page">
      <div className="container-fluid">
        <h2 className="mb-4">📋 My Shortlist</h2>

        {statusMessage && (
          <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
            {statusMessage}
            <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
          </div>
        )}

        {shortlist.length === 0 ? (
          <div className="alert alert-info">
            <p className="mb-0">No profiles in shortlist yet. Add profiles you're considering!</p>
          </div>
        ) : (
          <div className="results-grid">
            {shortlist.map(user => (
              <SearchResultCard
                key={user.username}
                user={user}
                currentUsername={localStorage.getItem('username')}
                onRemove={removeFromShortlist}
                onMessage={handleMessage}
                onPIIRequest={handlePIIRequest}
                isShortlisted={true}
                hasPiiAccess={hasPiiAccess(user.username)}
                hasImageAccess={hasImageAccess(user.username)}
                isPiiRequestPending={isPiiRequestPending(user.username)}
                isImageRequestPending={isImageRequestPending(user.username)}
                piiRequestStatus={getPIIRequestStatus(user.username)}
                showFavoriteButton={false}
                showShortlistButton={false}
                showExcludeButton={false}
                showRemoveButton={true}
                removeButtonLabel="Remove from Shortlist"
                removeButtonIcon="📋"
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Message Modal */}
      {showMessageModal && selectedUser && (
        <MessageModal
          isOpen={showMessageModal}
          profile={selectedUser}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* PII Request Modal */}
      {showPIIRequestModal && selectedUserForPII && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={selectedUserForPII.username}
          profileName={`${selectedUserForPII.firstName || selectedUserForPII.username}`}
          onClose={() => {
            setShowPIIRequestModal(false);
            setSelectedUserForPII(null);
          }}
          onSuccess={handlePIIRequestSuccess}
          currentAccess={piiAccessMap[selectedUserForPII.username] || {}}
          requestStatus={getPIIRequestStatus(selectedUserForPII.username)}
        />
      )}
    </div>
  );
};

export default Shortlist;
