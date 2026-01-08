import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import './SearchPage2.css';

const Exclusions = () => {
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [piiRequests, setPiiRequests] = useState({});
  const navigate = useNavigate();

  const loadExclusions = useCallback(async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/exclusions/${username}`);
      setExclusions(response.data.exclusions || []);
    } catch (err) {
      console.error('Error loading exclusions:', err);
      setError('Failed to load not interested list');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadPiiRequests = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadExclusions();
    loadPiiRequests();
  }, [loadExclusions, loadPiiRequests]);

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

  const removeExclusion = async (user) => {
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        setError('Please login to perform this action');
        return;
      }

      // Handle both string usernames and user objects
      const targetUsername = typeof user === 'string' ? user : user.username;

      await api.delete(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);

      // Remove from local state
      setExclusions(prev => prev.filter(item => {
        const itemUsername = typeof item === 'string' ? item : item.username;
        return itemUsername !== targetUsername;
      }));

      setStatusMessage('✅ Removed from not interested!');
      setTimeout(() => setStatusMessage(''), 3000);
      console.log(`Successfully removed ${targetUsername} from exclusions`);
    } catch (err) {
      console.error('Error removing exclusion:', err);
      setError('Failed to remove from not interested');
      setStatusMessage('❌ Failed to remove from not interested');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleMessage = (user) => {
    navigate(`/messages?user=${user.username}`);
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;

  return (
    <div className="search-page">
      <div className="container-fluid">
        <h2 className="mb-4">🙈 Not Interested</h2>

        {statusMessage && (
          <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
            {statusMessage}
            <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {exclusions.length === 0 ? (
          <div className="alert alert-info">
            <p className="mb-0">No profiles marked as not interested. These profiles will be hidden from your search results.</p>
          </div>
        ) : (
          <div className="results-grid">
            {exclusions.map(item => {
              // Handle both string usernames and user objects
              const user = typeof item === 'string' ? { username: item } : item;
              const isFullProfile = typeof item !== 'string';

              // If only username is available, show simple card
              if (!isFullProfile) {
                return (
                  <div key={user.username} className="result-card">
                    <div className="card">
                      <div className="card-title-section">
                        <h6 className="card-title">{user.username}</h6>
                      </div>
                      <div className="card-body">
                        <p className="text-muted mb-3">This profile is hidden from search results</p>
                        <div className="card-actions">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeExclusion(user)}
                          >
                            Remove
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/profile/${user.username}`)}
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Full profile data - use SearchResultCard
              return (
                <SearchResultCard
                  key={user.username}
                  user={user}
                  currentUsername={localStorage.getItem('username')}
                  onRemove={removeExclusion}
                  onMessage={handleMessage}
                  onPIIRequest={handlePIIRequest}
                  isExcluded={true}
                  hasPiiAccess={hasPiiAccess(user.username)}
                  hasImageAccess={hasImageAccess(user.username)}
                  isPiiRequestPending={isPiiRequestPending(user.username)}
                  isImageRequestPending={isImageRequestPending(user.username)}
                  showFavoriteButton={false}
                  showShortlistButton={false}
                  showExcludeButton={false}
                  showRemoveButton={true}
                  removeButtonLabel="Remove"
                  removeButtonIcon="🚫"
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Exclusions;
