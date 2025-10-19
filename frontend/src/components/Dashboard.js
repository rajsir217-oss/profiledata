import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import MessageModal from './MessageModal';
import CategorySection from './CategorySection';
import UserCard from './UserCard';
import AccessRequestManager from './AccessRequestManager';
import socketService from '../services/socketService';
import { getDisplayName } from '../utils/userDisplay';
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
  // eslint-disable-next-line no-unused-vars
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // Current user profile for display name
  const [userProfile, setUserProfile] = useState(null);
  
  const [activeSections, setActiveSections] = useState({
    myMessages: true,
    myFavorites: true,
    myShortlists: true,
    myViews: true,
    myExclusions: true,
    myRequests: true,
    theirFavorites: true,
    theirShortlists: true
  });

  // View mode and drag-drop states
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'rows'
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragSection, setDragSection] = useState(null);
  const [draggedUser, setDraggedUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [dropTargetSection, setDropTargetSection] = useState(null);

  useEffect(() => {
    const currentUser = localStorage.getItem('username');
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    // Load user profile for display name
    const loadUserProfile = async () => {
      try {
        const response = await api.get(`/profile/${currentUser}?requester=${currentUser}`);
        setUserProfile(response.data);
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
    
    // Small delay to ensure token is set after login
    const timer = setTimeout(() => {
      loadDashboardData(currentUser);
    }, 100);
    
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
      clearTimeout(timer);
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
    };
  }, [navigate]);

  const loadDashboardData = async (username) => {
    // Use passed username or get from localStorage
    const user = username || localStorage.getItem('username');
    
    if (!user) {
      setError('No user logged in');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    console.log('Loading dashboard for user:', user);
    
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
        api.get(`/messages/conversations?username=${user}`),
        api.get(`/favorites/${user}`),
        api.get(`/shortlist/${user}`),
        api.get(`/profile-views/${user}`),
        api.get(`/exclusions/${user}`),
        api.get(`/pii-requests/${user}/incoming?status_filter=pending`),
        api.get(`/their-favorites/${user}`),
        api.get(`/their-shortlists/${user}`)
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
      console.error('Error details:', err.response?.data || err.message);
      
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load dashboard data';
      
      setError(`Failed to load dashboard: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = (username) => {
    navigate(`/profile/${username}`);
  };

  const handleMessageUser = async (username, userProfile = null) => {
    // If we have a userProfile with complete data, use it
    if (userProfile && userProfile.firstName && userProfile.location) {
      setSelectedUserForMessage(userProfile);
      setShowMessageModal(true);
      return;
    }
    
    // Otherwise, fetch the full profile
    try {
      const response = await api.get(`/profile/${username}?requester=${currentUser}`);
      setSelectedUserForMessage(response.data);
    } catch (err) {
      console.error('Error loading user profile:', err);
      // Fallback to basic user object
      setSelectedUserForMessage(userProfile || { username });
    }
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

  // Drag and drop handlers
  const handleDragStart = (e, index, section) => {
    setDraggedIndex(index);
    setDragSection(section);
    
    // Store the dragged user data for cross-category moves
    const sectionKey = getSectionDataKey(section);
    const userData = dashboardData[sectionKey][index];
    setDraggedUser(userData);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', section); // Store source section
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragSection(null);
    setDraggedUser(null);
    setDropTargetSection(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e, dropIndex, targetSection) => {
    e.preventDefault();
    
    if (draggedIndex === null || !draggedUser || !dragSection) {
      return;
    }

    const sourceSection = dragSection;
    const username = typeof draggedUser === 'string' ? draggedUser : draggedUser.username;

    // Case 1: Same section - just reorder
    if (sourceSection === targetSection) {
      if (draggedIndex === dropIndex) return;

      const sectionKey = getSectionDataKey(targetSection);
      let currentData = [...dashboardData[sectionKey]];
      
      // Reorder the array
      const draggedItem = currentData[draggedIndex];
      currentData.splice(draggedIndex, 1);
      currentData.splice(dropIndex, 0, draggedItem);

      // Update state immediately
      setDashboardData(prev => ({
        ...prev,
        [sectionKey]: currentData
      }));
      setDragOverIndex(null);

      // Save order to backend
      try {
        const endpoint = getReorderEndpoint(targetSection);
        const order = currentData.map(item => 
          typeof item === 'string' ? item : item.username
        );
        
        await api.put(endpoint, order);
      } catch (err) {
        console.error('Error saving order:', err);
      }
    }
    // Case 2: Different section - move between categories
    else {
      await handleCrossCategoryMove(username, sourceSection, targetSection);
    }
  };

  const getSectionDataKey = (section) => {
    const mapping = {
      'myFavorites': 'myFavorites',
      'myShortlists': 'myShortlists',
      'myExclusions': 'myExclusions'
    };
    return mapping[section] || section;
  };

  const getReorderEndpoint = (section) => {
    const mapping = {
      'myFavorites': `/favorites/${currentUser}/reorder`,
      'myShortlists': `/shortlist/${currentUser}/reorder`,
      'myExclusions': `/exclusions/${currentUser}/reorder`
    };
    return mapping[section] || '';
  };

  // Handle cross-category drag & drop moves
  const handleCrossCategoryMove = async (username, sourceSection, targetSection) => {
    try {
      console.log(`Moving ${username} from ${sourceSection} to ${targetSection}`);

      // Define API operations for each section
      const addOperations = {
        'myFavorites': () => api.post(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`),
        'myShortlists': () => api.post(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`),
        'myExclusions': () => api.post(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`)
      };

      const removeOperations = {
        'myFavorites': () => api.delete(`/favorites/${username}?username=${encodeURIComponent(currentUser)}`),
        'myShortlists': () => api.delete(`/shortlist/${username}?username=${encodeURIComponent(currentUser)}`),
        'myExclusions': () => api.delete(`/exclusions/${username}?username=${encodeURIComponent(currentUser)}`)
      };

      // Remove from source
      if (removeOperations[sourceSection]) {
        await removeOperations[sourceSection]();
      }

      // Add to target
      if (addOperations[targetSection]) {
        await addOperations[targetSection]();
      }

      // Update local state - remove from source
      const sourceSectionKey = getSectionDataKey(sourceSection);
      setDashboardData(prev => ({
        ...prev,
        [sourceSectionKey]: prev[sourceSectionKey].filter(item => {
          const itemUsername = typeof item === 'string' ? item : item.username;
          return itemUsername !== username;
        })
      }));

      // Add to target (fetch fresh data to maintain consistency)
      await loadDashboardData();

      console.log(`Successfully moved ${username} from ${sourceSection} to ${targetSection}`);
    } catch (err) {
      console.error('Error moving between categories:', err);
      alert(`Failed to move user: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Render user card using new UserCard component
  const renderUserCard = (user, removeHandler = null, removeIcon = '❌') => {
    if (!user) return null;

    // Handle different data structures (regular users vs PII requests)
    // PII requests have requesterProfile nested inside
    const username = user.username || user.viewerProfile?.username || user.userProfile?.username || user.requesterProfile?.username;
    const displayUser = user.requesterProfile ? {
      ...user.requesterProfile,
      requestedData: user.requested_data, // Add requested PII types
      requestedAt: user.requested_at      // Add timestamp
    } : user;

    // Build actions array
    const actions = [
      { icon: '💬', label: 'Message', onClick: () => handleMessageUser(username, displayUser) },
      { icon: '👁️', label: 'View', onClick: () => handleProfileClick(username) }
    ];

    if (removeHandler) {
      actions.push({ 
        icon: removeIcon, 
        label: 'Remove', 
        onClick: () => removeHandler(username) 
      });
    }

    return (
      <UserCard
        user={displayUser}
        variant="dashboard"
        viewMode={viewMode}
        actions={actions}
        onClick={() => handleProfileClick(username)}
      />
    );
  };

  // Render section using new CategorySection component
  const renderSection = (title, data, sectionKey, icon, color, removeHandler = null, removeIcon = '❌') => {
    const isDraggable = ['myFavorites', 'myShortlists', 'myExclusions'].includes(sectionKey);
    
    return (
      <CategorySection
        title={title}
        icon={icon}
        color={color}
        data={data}
        sectionKey={sectionKey}
        isExpanded={activeSections[sectionKey]}
        onToggle={toggleSection}
        onRender={(user) => renderUserCard(user, removeHandler, removeIcon)}
        isDraggable={isDraggable}
        viewMode={viewMode}
        emptyMessage={`No ${title.toLowerCase()} yet`}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        draggedIndex={draggedIndex}
        dragOverIndex={dragOverIndex}
      />
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
        <button onClick={() => loadDashboardData(currentUser)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>My Dashboard</h1>
          <p>Welcome back, {userProfile ? getDisplayName(userProfile) : currentUser}!</p>
        </div>
        <div className="header-actions">
          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`btn-view-mode ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              ⊞ Cards
            </button>
            <button
              className={`btn-view-mode ${viewMode === 'rows' ? 'active' : ''}`}
              onClick={() => setViewMode('rows')}
              title="Row View"
            >
              ☰ Rows
            </button>
          </div>
          <button 
            className="btn-refresh"
            onClick={() => loadDashboardData(currentUser)}
            title="Refresh Dashboard"
          >
            🔄 Refresh
          </button>
        </div>
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
          
          {/* Image Access Requests Section */}
          <CategorySection
            title="Image Access Requests"
            icon="📬"
            color="#10b981"
            count={0}
            isExpanded={false}
            onToggle={() => {}}
          >
            <div style={{ padding: '16px' }}>
              <AccessRequestManager
                username={currentUser}
                onRequestProcessed={(action, request) => {
                  // Show success message
                  if (action === 'approved') {
                    console.log(`✅ Access approved for ${request.requesterUsername}`);
                  } else if (action === 'rejected') {
                    console.log(`❌ Access rejected for ${request.requesterUsername}`);
                  }
                }}
              />
            </div>
          </CategorySection>
          
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
