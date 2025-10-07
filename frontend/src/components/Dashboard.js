import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Dashboard data states
  const [dashboardData, setDashboardData] = useState({
    myMessages: [],
    myFavorites: [],
    myShortlists: [],
    myViews: [],
    myExclusions: [],
    myRequests: [],
    theirFavorites: [],
    theirShortlists: []
  });
  
  const [activeSections, setActiveSections] = useState({
    myMessages: true,
    myFavorites: true,
    myShortlists: true,
    myViews: true,
    myExclusions: false,
    myRequests: true,
    theirFavorites: true,
    theirShortlists: true
  });

  const currentUser = localStorage.getItem('username');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    loadDashboardData();
  }, [currentUser, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Load all dashboard data
      const [
        messagesRes,
        myFavoritesRes,
        myShortlistsRes,
        profileViewsRes,
        myExclusionsRes,
        requestsRes,
        theirFavoritesRes,
        theirShortlistsRes
      ] = await Promise.all([
        api.get(`/messages/${currentUser}`),
        api.get(`/favorites/${currentUser}`),
        api.get(`/shortlist/${currentUser}`),
        api.get(`/profile-views/${currentUser}`),
        api.get(`/exclusions/${currentUser}`),
        api.get(`/pii-requests/${currentUser}?type=received`),
        api.get(`/their-favorites/${currentUser}`),
        api.get(`/their-shortlists/${currentUser}`)
      ]);

      setDashboardData({
        myMessages: messagesRes.data.messages || [],
        myFavorites: myFavoritesRes.data.favorites || [],
        myShortlists: myShortlistsRes.data.shortlist || [],
        myViews: profileViewsRes.data.views || [],
        myExclusions: myExclusionsRes.data.exclusions || [],
        myRequests: requestsRes.data.requests || [],
        theirFavorites: theirFavoritesRes.data.users || [],
        theirShortlists: theirShortlistsRes.data.users || []
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = (username) => {
    navigate(`/profile/${username}`);
  };

  const handleMessageUser = (username) => {
    navigate(`/messages?to=${username}`);
  };

  const toggleSection = (section) => {
    setActiveSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Remove handlers for each category
  const handleRemoveFromFavorites = async (targetUsername) => {
    try {
      await api.delete(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
      setDashboardData(prev => ({
        ...prev,
        myFavorites: prev.myFavorites.filter(u => 
          (typeof u === 'string' ? u : u.username) !== targetUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to remove from favorites: ${err.message}`);
    }
  };

  const handleRemoveFromShortlist = async (targetUsername) => {
    try {
      await api.delete(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
      setDashboardData(prev => ({
        ...prev,
        myShortlists: prev.myShortlists.filter(u => 
          (typeof u === 'string' ? u : u.username) !== targetUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to remove from shortlist: ${err.message}`);
    }
  };

  const handleRemoveFromExclusions = async (targetUsername) => {
    try {
      await api.delete(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
      setDashboardData(prev => ({
        ...prev,
        myExclusions: prev.myExclusions.filter(u => 
          (typeof u === 'string' ? u : u.username) !== targetUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to remove from exclusions: ${err.message}`);
    }
  };

  const handleDeleteMessage = async (messageId, fromUsername) => {
    try {
      // For now, just remove from UI - backend endpoint needs to be created
      setDashboardData(prev => ({
        ...prev,
        myMessages: prev.myMessages.filter(m => 
          (typeof m === 'string' ? m : m.username) !== fromUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to delete message: ${err.message}`);
    }
  };

  const handleClearViewHistory = async (viewerUsername) => {
    try {
      // For now, just remove from UI - backend endpoint needs to be created
      setDashboardData(prev => ({
        ...prev,
        myViews: prev.myViews.filter(v => 
          (typeof v === 'string' ? v : v.username) !== viewerUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to clear view history: ${err.message}`);
    }
  };

  const handleCancelPIIRequest = async (requestUsername) => {
    try {
      // For now, just remove from UI - backend endpoint needs to be created  
      setDashboardData(prev => ({
        ...prev,
        myRequests: prev.myRequests.filter(r => 
          (typeof r === 'string' ? r : r.username) !== requestUsername
        )
      }));
    } catch (err) {
      console.error(`Failed to cancel request: ${err.message}`);
    }
  };

  const renderUserCard = (user, showActions = true, removeHandler = null, removeIcon = '❌') => {
    // Handle different data structures (profile views have viewerProfile nested)
    if (!user) return null;
    
    const profileData = user.viewerProfile || user;
    const username = profileData?.username || user.username;
    const viewedAt = user.viewedAt; // For profile views
    
    // Safety check
    if (!username) {
      console.warn('User card missing username:', user);
      return null;
    }
    
    return (
      <div key={username} className="user-card" onClick={() => handleProfileClick(username)}>
        <div className="user-card-header">
          <div className="user-avatar">
            {profileData?.images?.[0] || profileData?.profileImage ? (
              <img src={profileData.images?.[0] || profileData.profileImage} alt={username} />
            ) : (
              <div className="avatar-placeholder">
                {profileData?.firstName?.[0] || username?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          {profileData?.isOnline && <span className="online-badge">●</span>}
        </div>
        
        <div className="user-card-body">
          <h4 className="username">{profileData?.firstName || username}</h4>
          {profileData?.age && <p className="user-age">{profileData.age} years</p>}
          {profileData?.location && <p className="user-location">📍 {profileData.location}</p>}
          {profileData?.occupation && <p className="user-occupation">💼 {profileData.occupation}</p>}
          {viewedAt && (
            <p className="last-seen">Viewed: {new Date(viewedAt).toLocaleString()}</p>
          )}
          {profileData?.lastSeen && !viewedAt && (
            <p className="last-seen">Last seen: {new Date(profileData.lastSeen).toLocaleDateString()}</p>
          )}
        </div>
        
        {showActions && (
          <div className="user-card-actions">
            <button 
              className="btn-message"
              onClick={(e) => {
                e.stopPropagation();
                handleMessageUser(username);
              }}
              title="Send Message"
            >
              💬
            </button>
            <button 
              className="btn-view-profile"
              onClick={(e) => {
                e.stopPropagation();
                handleProfileClick(username);
              }}
              title="View Profile"
            >
              👁️
            </button>
            {removeHandler && (
              <button 
                className="btn-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeHandler(username);
                }}
                title="Remove"
              >
                {removeIcon}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title, data, sectionKey, icon, color, removeHandler = null, removeIcon = '❌') => {
    const isExpanded = activeSections[sectionKey];
    const count = data.length;
    
    return (
      <div className="dashboard-section">
        <div 
          className="section-header"
          onClick={() => toggleSection(sectionKey)}
          style={{ backgroundColor: color }}
        >
          <div className="section-title">
            <span className="section-icon">{icon}</span>
            <h3>{title}</h3>
            <span className="section-count">{count}</span>
          </div>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
        
        {isExpanded && (
          <div className="section-content">
            {data.length > 0 ? (
              <div className="user-cards-grid">
                {data.map(user => renderUserCard(user, true, removeHandler, removeIcon))}
              </div>
            ) : (
              <div className="empty-section">
                <p>No {title.toLowerCase()} yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={loadDashboardData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>My Dashboard</h1>
        <p>Welcome back, {currentUser}!</p>
        <button 
          className="btn-refresh"
          onClick={loadDashboardData}
          title="Refresh Dashboard"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="dashboard-grid">
        {/* My Activities */}
        <div className="dashboard-column">
          <h2 className="column-title">My Activities</h2>
          {renderSection('My Messages', dashboardData.myMessages, 'myMessages', '💬', '#667eea', handleDeleteMessage, '🗑️')}
          {renderSection('My Favorites', dashboardData.myFavorites, 'myFavorites', '⭐', '#ff6b6b', handleRemoveFromFavorites, '💔')}
          {renderSection('My Shortlists', dashboardData.myShortlists, 'myShortlists', '📋', '#4ecdc4', handleRemoveFromShortlist, '📤')}
          {renderSection('My Exclusions', dashboardData.myExclusions, 'myExclusions', '❌', '#95a5a6', handleRemoveFromExclusions, '✅')}
        </div>

        {/* Others' Activities */}
        <div className="dashboard-column">
          <h2 className="column-title">Others' Activities</h2>
          {renderSection('Profile Views', dashboardData.myViews, 'myViews', '👁️', '#f39c12', handleClearViewHistory, '🗑️')}
          {renderSection('PII Requests', dashboardData.myRequests, 'myRequests', '🔒', '#9b59b6', handleCancelPIIRequest, '❌')}
          {renderSection('Their Favorites', dashboardData.theirFavorites, 'theirFavorites', '💖', '#e91e63', null)}
          {renderSection('Their Shortlists', dashboardData.theirShortlists, 'theirShortlists', '📝', '#00bcd4', null)}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{dashboardData.myMessages.length}</div>
          <div className="stat-label">Messages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dashboardData.myViews.length}</div>
          <div className="stat-label">Profile Views</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dashboardData.theirFavorites.length}</div>
          <div className="stat-label">Liked By</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dashboardData.myRequests.length}</div>
          <div className="stat-label">PII Requests</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
