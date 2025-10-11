import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import './SearchPage.css';

const Shortlist = () => {
  const [shortlist, setShortlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [piiRequests, setPiiRequests] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadShortlist();
    loadPiiRequests();
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
      const receivedAccess = accessResponse.data.receivedAccess || [];
      const requestStatus = {};

      requests.forEach(req => {
        const targetUsername = req.profileUsername || req.requestedUsername;
        requestStatus[`${targetUsername}_${req.requestType}`] = req.status;
      });

      receivedAccess.forEach(access => {
        const targetUsername = access.userProfile.username;
        access.accessTypes.forEach(accessType => {
          requestStatus[`${targetUsername}_${accessType}`] = 'approved';
        });
      });

      setPiiRequests(requestStatus);
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
    navigate(`/profile/${user.username}`);
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

  const handleMessage = (user) => {
    navigate(`/messages?user=${user.username}`);
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
    </div>
  );
};

export default Shortlist;
