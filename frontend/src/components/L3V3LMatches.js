import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import SearchResultCard from './SearchResultCard';
import MessageModal from './MessageModal';
import PIIRequestModal from './PIIRequestModal';
import PageHeader from './PageHeader';
import { onPIIAccessChange } from '../utils/piiAccessEvents';
import './SearchPage.css';

const L3V3LMatches = () => {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem('username');

  // State
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  const [minMatchScore, setMinMatchScore] = useState(0); // Filter: minimum match score (0-100)
  
  // User interactions
  const [favoritedUsers, setFavoritedUsers] = useState(new Set());
  const [shortlistedUsers, setShortlistedUsers] = useState(new Set());
  const [excludedUsers, setExcludedUsers] = useState(new Set());
  const [piiAccessMap, setPiiAccessMap] = useState({});
  const [pendingPiiRequests, setPendingPiiRequests] = useState(new Set());
  const [piiRequestsMap, setPiiRequestsMap] = useState({}); // Detailed status per request type

  // Modals
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);

  // Fetch L3V3L matches on component mount
  useEffect(() => {
    fetchL3V3LMatches();
    loadUserPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for PII access changes (grant/revoke)
  useEffect(() => {
    const cleanup = onPIIAccessChange(async (detail) => {
      const { targetUsername, ownerUsername } = detail;
      
      console.log('🔔 L3V3L Matches - PII Access Change:', detail);
      
      // If someone granted or revoked access to the current user
      // Or if current user's access was revoked
      if (targetUsername === currentUsername || ownerUsername === currentUsername) {
        console.log('🔄 Refreshing PII access status in L3V3L Matches...');
        
        // Reload user preferences to get updated access status
        await loadUserPreferences();
      }
    });
    
    // Cleanup listener on unmount
    return cleanup;
  }, [currentUsername]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchL3V3LMatches = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🦋 Fetching L3V3L matches with AI algorithm...');
      
      // Use new L3V3L matching endpoint
      const response = await api.get(`/l3v3l-matches/${currentUsername}`, {
        params: {
          limit: 50,
          min_score: 0  // Show all matches (even with 0% score for testing)
        }
      });

      console.log('✅ L3V3L matches response:', response.data);
      
      const matches = response.data.matches || [];
      setMatches(matches);
      
      console.log(`Found ${matches.length} L3V3L matches`);
      console.log(`Algorithm version: ${response.data.algorithm_version}`);
      console.log(`ML enabled: ${response.data.ml_enabled}`);
      
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
      // Load favorites - API: GET /favorites/{username}
      const favResponse = await api.get(`/favorites/${currentUsername}`);
      const favorites = favResponse.data.favorites || favResponse.data || [];
      setFavoritedUsers(new Set(favorites.map(u => u.username || u)));

      // Load shortlist - API: GET /shortlist/{username}
      const shortlistResponse = await api.get(`/shortlist/${currentUsername}`);
      const shortlist = shortlistResponse.data.shortlist || shortlistResponse.data || [];
      setShortlistedUsers(new Set(shortlist.map(u => u.username || u)));

      // Load exclusions - API: GET /exclusions/{username}
      const exclusionsResponse = await api.get(`/exclusions/${currentUsername}`);
      const exclusions = exclusionsResponse.data.exclusions || exclusionsResponse.data || [];
      setExcludedUsers(new Set(exclusions.map(u => u.username || u)));

      // Load PII access - Load outgoing requests and received access
      let requests = [];
      let receivedAccess = [];
      
      try {
        console.log('🚀 Loading PII requests and access for:', currentUsername);
        
        const [requestsResponse, accessResponse] = await Promise.all([
          api.get(`/pii-requests/${currentUsername}/outgoing`),
          api.get(`/pii-access/${currentUsername}/received`)
        ]);
        
        console.log('✅ Got PII responses!', { 
          requests: requestsResponse.data,
          access: accessResponse.data 
        });
        
        requests = requestsResponse.data.requests || [];
        receivedAccess = accessResponse.data.receivedAccess || accessResponse.data.access || [];
      } catch (err) {
        console.error('Error loading PII access:', err);
        // Continue with empty arrays if fetch fails
      }
      
      const piiMap = {};
      const piiRequestsMap = {};
      
      // Track ONLY pending requests (approved must be in receivedAccess to be truly active)
      requests.forEach(req => {
        // Backend returns profileOwner as nested object with username
        const targetUsername = req.profileOwner?.username || req.profileUsername;
        if (targetUsername && req.requestType && req.status === 'pending') {
          if (!piiRequestsMap[targetUsername]) {
            piiRequestsMap[targetUsername] = {};
          }
          console.log(`📋 PII Request: ${targetUsername} - ${req.requestType} = pending`);
          piiRequestsMap[targetUsername][req.requestType] = 'pending';
        }
      });
      
      // Add received ACTIVE access grants (isActive: true from backend)
      receivedAccess.forEach(access => {
        const targetUsername = access.userProfile?.username;
        if (targetUsername) {
          piiMap[targetUsername] = {
            hasContactAccess: access.accessTypes?.includes('contact_info'),
            hasImageAccess: access.accessTypes?.includes('images'),
            hasDateOfBirthAccess: access.accessTypes?.includes('date_of_birth'),
            hasLinkedInAccess: access.accessTypes?.includes('linkedin_url')
          };
          
          // Also add to piiRequestsMap as 'approved' for consistency
          if (!piiRequestsMap[targetUsername]) {
            piiRequestsMap[targetUsername] = {};
          }
          access.accessTypes?.forEach(accessType => {
            console.log(`✅ PII Access: ${targetUsername} - ${accessType} = approved (active)`);
            piiRequestsMap[targetUsername][accessType] = 'approved';
          });
        }
      });
      
      setPiiAccessMap(piiMap);
      setPiiRequestsMap(piiRequestsMap); // Save detailed request status
      
      // Track pending requests (for backward compatibility)
      const pendingSet = new Set();
      requests.forEach(req => {
        if (req.status === 'pending') {
          const targetUsername = req.profileUsername || req.requestedUsername || req.profileOwner?.username;
          if (targetUsername) {
            pendingSet.add(targetUsername);
          }
        }
      });
      setPendingPiiRequests(pendingSet);

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
        await api.post(`/favorites/${user.username}?username=${currentUsername}`);
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
        await api.post(`/shortlist/${user.username}?username=${currentUsername}`);
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
        await api.post(`/exclusions/${user.username}?username=${currentUsername}`);
        setExcludedUsers(prev => new Set(prev).add(user.username));
        
        // Auto-remove from favorites and shortlist when excluding
        const wasInFavorites = favoritedUsers.has(user.username);
        const wasInShortlist = shortlistedUsers.has(user.username);
        
        if (wasInFavorites) {
          try {
            await api.delete(`/favorites/${user.username}?username=${currentUsername}`);
            setFavoritedUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(user.username);
              return newSet;
            });
            console.log(`Auto-removed ${user.username} from favorites when excluding`);
          } catch (err) {
            console.error('Error removing from favorites during exclude:', err);
          }
        }
        
        if (wasInShortlist) {
          try {
            await api.delete(`/shortlist/${user.username}?username=${currentUsername}`);
            setShortlistedUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(user.username);
              return newSet;
            });
            console.log(`Auto-removed ${user.username} from shortlist when excluding`);
          } catch (err) {
            console.error('Error removing from shortlist during exclude:', err);
          }
        }
        
        // Remove from matches
        setMatches(prev => prev.filter(u => u.username !== user.username));
      }
    } catch (error) {
      console.error('Error updating exclusions:', error);
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

  const handlePIIRequest = (user) => {
    setSelectedUser(user);
    setShowPIIRequestModal(true);
  };

  // Get current PII access for a user
  const getCurrentPIIAccess = (username) => {
    const userAccess = piiAccessMap[username] || {};
    const hasPendingRequest = pendingPiiRequests.has(username);
    
    return {
      images: userAccess.hasImageAccess || hasPendingRequest,
      contact_info: userAccess.hasContactAccess || hasPendingRequest,
      date_of_birth: hasPendingRequest, // Assuming pending requests cover all types
      linkedin_url: hasPendingRequest
    };
  };

  // Get PII request status for all types (for button display)
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

  // Filter matches by minimum match score
  const filteredMatches = matches.filter(user => {
    const score = user.matchScore || 0;
    return score >= minMatchScore;
  });

  const handlePIIRequestSuccess = async () => {
    // Reload PII access status after successful request
    await loadUserPreferences();
    setShowPIIRequestModal(false);
    setSelectedUser(null);
  };

  return (
    <div className="search-container">
      {/* Header */}
      <PageHeader
        icon="🦋"
        title="My L3V3L Matches"
        subtitle="Discover connections based on Love, Loyalty, Laughter, Vulnerability, and Elevation"
        variant="gradient"
        actions={
          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              <span className="toggle-icon">⊞</span>
              <span className="toggle-text">Cards</span>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'rows' ? 'active' : ''}`}
              onClick={() => setViewMode('rows')}
              title="Row View"
            >
              <span className="toggle-icon">☰</span>
              <span className="toggle-text">Rows</span>
            </button>
          </div>
        }
      />

      {/* Match Score Filter Slider */}
      <div className="l3v3l-score-filter">
        <div className="score-filter-content">
          <label htmlFor="matchScoreSlider" className="score-filter-label">
            <span className="filter-icon">🎯</span>
            <span className="filter-text">Minimum L3V3L Match Score:</span>
            <span className="filter-value">{minMatchScore}%</span>
          </label>
          <input
            id="matchScoreSlider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={minMatchScore}
            onChange={(e) => setMinMatchScore(Number(e.target.value))}
            className="match-score-slider"
          />
          <div className="slider-labels">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="filter-info">
          {matches.length > 0 ? `Showing ${filteredMatches.length} of ${matches.length} matches` : 'Adjust the minimum match score to see more results'}
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
          {filteredMatches.length === 0 && matches.length > 0 && (
            <div className="no-results">
              <div className="no-results-icon">🎯</div>
              <h3>No matches at {minMatchScore}% or higher</h3>
              <p>Try lowering the minimum match score to see more results.</p>
            </div>
          )}

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
            {filteredMatches.map((user) => {
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
                  piiRequestStatus={getPIIRequestStatus(user.username)}
                  viewMode={viewMode}
                  showFavoriteButton={true}
                  showShortlistButton={true}
                  showExcludeButton={true}
                  showMessageButton={true}
                />
              );
            })}
          </div>
        </>
      )}

      {/* L3V3L Info Banner - Below results */}
      <div className="l3v3l-banner">
        <div className="l3v3l-banner-content">
          <h3>🎯 AI-Powered L3V3L Matching Algorithm</h3>
          <p>
            Our comprehensive AI algorithm analyzes <strong>8 key dimensions</strong> including gender compatibility,
            L3V3L values, demographics, partner preferences, habits, career, physical attributes, and cultural factors.
          </p>
          <div className="l3v3l-pillars-mini">
            <span className="pillar-badge">💕 Love</span>
            <span className="pillar-badge">🤝 Loyalty</span>
            <span className="pillar-badge">😄 Laughter</span>
            <span className="pillar-badge">💭 Vulnerability</span>
            <span className="pillar-badge">🚀 Elevation</span>
          </div>
          <div style={{marginTop: '10px', fontSize: '12px', opacity: 0.8}}>
            ✨ Powered by Proprietary AI Matching Algorithm
          </div>
        </div>
      </div>

      {/* Advanced Search Promotion Banner - Below results */}
      <div className="cross-link-banner search-promo">
        <div className="banner-icon">🔍</div>
        <div className="banner-content">
          <h5>🎯 Looking for Specific Criteria?</h5>
          <p>Use our advanced search with 15+ filters to find exactly what you're looking for!</p>
        </div>
        <button
          className="btn btn-primary banner-cta"
          onClick={() => navigate('/search')}
        >
          Try Advanced Search →
        </button>
      </div>

      {/* Modals */}
      {showMessageModal && selectedUser && (
        <MessageModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedUser(null);
          }}
          profile={selectedUser}
        />
      )}

      {showPIIRequestModal && selectedUser && (
        <PIIRequestModal
          isOpen={showPIIRequestModal}
          profileUsername={selectedUser.username}
          profileName={`${selectedUser.firstName || selectedUser.username}`}
          onClose={() => {
            setShowPIIRequestModal(false);
            setSelectedUser(null);
          }}
          onSuccess={handlePIIRequestSuccess}
          currentAccess={getCurrentPIIAccess(selectedUser.username)}
          requestStatus={getPIIRequestStatus(selectedUser.username)}
        />
      )}
    </div>
  );
};

export default L3V3LMatches;
