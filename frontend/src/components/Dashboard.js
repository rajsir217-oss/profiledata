import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import MessageModal from './MessageModal';
import socketService from '../services/socketService';
import './Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('username');
  
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
  
  // Profile view metrics
  const [viewMetrics, setViewMetrics] = useState({
    uniqueViewers: 0,
    totalViews: 0
  });
  
  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);
  
  // Online users state
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
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

  useEffect(() => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadDashboardData(currentUser);
    
    // Listen for online status updates
    const handleUserOnline = (data) => {
      setOnlineUsers(prev => new Set([...prev, data.username]));
    };
    
    const handleUserOffline = (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    };
    
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);
    
    return () => {
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
    };
  }, [navigate]);

  const loadDashboardData = async (currentUser) => {
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
        api.get(`/api/messages/conversations?username=${currentUser}`),
        api.get(`/favorites/${currentUser}`),
        api.get(`/shortlist/${currentUser}`),
        api.get(`/profile-views/${currentUser}`),
        api.get(`/exclusions/${currentUser}`),
        api.get(`/pii-requests/${currentUser}?type=received`),
        api.get(`/their-favorites/${currentUser}`),
        api.get(`/their-shortlists/${currentUser}`)
      ]);

      setDashboardData({
        myMessages: messagesRes.data.conversations || [],
        myFavorites: myFavoritesRes.data.favorites || [],
        myShortlists: myShortlistsRes.data.shortlist || [],
        myViews: profileViewsRes.data.views || [],
        myExclusions: myExclusionsRes.data.exclusions || [],
        myRequests: requestsRes.data.requests || [],
        theirFavorites: theirFavoritesRes.data.users || [],
        theirShortlists: theirShortlistsRes.data.users || []
      });
      
      // Set view metrics
      setViewMetrics({
        uniqueViewers: profileViewsRes.data.uniqueViewers || 0,
        totalViews: profileViewsRes.data.totalViews || 0
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

  const handleMessageUser = (username, userProfile = null) => {
    // Open message modal instead of navigating
    const userToMessage = userProfile || { username };
    setSelectedUserForMessage(userToMessage);
    setShowMessageModal(true);
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
    // Handle different data structures
    // - Profile views: user.viewerProfile
    // - Conversations: user.userProfile
    // - Others: user directly
    if (!user) return null;
    
    const profileData = user.viewerProfile || user.userProfile || user;
    const username = profileData?.username || user.username;
    const viewedAt = user.viewedAt; // For profile views
    const lastMessage = user.lastMessage; // For conversations
    const lastMessageTime = user.lastMessageTime; // For conversations
    
    // Safety check
    if (!username) {
      console.warn('User card missing username:', user);
      return null;
    }
    
    const isOnline = onlineUsers.has(username);
    
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
            {/* Online status indicator */}
            <div className={`status-bulb ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'}>
              {isOnline ? '🟢' : '⚪'}
            </div>
          </div>
        </div>
        
        <div className="user-card-body">
          <h4 className="username">{profileData?.firstName || username}</h4>
          {profileData?.age && <p className="user-age">{profileData.age} years</p>}
          {profileData?.location && <p className="user-location">📍 {profileData.location}</p>}
          {profileData?.occupation && <p className="user-occupation">💼 {profileData.occupation}</p>}
          {viewedAt && (
            <p className="last-seen">
              Viewed: {new Date(viewedAt).toLocaleString()}
              {user.viewCount > 1 && <span className="view-count-badge"> ({user.viewCount}x)</span>}
            </p>
          )}
          {lastMessage && (
            <p className="last-seen">
              {lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage}
            </p>
          )}
          {profileData?.lastSeen && !viewedAt && !lastMessage && (
            <p className="last-seen">Last seen: {new Date(profileData.lastSeen).toLocaleDateString()}</p>
          )}
        </div>
        
        {showActions && (
          <div className="user-card-actions">
            <button 
              className="btn-message"
              onClick={(e) => {
                e.stopPropagation();
                handleMessageUser(username, profileData);
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
          <div className="stat-value">{viewMetrics.uniqueViewers}</div>
          <div className="stat-label">Unique Viewers</div>
          <div className="stat-sublabel">{viewMetrics.totalViews} total views</div>
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

      {/* Message Modal */}
      <MessageModal
        isOpen={showMessageModal}
        profile={selectedUserForMessage}
        onClose={() => {
          setShowMessageModal(false);
          setSelectedUserForMessage(null);
        }}
      />
    </div>
  );
};

export default Dashboard;
