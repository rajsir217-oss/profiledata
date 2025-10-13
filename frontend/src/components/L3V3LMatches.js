import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchUsers } from '../api';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import PIIRequestModal from './PIIRequestModal';
import './SearchPage.css';

const L3V3LMatches = () => {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem('username');

  // State
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  
  // User interactions
  const [favoritedUsers, setFavoritedUsers] = useState(new Set());
  const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
  const [excludedUsers, setExcludedUsers] = useState(new Set());
  const [piiAccessMap, setPiiAccessMap] = useState({});
  const [pendingPiiRequests, setPendingPiiRequests] = useState(new Set());

  // Modals
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);

  // Fetch L3V3L matches on component mount
  useEffect(() => {
    fetchL3V3LMatches();
    loadUserPreferences();
  }, []);

  const fetchL3V3LMatches = async () => {
    setLoading(true);
    setError('');
    
    try {
      // For now, use regular search endpoint
      // TODO: Implement L3V3L matching algorithm on backend
      console.log('🦋 Fetching L3V3L matches...');
      
      const response = await searchUsers({
        keyword: '',
        page: 1,
        limit: 50
      });

      console.log('✅ L3V3L matches response:', response);
      
      const users = response.users || [];
      setMatches(users);
      
      console.log(`Found ${users.length} matches`);
      
    } catch (err) {
      console.error('❌ Error fetching L3V3L matches:', err);
      console.error('Error details:', err.response?.data || err.message);
      
      // Don't show error for empty results
      if (err.response?.status === 404 || err.message?.includes('No users found')) {
        setMatches([]);
      } else {
        setError('Failed to load your L3V3L matches. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      // Load favorites
      const favResponse = await api.get(`/favorites/${currentUsername}`);
      setFavoritedUsers(new Set(favResponse.data.map(u => u.username)));

      // Load shortlist
      const shortlistResponse = await api.get(`/shortlist/${currentUsername}`);
      setShortlistedUsers(new Set(shortlistResponse.data.map(u => u.username)));

      // Load exclusions
      const exclusionsResponse = await api.get(`/exclusions/${currentUsername}`);
      setExcludedUsers(new Set(exclusionsResponse.data.map(u => u.username)));

      // Load PII access
      const piiResponse = await api.get(`/pii-access-status?username=${currentUsername}`);
      const piiMap = {};
      piiResponse.data.forEach(access => {
        piiMap[access.profile_owner] = {
          hasContactAccess: access.has_contact_access,
          hasImageAccess: access.has_image_access
        };
      });
      setPiiAccessMap(piiMap);

    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  // Action handlers
  const handleFavorite = async (user) => {
    try {
      if (favoritedUsers.has(user.username)) {
        await api.delete(`/favorites/${user.username}?username=${currentUsername}`);
        setFavoritedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.username);
          return newSet;
        });
      } else {
        await api.post('/favorites', {
          username: currentUsername,
          targetUsername: user.username
        });
        setFavoritedUsers(prev => new Set(prev).add(user.username));
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  const handleShortlist = async (user) => {
    try {
      if (shortlistedUsers.has(user.username)) {
        await api.delete(`/shortlist/${user.username}?username=${currentUsername}`);
        setShortlistedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.username);
          return newSet;
        });
      } else {
        await api.post('/shortlist', {
          username: currentUsername,
          targetUsername: user.username
        });
        setShortlistedUsers(prev => new Set(prev).add(user.username));
      }
    } catch (error) {
      console.error('Error updating shortlist:', error);
    }
  };

  const handleExclude = async (user) => {
    try {
      if (excludedUsers.has(user.username)) {
        await api.delete(`/exclusions/${user.username}?username=${currentUsername}`);
        setExcludedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.username);
          return newSet;
        });
      } else {
        await api.post('/exclusions', {
          username: currentUsername,
          targetUsername: user.username
        });
        setExcludedUsers(prev => new Set(prev).add(user.username));
        // Remove from matches
        setMatches(prev => prev.filter(u => u.username !== user.username));
      }
    } catch (error) {
      console.error('Error updating exclusions:', error);
    }
  };

  const handleMessage = (user) => {
    setSelectedUser(user);
    setShowMessageModal(true);
  };

  const handlePIIRequest = (user) => {
    setSelectedUser(user);
    setShowPIIRequestModal(true);
  };

  const handlePIIRequestSubmit = async (requestData) => {
    try {
      await api.post('/pii-requests', requestData);
      setPendingPiiRequests(prev => new Set(prev).add(selectedUser.username));
      setShowPIIRequestModal(false);
    } catch (error) {
      console.error('Error submitting PII request:', error);
    }
  };

  return (
    <div className="search-container">
      {/* Header */}
      <div className="search-header">
        <div className="search-header-content">
          <h1>🦋 My L3V3L Matches</h1>
          <p className="search-subtitle">
            Discover connections based on Love, Loyalty, Laughter, Vulnerability, and Elevation
          </p>
        </div>
        
        <div className="search-header-actions">
          <button
            className="btn btn-outline-primary"
            onClick={() => navigate('/l3v3l-info')}
          >
            ℹ️ What is L3V3L?
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setViewMode(viewMode === 'cards' ? 'rows' : 'cards')}
          >
            {viewMode === 'cards' ? '📋 Row View' : '🎴 Card View'}
          </button>
        </div>
      </div>

      {/* L3V3L Info Banner */}
      <div className="l3v3l-banner">
        <div className="l3v3l-banner-content">
          <h3>🎯 L3V3L Matching Algorithm</h3>
          <p>
            Our intelligent matching algorithm considers compatibility across all five pillars:
            emotional connection, trust, joy, authenticity, and mutual growth.
          </p>
          <div className="l3v3l-pillars-mini">
            <span className="pillar-badge">💕 Love</span>
            <span className="pillar-badge">🤝 Loyalty</span>
            <span className="pillar-badge">😄 Laughter</span>
            <span className="pillar-badge">💭 Vulnerability</span>
            <span className="pillar-badge">🚀 Elevation</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading matches...</span>
          </div>
          <p className="mt-3">Finding your L3V3L matches...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          <div className="results-header">
            <h5>
              {matches.length > 0
                ? `${matches.length} L3V3L Match${matches.length !== 1 ? 'es' : ''} Found`
                : 'No matches found yet'}
            </h5>
          </div>

          {matches.length === 0 && !loading && (
            <div className="no-results">
              <div className="no-results-icon">🦋</div>
              <h3>No L3V3L Matches Yet</h3>
              <p>We're working on finding your perfect matches. Check back soon!</p>
              <button
                className="btn btn-primary mt-3"
                onClick={() => navigate('/search')}
              >
                Browse All Profiles
              </button>
            </div>
          )}

          <div className={`results-grid ${viewMode === 'rows' ? 'results-rows' : 'results-cards'}`}>
            {matches.map((user) => {
              const piiAccess = piiAccessMap[user.username] || {};
              return (
                <SearchResultCard
                  key={user.username}
                  user={user}
                  currentUsername={currentUsername}
                  onFavorite={handleFavorite}
                  onShortlist={handleShortlist}
                  onExclude={handleExclude}
                  onMessage={handleMessage}
                  onPIIRequest={handlePIIRequest}
                  isFavorited={favoritedUsers.has(user.username)}
                  isShortlisted={shortlistedUsers.has(user.username)}
                  isExcluded={excludedUsers.has(user.username)}
                  hasPiiAccess={piiAccess.hasContactAccess || false}
                  hasImageAccess={piiAccess.hasImageAccess || false}
                  isPiiRequestPending={pendingPiiRequests.has(user.username)}
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showMessageModal && (
        <MessageModal
          show={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          recipient={selectedUser}
        />
      )}

      {showPIIRequestModal && (
        <PIIRequestModal
          show={showPIIRequestModal}
          onClose={() => setShowPIIRequestModal(false)}
          targetUser={selectedUser}
          onSubmit={handlePIIRequestSubmit}
        />
      )}
    </div>
  );
};

export default L3V3LMatches;
