import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './Dashboard.css';
import MessageModal from './MessageModal';
import AccessRequestManager from './AccessRequestManager';
import logger from '../utils/logger';
import PageHeader from './PageHeader';
import ProfileViewsModal from './ProfileViewsModal';
import FavoritedByModal from './FavoritedByModal';
import UserCard from './UserCard';
import CategorySection from './CategorySection';
import socketService from '../services/socketService';
import { getDisplayName } from '../utils/userDisplay';
import useToast from '../hooks/useToast';
import { formatRelativeTime } from '../utils/timeFormatter';
import PauseSettings from './PauseSettings';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('username');
  const toast = useToast();
  
  // Modal states
  const [showProfileViewsModal, setShowProfileViewsModal] = useState(false);
  const [showFavoritedByModal, setShowFavoritedByModal] = useState(false);
  
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
  const [lastLoginAt, setLastLoginAt] = useState(null);
  
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
  
  // Section expand/collapse states
  const [activeSections, setActiveSections] = useState(() => {
    const saved = localStorage.getItem('dashboardSections');
    return saved ? JSON.parse(saved) : {
      myMessages: true,
      myFavorites: true,
      myShortlists: true,
      myViews: true,
      myExclusions: true,
      myRequests: true,
      imageAccessRequests: true,
      theirFavorites: true,
      theirShortlists: true
    };
  });

  // Group expand/collapse states (NEW - for column groups)
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const saved = localStorage.getItem('dashboardGroups');
    return saved ? JSON.parse(saved) : {
      myActivities: true,
      othersActivities: true
    };
  });

  // Track overall expand/collapse state for toggle button
  const [isAllExpanded, setIsAllExpanded] = useState(true);

  // MFA notification state
  const [showMfaNotification, setShowMfaNotification] = useState(false);
  
  // Pause feature state
  const [pauseStatus, setPauseStatus] = useState(null);
  const [showPauseSettings, setShowPauseSettings] = useState(false);
  
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
        logger.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
    checkMfaStatus(currentUser);
    loadPauseStatus(currentUser);
    
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
    
    logger.info('Loading dashboard for user:', user);
    
    try {
      // Load all dashboard data including user profile
      const [
        profileRes,
        messagesRes,
        myFavoritesRes,
        myShortlistsRes,
        profileViewsRes,
        myExclusionsRes,
        requestsRes,
        theirFavoritesRes,
        theirShortlistsRes
      ] = await Promise.all([
        api.get(`/profile/${user}?requester=${user}`),
        api.get(`/messages/conversations?username=${user}`),
        api.get(`/favorites/${user}`),
        api.get(`/shortlist/${user}`),
        api.get(`/profile-views/${user}`),
        api.get(`/exclusions/${user}`),
        api.get(`/pii-requests/${user}/incoming?status_filter=pending`),
        api.get(`/their-favorites/${user}`),
        api.get(`/their-shortlists/${user}`)
      ]);
      
      // Extract last login time from profile
      const profile = profileRes.data;
      const lastLogin = profile?.security?.last_login_at;
      setLastLoginAt(lastLogin);

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
      logger.error('Error loading dashboard data:', err);
      logger.error('Error details:', err.response?.data || err.message);
      
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load dashboard data';
      
      setError(`Failed to load dashboard: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const checkMfaStatus = async (username) => {
    // Check if user has dismissed the MFA notification
    const dismissed = localStorage.getItem('mfaNotificationDismissed');
    if (dismissed === 'true') {
      return;
    }
    
    try {
      // Import axios and getBackendUrl to avoid double-prefixing
      const axios = (await import('axios')).default;
      const { getBackendUrl } = await import('../config/apiConfig');
      
      const response = await axios.get(
        `${getBackendUrl()}/api/auth/mfa/status`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const mfaStatus = response.data.mfa_enabled;
      setMfaEnabled(mfaStatus);
      
      // Show notification only if MFA is not enabled
      if (!mfaStatus) {
        setShowMfaNotification(true);
      }
    } catch (err) {
      logger.error('Error checking MFA status:', err);
      // Don't show notification if there's an error
    }
  };

  const handleDismissMfaNotification = () => {
    setShowMfaNotification(false);
    localStorage.setItem('mfaNotificationDismissed', 'true');
  };

  const handleEnableMfa = () => {
    navigate('/preferences?tab=security');
    setShowMfaNotification(false);
  };

  // Pause feature functions
  const loadPauseStatus = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${getBackendUrl()}/api/account/pause-status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPauseStatus(response.data);
    } catch (err) {
      logger.error('Error loading pause status:', err);
    }
  };

  const handleUnpause = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${getBackendUrl()}/api/account/unpause`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Welcome back! Your profile is now active.');
      await loadPauseStatus(currentUser);
      await loadDashboardData(currentUser);
    } catch (err) {
      logger.error('Error unpausing account:', err);
      toast.error('Failed to unpause account');
    }
  };

  const handlePauseSuccess = async (data) => {
    toast.success('Your profile has been paused successfully');
    await loadPauseStatus(currentUser);
    await loadDashboardData(currentUser);
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
      logger.error('Error loading user profile:', err);
      // Fallback to basic user object
      setSelectedUserForMessage(userProfile || { username });
    }
    setShowMessageModal(true);
  };

  // Persist section states to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardSections', JSON.stringify(activeSections));
  }, [activeSections]);

  // Persist group states to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardGroups', JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const toggleSection = (section) => {
    setActiveSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle group (column) expand/collapse
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Toggle all sections (single button)
  const toggleAllSections = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedGroups({
        myActivities: false,
        othersActivities: false
      });
      setActiveSections({
        myMessages: false,
        myFavorites: false,
        myShortlists: false,
        myViews: false,
        myExclusions: false,
        myRequests: false,
        imageAccessRequests: false,
        theirFavorites: false,
        theirShortlists: false
      });
      setIsAllExpanded(false);
    } else {
      // Expand all
      setExpandedGroups({
        myActivities: true,
        othersActivities: true
      });
      setActiveSections({
        myMessages: true,
        myFavorites: true,
        myShortlists: true,
        myViews: true,
        myExclusions: true,
        myRequests: true,
        imageAccessRequests: true,
        theirFavorites: true,
        theirShortlists: true
      });
      setIsAllExpanded(true);
    }
  };

  // Calculate total items in a group
  const getGroupCount = (group) => {
    if (group === 'myActivities') {
      return dashboardData.myMessages.length + 
             dashboardData.myFavorites.length + 
             dashboardData.myShortlists.length + 
             dashboardData.myExclusions.length;
    } else if (group === 'othersActivities') {
      return dashboardData.myViews.length + 
             dashboardData.myRequests.length + 
             dashboardData.theirFavorites.length + 
             dashboardData.theirShortlists.length;
    }
    return 0;
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
      logger.error(`Failed to remove from favorites: ${err.message}`);
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
      logger.error(`Failed to remove from shortlist: ${err.message}`);
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
      logger.error(`Failed to remove from exclusions: ${err.message}`);
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
      logger.error(`Failed to delete message: ${err.message}`);
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
      logger.error(`Failed to clear view history: ${err.message}`);
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
      logger.error(`Failed to cancel request: ${err.message}`);
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
        logger.error('Error saving order:', err);
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
      logger.info(`Moving ${username} from ${sourceSection} to ${targetSection}`);

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

      logger.success(`Successfully moved ${username} from ${sourceSection} to ${targetSection}`);
    } catch (err) {
      logger.error('Error moving between categories:', err);
      toast.error(`Failed to move user: ${err.response?.data?.detail || err.message}`);
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
      <PageHeader
        icon="📊"
        title="My Dashboard"
        subtitle={`Welcome back, ${userProfile ? getDisplayName(userProfile) : currentUser}!`}
        variant="gradient"
        actions={
          <>
            {/* Quick Action Buttons */}
            <button 
              className="btn-quick-action btn-search btn-search-l3v3l"
              onClick={() => navigate('/search')}
              title="Search with L3V3L Scoring"
            >
              <span className="search-icon-wrapper">
                <span className="magnifier-icon">🔍</span>
                <span className="butterfly-icon">🦋</span>
              </span>
            </button>
            
            {/* View Controls Group - Right Aligned */}
            <div className="view-controls-group">
              {/* View Mode Toggle - Single Button */}
              <button
                className={`btn-view-toggle ${viewMode}`}
                onClick={() => setViewMode(viewMode === 'cards' ? 'rows' : 'cards')}
                title={viewMode === 'cards' ? 'Switch to Row View' : 'Switch to Card View'}
              >
                {viewMode === 'cards' ? '⊞' : '☰'}
              </button>
              
              {/* Refresh Icon Button */}
              <button 
                className="btn-refresh-icon"
                onClick={() => loadDashboardData(currentUser)}
                title="Refresh Dashboard"
              >
                🔄
              </button>
              
              {/* Toggle Expand/Collapse Button */}
              <button 
                className={`btn-toggle-sections ${isAllExpanded ? 'expanded' : 'collapsed'}`}
                onClick={toggleAllSections}
                title={isAllExpanded ? 'Collapse All Sections' : 'Expand All Sections'}
              >
                {isAllExpanded ? '⇱' : '⇲'}
              </button>
            </div>
          </>
        }
      />

      {/* Last Login Info */}
      {lastLoginAt && (
        <div className="last-login-info">
          <span className="last-login-icon">🕐</span>
          <span className="last-login-text">
            Last login: <strong>{formatRelativeTime(lastLoginAt)}</strong>
          </span>
        </div>
      )}

      {/* Pause Status Banner */}
      {pauseStatus?.isPaused && (
        <div className="pause-status-banner">
          <div className="pause-banner-content">
            <div className="pause-banner-icon">⏸️</div>
            <div className="pause-banner-text">
              <strong>Your profile is PAUSED</strong>
              <p>
                You're taking a break. 
                {pauseStatus.pausedUntil && (
                  <> Your profile will automatically unpause on {new Date(pauseStatus.pausedUntil).toLocaleDateString()}.</>
                )}
                {!pauseStatus.pausedUntil && <> Ready to return?</>}
              </p>
            </div>
            <div className="pause-banner-actions">
              <button 
                className="btn-unpause"
                onClick={handleUnpause}
              >
                ▶️ Un-Pause Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MFA Enablement Notification Banner */}
      {showMfaNotification && (
        <div className="mfa-notification-banner">
          <div className="mfa-notification-content">
            <div className="mfa-notification-icon">🔐</div>
            <div className="mfa-notification-text">
              <strong>Secure your account with Multi-Factor Authentication</strong>
              <p>Add an extra layer of security by enabling MFA. It only takes a minute!</p>
            </div>
            <div className="mfa-notification-actions">
              <button 
                className="btn-enable-mfa"
                onClick={handleEnableMfa}
              >
                Enable MFA
              </button>
              <button 
                className="btn-dismiss-mfa"
                onClick={handleDismissMfaNotification}
                title="Don't show this again"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview Section */}
      <div className="dashboard-stats-overview">
        <div 
          className="stat-card-large stat-card-primary clickable-card" 
          onClick={() => setShowProfileViewsModal(true)}
          style={{ cursor: 'pointer' }}
          title="Click to see who viewed your profile"
        >
          <div className="stat-icon">👁️</div>
          <div className="stat-content">
            <div className="stat-value">{viewMetrics.totalViews}</div>
            <div className="stat-label">Profile Views</div>
            <div className="stat-sublabel">{viewMetrics.uniqueViewers} unique viewers</div>
          </div>
        </div>
        
        <div 
          className="stat-card-large stat-card-success clickable-card" 
          onClick={() => setShowFavoritedByModal(true)}
          style={{ cursor: 'pointer' }}
          title="Click to see who favorited you"
        >
          <div className="stat-icon">💖</div>
          <div className="stat-content">
            <div className="stat-value">{dashboardData.theirFavorites.length}</div>
            <div className="stat-label">Favorited By</div>
            <div className="stat-sublabel">Others who liked you</div>
          </div>
        </div>
        
        <div className="stat-card-large stat-card-info">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-value">{dashboardData.myMessages.length}</div>
            <div className="stat-label">Conversations</div>
            <div className="stat-sublabel">Active messages</div>
          </div>
        </div>
        
        <div className="stat-card-large stat-card-warning">
          <div className="stat-icon">🔒</div>
          <div className="stat-content">
            <div className="stat-value">{dashboardData.myRequests.length}</div>
            <div className="stat-label">PII Requests</div>
            <div className="stat-sublabel">Pending approvals</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* My Activities */}
        <div className="dashboard-column">
          <div 
            className={`column-header ${expandedGroups.myActivities ? 'expanded' : 'collapsed'}`}
            onClick={() => toggleGroup('myActivities')}
          >
            <div className="column-header-content">
              <h2 className="column-title">My Activities</h2>
              <span className="column-count">{getGroupCount('myActivities')}</span>
            </div>
            <span className="column-expand-icon">{expandedGroups.myActivities ? '▼' : '►'}</span>
          </div>
          
          {expandedGroups.myActivities && (
            <div className="column-sections">
              {renderSection('My Messages', dashboardData.myMessages, 'myMessages', '💬', '#667eea', handleDeleteMessage, '🗑️')}
              {renderSection('My Favorites', dashboardData.myFavorites, 'myFavorites', '⭐', '#ff6b6b', handleRemoveFromFavorites, '💔')}
              {renderSection('My Shortlists', dashboardData.myShortlists, 'myShortlists', '📋', '#4ecdc4', handleRemoveFromShortlist, '📤')}
              {renderSection('Not Interested', dashboardData.myExclusions, 'myExclusions', '🙈', '#95a5a6', handleRemoveFromExclusions, '✅')}
            </div>
          )}
        </div>

        {/* Others' Activities */}
        <div className="dashboard-column">
          <div 
            className={`column-header ${expandedGroups.othersActivities ? 'expanded' : 'collapsed'}`}
            onClick={() => toggleGroup('othersActivities')}
          >
            <div className="column-header-content">
              <h2 className="column-title">Others' Activities</h2>
              <span className="column-count">{getGroupCount('othersActivities')}</span>
            </div>
            <span className="column-expand-icon">{expandedGroups.othersActivities ? '▼' : '►'}</span>
          </div>
          
          {expandedGroups.othersActivities && (
            <div className="column-sections">
              {renderSection('Profile Views', dashboardData.myViews, 'myViews', '👁️', '#f39c12', handleClearViewHistory, '🗑️')}
              {renderSection('PII Requests', dashboardData.myRequests, 'myRequests', '🔒', '#9b59b6', handleCancelPIIRequest, '❌')}
          
          {/* Image Access Requests Section */}
          <CategorySection
            title="Image Access Requests"
            icon="📬"
            color="#10b981"
            sectionKey="imageAccessRequests"
            data={[]}
            isExpanded={activeSections.imageAccessRequests}
            onToggle={toggleSection}
          >
            <div style={{ padding: '16px' }}>
              <AccessRequestManager
                username={currentUser}
                onRequestProcessed={(action, request) => {
                  // Show success message
                  if (action === 'approved') {
                    logger.info(`Access approved for ${request.requesterUsername}`);
                  } else if (action === 'rejected') {
                    logger.info(`Access rejected for ${request.requesterUsername}`);
                  }
                }}
              />
            </div>
          </CategorySection>
          
              {renderSection('Their Favorites', dashboardData.theirFavorites, 'theirFavorites', '💖', '#e91e63', null)}
              {renderSection('Their Shortlists', dashboardData.theirShortlists, 'theirShortlists', '📝', '#00bcd4', null)}
            </div>
          )}
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

      {/* Profile Views Modal */}
      <ProfileViewsModal
        isOpen={showProfileViewsModal}
        onClose={() => setShowProfileViewsModal(false)}
        username={currentUser}
      />

      {/* Favorited By Modal */}
      <FavoritedByModal
        isOpen={showFavoritedByModal}
        onClose={() => setShowFavoritedByModal(false)}
        username={currentUser}
      />

      {/* Pause Settings Modal */}
      <PauseSettings
        isOpen={showPauseSettings}
        onClose={() => setShowPauseSettings(false)}
        onPause={handlePauseSuccess}
        currentStatus={pauseStatus}
      />
    </div>
  );
};

export default Dashboard;
