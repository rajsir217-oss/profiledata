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
        viewsRes,
        myExclusionsRes,
        requestsRes,
        theirFavoritesRes,
        theirShortlistsRes
      ] = await Promise.all([
        api.get(`/messages/${currentUser}`),
        api.get(`/favorites/${currentUser}`),
        api.get(`/shortlist/${currentUser}`),
        api.get(`/views/${currentUser}`),
        api.get(`/exclusions/${currentUser}`),
        api.get(`/pii-requests/${currentUser}?type=received`),
        api.get(`/their-favorites/${currentUser}`),
        api.get(`/their-shortlists/${currentUser}`)
      ]);

      setDashboardData({
        myMessages: messagesRes.data.messages || [],
        myFavorites: myFavoritesRes.data.favorites || [],
        myShortlists: myShortlistsRes.data.shortlist || [],
        myViews: viewsRes.data.viewers || [],
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

  const renderUserCard = (user, showActions = true) => {
    const username = typeof user === 'string' ? user : user.username;
    const profileData = typeof user === 'object' ? user : {};
    
    return (
      <div key={username} className="user-card" onClick={() => handleProfileClick(username)}>
        <div className="user-card-header">
          <div className="user-avatar">
            {profileData.profileImage ? (
              <img src={profileData.profileImage} alt={username} />
            ) : (
              <div className="avatar-placeholder">👤</div>
            )}
          </div>
          {profileData.isOnline && <span className="online-badge">●</span>}
        </div>
        
        <div className="user-card-body">
          <h4 className="username">{username}</h4>
          {profileData.age && <p className="user-age">{profileData.age} years</p>}
          {profileData.location && <p className="user-location">📍 {profileData.location}</p>}
          {profileData.occupation && <p className="user-occupation">💼 {profileData.occupation}</p>}
          {profileData.lastSeen && (
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
            >
              💬
            </button>
            <button 
              className="btn-view-profile"
              onClick={(e) => {
                e.stopPropagation();
                handleProfileClick(username);
              }}
            >
              👁️
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title, data, sectionKey, icon, color) => {
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
                {data.map(user => renderUserCard(user))}
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
          {renderSection('My Messages', dashboardData.myMessages, 'myMessages', '💬', '#667eea')}
          {renderSection('My Favorites', dashboardData.myFavorites, 'myFavorites', '⭐', '#ff6b6b')}
          {renderSection('My Shortlists', dashboardData.myShortlists, 'myShortlists', '📋', '#4ecdc4')}
          {renderSection('My Exclusions', dashboardData.myExclusions, 'myExclusions', '❌', '#95a5a6')}
        </div>

        {/* Others' Activities */}
        <div className="dashboard-column">
          <h2 className="column-title">Others' Activities</h2>
          {renderSection('Profile Views', dashboardData.myViews, 'myViews', '👁️', '#f39c12')}
          {renderSection('PII Requests', dashboardData.myRequests, 'myRequests', '🔒', '#9b59b6')}
          {renderSection('Their Favorites', dashboardData.theirFavorites, 'theirFavorites', '💖', '#e91e63')}
          {renderSection('Their Shortlists', dashboardData.theirShortlists, 'theirShortlists', '📝', '#00bcd4')}
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
