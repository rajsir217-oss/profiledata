import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './Dashboard2.css';
import MessageModal from './MessageModal';
import PIIRequestModal from './PIIRequestModal';
import ChatFirstPrompt from './ChatFirstPrompt';
import AccessRequestManager from './AccessRequestManager';
import PIIRequestsTable from './PIIRequestsTable';
import logger from '../utils/logger';
import ProfileViewsModal from './ProfileViewsModal';
import FavoritedByModal from './FavoritedByModal';
import PhotoRequestsModal from './PhotoRequestsModal';
import ConversationsModal from './ConversationsModal';
import ContactRequestsModal from './ContactRequestsModal';
import UserCard from './UserCard';
import CategorySection from './CategorySection';
import socketService from '../services/socketService';
import { getDisplayName } from '../utils/userDisplay';
import useToast from '../hooks/useToast';
import { formatRelativeTime } from '../utils/timeFormatter';
import PauseSettings from './PauseSettings';
import { SECTION_ICONS, STATS_ICONS } from '../constants/icons';
import PollWidget from './PollWidget';
import ProfileNotes from './ProfileNotes';

const Dashboard2 = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const currentUser = localStorage.getItem('username');
  const toast = useToast();
  const [mfaWarning, setMfaWarning] = useState(null);
  
  // Modal states
  const [showProfileViewsModal, setShowProfileViewsModal] = useState(false);
  const [showFavoritedByModal, setShowFavoritedByModal] = useState(false);
  const [showPhotoRequestsModal, setShowPhotoRequestsModal] = useState(false);
  const [showConversationsModal, setShowConversationsModal] = useState(false);
  const [showContactRequestsModal, setShowContactRequestsModal] = useState(false);
  
  // Dashboard data states
  const [dashboardData, setDashboardData] = useState({
    myMessages: [],
    myNotes: [],
    myFavorites: [],
    myShortlists: [],
    myViews: [],
    myExclusions: [],
    myRequests: [],
    incomingContactRequests: [],
    theirFavorites: [],
    theirShortlists: [],
    receivedAccess: [],
    savedSearches: []
  });
  const [lastLoginAt, setLastLoginAt] = useState(null);
  
  // Track which data has been loaded (for lazy loading)
  const [loadedData, setLoadedData] = useState({
    profile: false,
    piiRequests: false,
    myActivities: false,
    othersActivities: false
  });
  
  // Profile view metrics
  const [viewMetrics, setViewMetrics] = useState({
    uniqueViewers: 0,
    totalViews: 0
  });
  
  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedUserForMessage, setSelectedUserForMessage] = useState(null);
  
  // PII Request modal state
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  const [selectedUserForPII, setSelectedUserForPII] = useState(null);
  const [selectedUserPIIAccess, setSelectedUserPIIAccess] = useState({});
  const [selectedUserPIIRequestStatus, setSelectedUserPIIRequestStatus] = useState({});
  
  // Chat-first prompt state (shown before PII request)
  const [showChatFirstPrompt, setShowChatFirstPrompt] = useState(false);
  const [pendingPIIRequestUser, setPendingPIIRequestUser] = useState(null);
  
  // Online users state
  // eslint-disable-next-line no-unused-vars
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  
  // Current user profile for display name
  const [userProfile, setUserProfile] = useState(null);
  
  // Active category pill state for PII Requests section
  const [piiActiveCategory, setPiiActiveCategory] = useState(() => {
    const saved = localStorage.getItem('dashboard2PiiActiveCategory');
    return saved || 'piiInbox';
  });
  
  // Mobile PII modal state (for stat card clicks on mobile)
  const [showMobilePIIModal, setShowMobilePIIModal] = useState(false);
  const [mobilePIICategory, setMobilePIICategory] = useState('piiInbox');
  
  // Mobile Activity modal state (for Favorites/Shortlists stat card clicks on mobile)
  const [showMobileActivityModal, setShowMobileActivityModal] = useState(false);
  const [mobileActivityCategory, setMobileActivityCategory] = useState('myFavorites');

  // Active category pill state for My Activities section
  const [myActiveCategory, setMyActiveCategory] = useState(() => {
    const saved = localStorage.getItem('dashboard2MyActiveCategory');
    return saved || 'myMessages';
  });

  // Active category pill state for Others' Activities section
  const [othersActiveCategory, setOthersActiveCategory] = useState(() => {
    const saved = localStorage.getItem('dashboard2OthersActiveCategory');
    return saved || 'theirViews';
  });

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

  // Group expand/collapse states - default: Data Requests & My Activities expanded, Admirers collapsed
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const saved = localStorage.getItem('dashboard2Groups');
    return saved ? JSON.parse(saved) : {
      piiRequests: true,
      myActivities: true,
      othersActivities: false  // Collapsed by default
    };
  });

  // Track overall expand/collapse state for toggle button
  const [isAllExpanded, setIsAllExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState({});

  // MFA notification state
  const [showMfaNotification, setShowMfaNotification] = useState(false);
  
  // Photo reminder notification state
  const [showPhotoReminder, setShowPhotoReminder] = useState(false);
  
  // Pause feature state
  const [pauseStatus, setPauseStatus] = useState(null);
  const [showPauseSettings, setShowPauseSettings] = useState(false);
  
  // Exclusion preview modal state
  const [showExclusionPreview, setShowExclusionPreview] = useState(false);
  const [exclusionPreviewData, setExclusionPreviewData] = useState(null);
  const [exclusionLoading, setExclusionLoading] = useState(false);
  const [selectedUserForExclusion, setSelectedUserForExclusion] = useState(null);
  
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
    
    // Load user profile for display name and check for photos
    const loadUserProfile = async () => {
      try {
        const response = await api.get(`/profile/${currentUser}?requester=${currentUser}`);
        setUserProfile(response.data);
        
        // Check if user has no photos and hasn't dismissed the reminder this session
        const photoReminderDismissed = sessionStorage.getItem('photoReminderDismissed');
        const userImages = response.data?.images || [];
        if (userImages.length === 0 && !photoReminderDismissed) {
          setShowPhotoReminder(true);
        }
      } catch (error) {
        logger.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
    checkMfaStatus(currentUser);
    loadPauseStatus(currentUser);
    
    // Check for MFA warning from login
    const mfaWarningData = sessionStorage.getItem('mfa_warning');
    if (mfaWarningData) {
      try {
        setMfaWarning(JSON.parse(mfaWarningData));
        // Clear the warning from sessionStorage after reading
        sessionStorage.removeItem('mfa_warning');
      } catch (e) {
        console.error('Failed to parse MFA warning:', e);
      }
    }
    
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
    
    // ESC key handler for closing modals
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        setShowMobilePIIModal(false);
        setShowMobileActivityModal(false);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      clearTimeout(timer);
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [navigate]);

  const loadDashboardData = async (username) => {
    const user = username || localStorage.getItem('username');
    if (!user) {
      setError('No user logged in');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    logger.info('Loading dashboard for user (lazy mode):', user);

    try {
      // LAZY LOADING: Only fetch essential data initially (profile + counts for badges)
      // Other data will be loaded when user expands a section
      await refreshProfile(user, true);
      
      // Fetch PII counts for badges (lightweight - just counts)
      const [piiOutgoing, piiIncoming] = await Promise.all([
        api.get(`/pii-requests/${user}/outgoing`).then(res => res.data.requests || []),
        api.get(`/pii-requests/${user}/incoming`).then(res => res.data.requests || [])
      ]);
      
      setDashboardData(prev => ({
        ...prev,
        myRequests: piiOutgoing,
        incomingContactRequests: piiIncoming
      }));
      
      setLoadedData(prev => ({ ...prev, profile: true, piiRequests: true }));
      
      // Auto-expand PII if there are requests
      const piiCount = (piiIncoming?.length || 0) + (piiOutgoing?.length || 0);
      setExpandedGroups(prev => ({
        ...prev,
        piiRequests: piiCount > 0,
        myActivities: true,  // Default expanded but data loaded lazily
        othersActivities: false
      }));
      
      logger.info('📊 Initial load complete - PII count:', piiCount);
    } catch (err) {
      logger.error('Error loading dashboard data:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load dashboard data';
      setError(`Failed to load dashboard: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // LAZY LOADING: Load My Activities data when section is expanded
  const loadMyActivitiesData = async (user) => {
    if (loadedData.myActivities) return; // Already loaded
    
    const currentUser = user || localStorage.getItem('username');
    logger.info('📦 Lazy loading My Activities data...');
    
    try {
      const [messagesRes, notesRes, favoritesRes, shortlistsRes, exclusionsRes] = await Promise.all([
        api.get(`/messages/conversations?username=${currentUser}`).then(res => res.data.conversations || []),
        api.get('/api/notes').then(res => res.data.notes || []).catch(() => []),
        api.get(`/favorites/${currentUser}`).then(res => res.data.favorites || []),
        api.get(`/shortlist/${currentUser}`).then(res => res.data.shortlist || []),
        api.get(`/exclusions/${currentUser}`).then(res => res.data.exclusions || [])
      ]);
      
      // Also load views
      await refreshViews(currentUser, true);
      
      setDashboardData(prev => ({
        ...prev,
        myMessages: messagesRes,
        myNotes: notesRes,
        myFavorites: favoritesRes,
        myShortlists: shortlistsRes,
        myExclusions: exclusionsRes
      }));
      
      setLoadedData(prev => ({ ...prev, myActivities: true }));
      logger.info('✅ My Activities data loaded');
    } catch (err) {
      logger.error('Error loading My Activities:', err);
    }
  };

  // LAZY LOADING: Load Others' Activities data when section is expanded
  const loadOthersActivitiesData = async (user) => {
    if (loadedData.othersActivities) return; // Already loaded
    
    const currentUser = user || localStorage.getItem('username');
    logger.info('📦 Lazy loading Others Activities data...');
    
    try {
      await Promise.all([
        refreshTheirFavorites(currentUser, true),
        refreshTheirShortlists(currentUser, true),
        refreshReceivedAccess(currentUser, true),
        refreshSavedSearches(currentUser, true)
      ]);
      
      setLoadedData(prev => ({ ...prev, othersActivities: true }));
      logger.info('✅ Others Activities data loaded');
    } catch (err) {
      logger.error('Error loading Others Activities:', err);
    }
  };

  // Granular refresh functions
  const refreshProfile = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, profile: true }));
      const res = await api.get(`/profile/${user}?requester=${user}`);
      setUserProfile(res.data);
      setLastLoginAt(res.data?.security?.last_login_at);
      
      const photoReminderDismissed = sessionStorage.getItem('photoReminderDismissed');
      const userImages = res.data?.images || [];
      if (userImages.length === 0 && !photoReminderDismissed) {
        setShowPhotoReminder(true);
      }
    } catch (err) {
      logger.error('Error refreshing profile:', err);
      if (!silent) toast.error('Failed to refresh profile');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, profile: false }));
    }
  };

  const refreshMessages = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myMessages: true }));
      const res = await api.get(`/messages/conversations?username=${user}`);
      setDashboardData(prev => ({ ...prev, myMessages: res.data.conversations || [] }));
    } catch (err) {
      logger.error('Error refreshing messages:', err);
      if (!silent) toast.error('Failed to refresh messages');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myMessages: false }));
    }
  };

  const refreshFavorites = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myFavorites: true }));
      const res = await api.get(`/favorites/${user}`);
      setDashboardData(prev => ({ ...prev, myFavorites: res.data.favorites || [] }));
    } catch (err) {
      logger.error('Error refreshing favorites:', err);
      if (!silent) toast.error('Failed to refresh favorites');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myFavorites: false }));
    }
  };

  const refreshShortlists = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myShortlists: true }));
      const res = await api.get(`/shortlist/${user}`);
      setDashboardData(prev => ({ ...prev, myShortlists: res.data.shortlist || [] }));
    } catch (err) {
      logger.error('Error refreshing shortlists:', err);
      if (!silent) toast.error('Failed to refresh shortlists');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myShortlists: false }));
    }
  };

  const refreshViews = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myViews: true }));
      const res = await api.get(`/profile-views/${user}`);
      setDashboardData(prev => ({ ...prev, myViews: res.data.views || [] }));
      setViewMetrics({
        uniqueViewers: res.data.uniqueViewers || 0,
        totalViews: res.data.totalViews || 0
      });
    } catch (err) {
      logger.error('Error refreshing views:', err);
      if (!silent) toast.error('Failed to refresh views');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myViews: false }));
    }
  };

  const refreshExclusions = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myExclusions: true }));
      const res = await api.get(`/exclusions/${user}`);
      setDashboardData(prev => ({ ...prev, myExclusions: res.data.exclusions || [] }));
    } catch (err) {
      logger.error('Error refreshing exclusions:', err);
      if (!silent) toast.error('Failed to refresh exclusions');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myExclusions: false }));
    }
  };

  const refreshPiiRequests = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, myRequests: true }));
      const res = await api.get(`/pii-requests/${user}/outgoing`);
      setDashboardData(prev => ({ ...prev, myRequests: res.data.requests || [] }));
    } catch (err) {
      logger.error('Error refreshing sent requests:', err);
      if (!silent) toast.error('Failed to refresh sent requests');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, myRequests: false }));
    }
  };

  const refreshIncomingRequests = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, piiInbox: true }));
      const res = await api.get(`/pii-requests/${user}/incoming`);
      setDashboardData(prev => ({ ...prev, incomingContactRequests: res.data.requests || [] }));
    } catch (err) {
      logger.error('Error refreshing incoming requests:', err);
      if (!silent) toast.error('Failed to refresh incoming requests');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, piiInbox: false }));
    }
  };

  const refreshTheirFavorites = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, theirFavorites: true }));
      const res = await api.get(`/their-favorites/${user}`);
      setDashboardData(prev => ({ ...prev, theirFavorites: res.data.users || [] }));
    } catch (err) {
      logger.error('Error refreshing favorited-me:', err);
      if (!silent) toast.error('Failed to refresh favorited-me list');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, theirFavorites: false }));
    }
  };

  const refreshTheirShortlists = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, theirShortlists: true }));
      const res = await api.get(`/their-shortlists/${user}`);
      setDashboardData(prev => ({ ...prev, theirShortlists: res.data.users || [] }));
    } catch (err) {
      logger.error('Error refreshing shortlisted-me:', err);
      if (!silent) toast.error('Failed to refresh shortlisted-me list');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, theirShortlists: false }));
    }
  };

  const refreshReceivedAccess = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, piiHistory: true }));
      const res = await api.get(`/pii-access/${user}/received`);
      setDashboardData(prev => ({ ...prev, receivedAccess: res.data.receivedAccess || [] }));
    } catch (err) {
      logger.error('Error refreshing access history:', err);
      if (!silent) toast.error('Failed to refresh access history');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, piiHistory: false }));
    }
  };

  const refreshSavedSearches = async (user, silent = false) => {
    try {
      if (!silent) setRefreshing(prev => ({ ...prev, savedSearches: true }));
      const res = await api.get(`/${user}/saved-searches`);
      setDashboardData(prev => ({ ...prev, savedSearches: res.data.savedSearches || [] }));
    } catch (err) {
      logger.error('Error refreshing saved searches:', err);
      if (!silent) toast.error('Failed to refresh saved searches');
    } finally {
      if (!silent) setRefreshing(prev => ({ ...prev, savedSearches: false }));
    }
  };

  // Group refresh functions
  const refreshPiiGroup = async () => {
    const user = currentUser || localStorage.getItem('username');
    setRefreshing(prev => ({ ...prev, piiGroup: true }));
    await Promise.all([
      refreshIncomingRequests(user, true),
      refreshPiiRequests(user, true),
      refreshReceivedAccess(user, true)
    ]);
    setRefreshing(prev => ({ ...prev, piiGroup: false }));
    toast.success('Data Requests refreshed');
  };

  const refreshMyActivitiesGroup = async () => {
    const user = currentUser || localStorage.getItem('username');
    setRefreshing(prev => ({ ...prev, myActivitiesGroup: true }));
    await Promise.all([
      refreshMessages(user, true),
      refreshFavorites(user, true),
      refreshShortlists(user, true),
      refreshExclusions(user, true)
    ]);
    setRefreshing(prev => ({ ...prev, myActivitiesGroup: false }));
    toast.success('My Activities refreshed');
  };

  const refreshAdmirersGroup = async () => {
    const user = currentUser || localStorage.getItem('username');
    setRefreshing(prev => ({ ...prev, admirersGroup: true }));
    await Promise.all([
      refreshViews(user, true),
      refreshTheirFavorites(user, true),
      refreshTheirShortlists(user, true)
    ]);
    setRefreshing(prev => ({ ...prev, admirersGroup: false }));
    toast.success('Admirers refreshed');
  };

  const checkMfaStatus = async (username) => {
    // Check if user has dismissed the MFA notification THIS SESSION ONLY
    const dismissed = sessionStorage.getItem('mfaNotificationDismissed');
    console.log('🔍 MFA Banner Check - Dismissed flag (this session):', dismissed);
    if (dismissed === 'true') {
      console.log('⏭️ MFA Banner - Dismissed this session, not showing');
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
      console.log('🔐 MFA Banner Check - MFA enabled:', mfaStatus);
      
      // Show notification only if MFA is not enabled
      if (!mfaStatus) {
        console.log('✅ MFA Banner - Showing banner (MFA not enabled)');
        setShowMfaNotification(true);
      } else {
        console.log('⏭️ MFA Banner - Not showing (MFA already enabled)');
      }
    } catch (err) {
      logger.error('Error checking MFA status:', err);
      console.error('❌ MFA Banner - Error checking status, not showing');
      // Don't show notification if there's an error
    }
  };

  const handleDismissMfaNotification = () => {
    setShowMfaNotification(false);
    // Only dismiss for this session - will show again on next login
    sessionStorage.setItem('mfaNotificationDismissed', 'true');
  };

  const handleEnableMfa = () => {
    navigate('/preferences?tab=security');
    setShowMfaNotification(false);
  };

  // Photo reminder handlers
  const handleDismissPhotoReminder = () => {
    setShowPhotoReminder(false);
    sessionStorage.setItem('photoReminderDismissed', 'true');
  };

  const handleUploadPhotos = () => {
    navigate('/edit-profile');
    setShowPhotoReminder(false);
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
    // Open profile in new tab
    window.open(`/profile/${username}`, '_blank');
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

  // Persist activeCategory states to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard2PiiActiveCategory', piiActiveCategory);
  }, [piiActiveCategory]);

  useEffect(() => {
    localStorage.setItem('dashboard2MyActiveCategory', myActiveCategory);
  }, [myActiveCategory]);

  useEffect(() => {
    localStorage.setItem('dashboard2OthersActiveCategory', othersActiveCategory);
  }, [othersActiveCategory]);

  // Persist section states to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardSections', JSON.stringify(activeSections));
  }, [activeSections]);

  // Persist group states to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardGroups', JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  // LAZY LOADING: Load My Activities data after initial dashboard load
  // Since My Activities is expanded by default, load it after profile/PII loads
  useEffect(() => {
    if (loadedData.profile && !loadedData.myActivities && expandedGroups.myActivities) {
      loadMyActivitiesData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedData.profile, expandedGroups.myActivities]);

  const toggleSection = (section) => {
    setActiveSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle group (column) expand/collapse with lazy loading
  const toggleGroup = (group) => {
    const willExpand = !expandedGroups[group];
    
    setExpandedGroups(prev => ({
      ...prev,
      [group]: willExpand
    }));
    
    // Trigger lazy loading when expanding
    if (willExpand) {
      if (group === 'myActivities') {
        loadMyActivitiesData();
      } else if (group === 'othersActivities') {
        loadOthersActivitiesData();
      }
    }
  };

  // Toggle all sections (single button)
  const toggleAllSections = () => {
    if (isAllExpanded) {
      // Collapse all
      setExpandedGroups({
        piiRequests: false,
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
      // Expand all - trigger lazy loading for all groups
      setExpandedGroups({
        piiRequests: true,
        myActivities: true,
        othersActivities: true
      });
      loadMyActivitiesData();
      loadOthersActivitiesData();
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
             dashboardData.myRequests.length +
             dashboardData.myExclusions.length;
    } else if (group === 'othersActivities') {
      return dashboardData.myViews.length + 
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

  const handleDeleteMessage = async (targetUsernameOrUser) => {
    // Handle both username string and user object
    const targetUsername = typeof targetUsernameOrUser === 'string' 
      ? targetUsernameOrUser 
      : targetUsernameOrUser?.username;
    
    console.log('🗑️ handleDeleteMessage called with:', targetUsername);
    logger.info(`Deleting message conversation with: ${targetUsername}`);
    
    if (!targetUsername) {
      console.error('🗑️ No target username provided');
      return;
    }
    
    try {
      // Call backend API to delete conversation
      const currentUsername = localStorage.getItem('username');
      console.log('🗑️ Calling API: DELETE /messages/conversation/' + targetUsername + '?username=' + currentUsername);
      
      const response = await api.delete(`/messages/conversation/${targetUsername}?username=${currentUsername}`);
      console.log('🗑️ API response:', response.data);
      
      // Remove from UI after successful deletion
      setDashboardData(prev => ({
        ...prev,
        myMessages: prev.myMessages.filter(m => 
          (typeof m === 'string' ? m : m.username) !== targetUsername
        )
      }));
      
      // Refresh dashboard data to ensure sync
      const currentUser = localStorage.getItem('username');
      await loadDashboardData(currentUser);
      
      logger.info(`Successfully deleted conversation with: ${targetUsername}`);
    } catch (err) {
      console.error('🗑️ Delete failed:', err);
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
      // Call API to cancel the request
      await api.delete(`/pii-requests/${currentUser}/outgoing/${requestUsername}`);
      
      // Remove from UI
      setDashboardData(prev => ({
        ...prev,
        myRequests: prev.myRequests.filter(r => 
          (typeof r === 'string' ? r : r.username) !== requestUsername
        )
      }));
      
      toast.success('Photo request cancelled');
    } catch (err) {
      logger.error(`Failed to cancel request: ${err.message}`);
      toast.error('Failed to cancel request');
    }
  };

  // Add handlers for kebab menu (adding to lists)
  const handleAddToFavorites = async (user) => {
    try {
      const targetUsername = user.username || user;
      await api.post(`/favorites/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
      // Reload dashboard to get fresh data
      await loadDashboardData(currentUser);
      toast.success(`Added to favorites`);
    } catch (err) {
      logger.error(`Failed to add to favorites: ${err.message}`);
      toast.error(`Failed to add to favorites`);
    }
  };

  const handleAddToShortlist = async (user) => {
    try {
      const targetUsername = user.username || user;
      await api.post(`/shortlist/${targetUsername}?username=${encodeURIComponent(currentUser)}`);
      // Reload dashboard to get fresh data
      await loadDashboardData(currentUser);
      toast.success(`Added to shortlist`);
    } catch (err) {
      logger.error(`Failed to add to shortlist: ${err.message}`);
      toast.error(`Failed to add to shortlist`);
    }
  };

  const handleAddToExclusions = async (user) => {
    try {
      const targetUsername = user.username || user;
      // Show preview modal before excluding
      setExclusionLoading(true);
      setSelectedUserForExclusion(user);
      const response = await api.get(`/exclusions/preview/${targetUsername}`);
      setExclusionPreviewData(response.data);
      setShowExclusionPreview(true);
      setExclusionLoading(false);
    } catch (err) {
      setExclusionLoading(false);
      logger.error(`Failed to load exclusion preview: ${err.message}`);
      toast.error(`Failed to load exclusion preview`);
    }
  };
  
  const confirmExclusion = async () => {
    if (!selectedUserForExclusion) return;
    try {
      setExclusionLoading(true);
      const targetUsername = selectedUserForExclusion.username || selectedUserForExclusion;
      await api.post(`/exclusions/${targetUsername}`);
      setShowExclusionPreview(false);
      setExclusionPreviewData(null);
      setSelectedUserForExclusion(null);
      // Reload dashboard to get fresh data
      await loadDashboardData(currentUser);
      toast.success(`Marked as not interested`);
    } catch (err) {
      logger.error(`Failed to add to exclusions: ${err.message}`);
      toast.error(`Failed to add to exclusions`);
    } finally {
      setExclusionLoading(false);
    }
  };

  // Show chat-first prompt before opening PII request modal
  const handleRequestPII = (user) => {
    setPendingPIIRequestUser(user);
    setShowChatFirstPrompt(true);
  };

  // Actually open the PII request modal (called after chat-first prompt)
  const openPIIRequestModal = async (user) => {
    try {
      logger.info(`Opening PII request modal for user:`, user);
      
      // Fetch target user's full profile, PII access, and request status in parallel
      const targetUsername = user.username;
      const [profileResponse, accessResponse, requestsResponse] = await Promise.all([
        api.get(`/profile/${targetUsername}`),
        api.get(`/pii-access/${currentUser}/received`),
        api.get(`/pii-requests/${currentUser}/outgoing`)
      ]);
      
      // Use fetched profile to get accurate visibility settings
      const targetProfile = profileResponse.data;
      setSelectedUserForPII({
        ...user,
        // Override with fetched visibility settings
        contactNumberVisible: targetProfile.contactNumberVisible,
        contactEmailVisible: targetProfile.contactEmailVisible,
        linkedinUrlVisible: targetProfile.linkedinUrlVisible,
        imageVisibility: targetProfile.imageVisibility
      });
      
      // Build current access map for this specific user
      const accessMap = {};
      const receivedAccess = accessResponse.data.receivedAccess || [];
      receivedAccess.forEach(access => {
        if (access.granterUsername === targetUsername) {
          (access.accessTypes || []).forEach(type => {
            accessMap[type] = true;
          });
        }
      });
      
      // Build request status map for this specific user
      const statusMap = {};
      const requests = requestsResponse.data.requests || [];
      requests.forEach(req => {
        if (req.requesteeUsername === targetUsername) {
          statusMap[req.requestType] = req.status;
        }
      });
      
      setSelectedUserPIIAccess(accessMap);
      setSelectedUserPIIRequestStatus(statusMap);
      setShowPIIRequestModal(true);
    } catch (err) {
      logger.error(`Failed to open PII request modal: ${err.message}`);
      toast.error(`Failed to open PII request modal`);
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

  // Render user card using new UserCard component with context-aware actions
  const renderUserCard = (user, context = 'default', removeHandler = null) => {
    if (!user) return null;

    // Handle different data structures (regular users vs PII requests)
    // Incoming PII requests have requesterProfile nested inside
    // Outgoing PII requests have profileOwner nested inside
    const username = user.username || 
                    user.viewerProfile?.username || 
                    user.userProfile?.username || 
                    user.requesterProfile?.username ||
                    user.profileOwner?.username;
    
    const displayUser = user.requesterProfile ? {
      ...user.requesterProfile,
      requestedData: user.requested_data, // Add requested PII types
      requestedAt: user.requested_at      // Add timestamp
    } : user.profileOwner ? {
      ...user.profileOwner,
      requestType: user.requestType,      // Add request type (photos, phone, etc)
      requestStatus: user.status,         // Add status (pending, approved, denied)
      requestedAt: user.requestedAt       // Add timestamp
    } : user.userProfile ? {
      ...user.userProfile,
      lastMessage: user.lastMessage,      // Add last message for conversations
      lastMessageTime: user.lastMessageTime,
      unreadCount: user.unreadCount
    } : user;

    // Determine user state for kebab menu
    const isFavorited = dashboardData.myFavorites.some(fav => 
      (fav.username || fav.viewerProfile?.username || fav.userProfile?.username) === username
    );
    const isShortlisted = dashboardData.myShortlists.some(short => 
      (short.username || short.viewerProfile?.username || short.userProfile?.username) === username
    );
    const isBlocked = dashboardData.myExclusions.some(exc => 
      (exc.username || exc.viewerProfile?.username || exc.userProfile?.username) === username
    );

    return (
      <UserCard
        user={displayUser}
        variant="dashboard"
        viewMode={viewMode}
        context={context}
        onClick={() => handleProfileClick(username)}
        // Kebab menu handlers
        isFavorited={isFavorited}
        isShortlisted={isShortlisted}
        isBlocked={isBlocked}
        onViewProfile={() => handleProfileClick(username)}
        onToggleFavorite={() => isFavorited ? handleRemoveFromFavorites(username) : handleAddToFavorites(displayUser)}
        onToggleShortlist={() => isShortlisted ? handleRemoveFromShortlist(username) : handleAddToShortlist(displayUser)}
        onMessage={() => handleMessageUser(username, displayUser)}
        onBlock={() => isBlocked ? handleRemoveFromExclusions(username) : handleAddToExclusions(displayUser)}
        onRequestPII={() => handleRequestPII({ ...displayUser, username })}
        // Context-specific remove action - wrap to extract username from user object
        onRemove={removeHandler ? (userObj) => {
          const uname = userObj?.username || username;
          console.log('🔴 onRemove triggered for:', uname);
          return removeHandler(uname);
        } : null}
      />
    );
  };

  // Render section using new CategorySection component with context mapping
  const renderSection = (title, data, sectionKey, icon, color, removeHandler = null) => {
    const isDraggable = ['myFavorites', 'myShortlists', 'myExclusions'].includes(sectionKey);
    
    // Map section keys to contexts
    const contextMap = {
      'myMessages': 'my-messages',
      'myFavorites': 'my-favorites',
      'myShortlists': 'my-shortlists',
      'myExclusions': 'my-exclusions',
      'myViews': 'profile-views',
      'myRequests': 'pii-requests',
      'theirFavorites': 'their-favorites',
      'theirShortlists': 'their-shortlists'
    };
    
    // Tooltips for sections with retention policies
    const tooltipMap = {
      'myFavorites': '⏰ Favorites are automatically removed after 45 days. Add profiles you\'re interested in!',
      'myShortlists': '⏰ Shortlists are automatically removed after 45 days. Use this for profiles you\'re seriously considering.',
      'theirFavorites': 'Profiles who have added you to their favorites (last 45 days)',
      'theirShortlists': 'Profiles who have shortlisted you (last 45 days)'
    };
    
    const context = contextMap[sectionKey] || 'default';
    const tooltip = tooltipMap[sectionKey];
    
    // Map section keys to refresh functions
    const refreshMap = {
      'myMessages': () => refreshMessages(currentUser),
      'myFavorites': () => refreshFavorites(currentUser),
      'myShortlists': () => refreshShortlists(currentUser),
      'myExclusions': () => refreshExclusions(currentUser),
      'myViews': () => refreshViews(currentUser),
      'theirFavorites': () => refreshTheirFavorites(currentUser),
      'theirShortlists': () => refreshTheirShortlists(currentUser),
      'myRequests': () => refreshPiiRequests(currentUser)
    };
    
    return (
      <CategorySection
        title={title}
        icon={icon}
        color={color}
        data={data}
        sectionKey={sectionKey}
        isExpanded={activeSections[sectionKey]}
        onToggle={toggleSection}
        onRender={(user) => renderUserCard(user, context, removeHandler)}
        isDraggable={isDraggable}
        viewMode={viewMode}
        emptyMessage={`No ${title.toLowerCase()} yet`}
        tooltip={tooltip}
        onRefresh={refreshMap[sectionKey]}
        isRefreshing={refreshing[sectionKey]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        draggedIndex={draggedIndex}
        dragOverIndex={dragOverIndex}
      />
    );
  };

  // Render tab content directly without collapsible wrapper (for tab-based layout)
  const renderTabContent = (title, data, sectionKey, icon, color, removeHandler = null) => {
    // Map section keys to contexts
    const contextMap = {
      'myMessages': 'my-messages',
      'myFavorites': 'my-favorites',
      'myShortlists': 'my-shortlists',
      'myExclusions': 'my-exclusions',
      'myViews': 'profile-views',
      'myRequests': 'pii-requests',
      'theirFavorites': 'their-favorites',
      'theirShortlists': 'their-shortlists'
    };
    
    const context = contextMap[sectionKey] || 'default';

    // Map section keys to refresh functions
    const refreshMap = {
      'myMessages': () => refreshMessages(currentUser),
      'myFavorites': () => refreshFavorites(currentUser),
      'myShortlists': () => refreshShortlists(currentUser),
      'myExclusions': () => refreshExclusions(currentUser),
      'myViews': () => refreshViews(currentUser),
      'theirFavorites': () => refreshTheirFavorites(currentUser),
      'theirShortlists': () => refreshTheirShortlists(currentUser),
      'myRequests': () => refreshPiiRequests(currentUser),
      'piiInbox': () => refreshIncomingRequests(currentUser),
      'piiSent': () => refreshPiiRequests(currentUser),
      'piiHistory': () => refreshReceivedAccess(currentUser)
    };
    
    return (
      <div className="tab-content-wrapper" style={{ '--tab-color': color }}>
        {/* Category header with color indicator */}
        <div className="tab-content-header" style={{ background: color }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="tab-content-icon">{icon}</span>
            <span className="tab-content-title">{title}</span>
            <span className="tab-content-count">{data?.length || 0}</span>
            {refreshMap[sectionKey] && (
              <button 
                className={`section-refresh-btn ${refreshing[sectionKey] ? 'spinning' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  refreshMap[sectionKey]();
                }}
                title={`Refresh ${title}`}
                disabled={refreshing[sectionKey]}
                style={{ width: '22px', height: '22px', fontSize: '14px' }}
              >
                ⟳
              </button>
            )}
          </div>
        </div>
        
        {/* Content area */}
        {(!data || data.length === 0) ? (
          <div className="tab-empty-state">
            <span className="tab-empty-icon">{icon}</span>
            <p>No {title.toLowerCase()} yet</p>
          </div>
        ) : (
          <div className={`tab-content-grid ${viewMode === 'rows' ? 'view-rows' : ''}`}>
            {data.map((user, index) => (
              <div key={user.username || index} className="tab-content-item">
                {renderUserCard(user, context, removeHandler)}
              </div>
            ))}
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
        <button onClick={() => loadDashboardData(currentUser)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* MFA Warning Banner */}
      {mfaWarning && (
        <div className="mfa-warning-banner" style={{
          marginTop: '16px',
          marginBottom: '16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
          border: '2px solid #ffc107',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(255, 193, 7, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#856404', fontSize: '18px', fontWeight: 'bold' }}>
                MFA Configuration Incomplete
              </h4>
              <p style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '15px', lineHeight: '1.5' }}>
                {mfaWarning.message}
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    navigate('/edit-profile');
                    setMfaWarning(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#ffc107',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#856404',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  📝 Update Profile
                </button>
                <button
                  onClick={() => setMfaWarning(null)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '2px solid #ffc107',
                    borderRadius: '8px',
                    color: '#856404',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Photo Upload Reminder Banner */}
      {showPhotoReminder && (
        <div className="photo-reminder-banner">
          <div className="photo-reminder-content">
            <div className="photo-reminder-icon">📸</div>
            <div className="photo-reminder-text">
              <strong>Add photos to get 10x more profile views!</strong>
              <p>Profiles with photos receive significantly more interest. Upload your best photos now!</p>
            </div>
            <div className="photo-reminder-actions">
              <button 
                className="btn-upload-photos"
                onClick={handleUploadPhotos}
              >
                Upload Photos
              </button>
              <button 
                className="btn-dismiss-photo"
                onClick={handleDismissPhotoReminder}
                title="Don't show this again"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview Section with inline Poll Widget */}
      <div className="dashboard-stats-overview stats-with-poll">
        <div className="stats-cards-group">
          <div 
            className="stat-card-compact stat-card-primary clickable-card" 
            onClick={() => setShowProfileViewsModal(true)}
            title="Click to see who viewed your profile"
          >
            <div className="stat-icon-compact">{STATS_ICONS.PROFILE_VIEWS}</div>
            <span className="stat-label-mobile">Views</span>
            <span className="stat-badge-mobile">{viewMetrics.totalViews}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{viewMetrics.totalViews}</span>
              <span className="stat-label-compact">PROFILE VIEWS</span>
              <span className="stat-sublabel-compact">({viewMetrics.uniqueViewers} unique)</span>
            </div>
          </div>
          
          <div 
            className="stat-card-compact stat-card-success clickable-card" 
            onClick={() => setShowFavoritedByModal(true)}
            title="Click to see who favorited you"
          >
            <div className="stat-icon-compact">{STATS_ICONS.FAVORITED_BY}</div>
            <span className="stat-label-mobile">Fav'd By</span>
            <span className="stat-badge-mobile">{dashboardData.theirFavorites.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.theirFavorites.length}</span>
              <span className="stat-label-compact">FAV BY</span>
            </div>
          </div>
          
          <div 
            className="stat-card-compact stat-card-info clickable-card"
            onClick={() => setShowConversationsModal(true)}
            title="Click to see your conversations"
          >
            <div className="stat-icon-compact">{STATS_ICONS.CONVERSATIONS}</div>
            <span className="stat-label-mobile">Messages</span>
            <span className="stat-badge-mobile">{dashboardData.myMessages.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.myMessages.length}</span>
              <span className="stat-label-compact">CONVERS..</span>
            </div>
          </div>
          
          {/* Data Request Inbox stat card */}
          <div 
            className="stat-card-compact stat-card-warning clickable-card"
            onClick={() => {
              // On mobile, open modal; on desktop, expand section
              if (window.innerWidth <= 640) {
                setMobilePIICategory('piiInbox');
                setShowMobilePIIModal(true);
              } else {
                setExpandedGroups(prev => ({ ...prev, piiRequests: true }));
                setPiiActiveCategory('piiInbox');
                setTimeout(() => {
                  document.querySelector('.activity-group-header-pii')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            title="Click to see incoming data requests"
          >
            <div className="stat-icon-compact">📬</div>
            <span className="stat-label-mobile">Requests</span>
            <span className="stat-badge-mobile">{dashboardData.incomingContactRequests.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.incomingContactRequests.length}</span>
              <span className="stat-label-compact">REQS INBOX</span>
            </div>
          </div>
          
          {/* Access Received stat card */}
          <div 
            className="stat-card-compact stat-card-purple clickable-card"
            onClick={() => {
              // On mobile, open modal; on desktop, expand section
              if (window.innerWidth <= 640) {
                setMobilePIICategory('piiHistory');
                setShowMobilePIIModal(true);
              } else {
                setExpandedGroups(prev => ({ ...prev, piiRequests: true }));
                setPiiActiveCategory('piiHistory');
                setTimeout(() => {
                  document.querySelector('.activity-group-header-pii')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            title="Click to see access you've received"
          >
            <div className="stat-icon-compact">🔓</div>
            <span className="stat-label-mobile">Access</span>
            <span className="stat-badge-mobile">{dashboardData.receivedAccess.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.receivedAccess.length}</span>
              <span className="stat-label-compact">ACCESS RECVD</span>
            </div>
          </div>
          
          {/* My Favorites stat card (mobile-optimized) */}
          <div 
            className="stat-card-compact stat-card-favorites clickable-card"
            onClick={() => {
              if (window.innerWidth <= 640) {
                setMobileActivityCategory('myFavorites');
                setShowMobileActivityModal(true);
              } else {
                setExpandedGroups(prev => ({ ...prev, myActivities: true }));
                setMyActiveCategory('myFavorites');
                setTimeout(() => {
                  document.querySelector('.activity-group-header-my')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            title="Click to see your favorites"
          >
            <div className="stat-icon-compact">⭐</div>
            <span className="stat-label-mobile">My Favs</span>
            <span className="stat-badge-mobile">{dashboardData.myFavorites.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.myFavorites.length}</span>
              <span className="stat-label-compact">MY FAVS</span>
            </div>
          </div>
          
          {/* My Shortlists stat card (mobile-optimized) */}
          <div 
            className="stat-card-compact stat-card-shortlist clickable-card"
            onClick={() => {
              if (window.innerWidth <= 640) {
                setMobileActivityCategory('myShortlists');
                setShowMobileActivityModal(true);
              } else {
                setExpandedGroups(prev => ({ ...prev, myActivities: true }));
                setMyActiveCategory('myShortlists');
                setTimeout(() => {
                  document.querySelector('.activity-group-header-my')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            title="Click to see your shortlists"
          >
            <div className="stat-icon-compact">📋</div>
            <span className="stat-label-mobile">Shortlist</span>
            <span className="stat-badge-mobile">{dashboardData.myShortlists.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.myShortlists.length}</span>
              <span className="stat-label-compact">MY SHORTLSTS</span>
            </div>
          </div>
          
          {/* Shortlisted Me stat card (mobile-optimized) */}
          <div 
            className="stat-card-compact stat-card-shortlisted-me clickable-card"
            onClick={() => {
              if (window.innerWidth <= 640) {
                setMobileActivityCategory('theirShortlists');
                setShowMobileActivityModal(true);
              } else {
                setExpandedGroups(prev => ({ ...prev, othersActivities: true }));
                setOthersActiveCategory('theirShortlists');
                setTimeout(() => {
                  document.querySelector('.activity-group-header-others')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }}
            title="Click to see who shortlisted you"
          >
            <div className="stat-icon-compact">🔖</div>
            <span className="stat-label-mobile">Shortd Me</span>
            <span className="stat-badge-mobile">{dashboardData.theirShortlists.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.theirShortlists.length}</span>
              <span className="stat-label-compact">SHORTD ME</span>
            </div>
          </div>
          
          {/* Saved Searches stat card */}
          <div 
            className="stat-card-compact stat-card-saved-search clickable-card"
            onClick={() => navigate('/search?showSaved=true')}
            title="Click to view your saved searches"
          >
            <div className="stat-icon-compact">🔍</div>
            <span className="stat-label-mobile">Searches</span>
            <span className="stat-badge-mobile">{dashboardData.savedSearches.length}</span>
            <div className="stat-content-compact">
              <span className="stat-value-compact">{dashboardData.savedSearches.length}</span>
              <span className="stat-label-compact">SAVED SRCH</span>
            </div>
          </div>
        </div>
        
        {/* Inline Poll Widget or Placeholder */}
        <div className="poll-widget-inline">
          <PollWidget 
            inline={true} 
            renderPlaceholder={() => (
              <div className="stat-card-compact stat-card-disabled">
                <div className="stat-icon-compact">🔔</div>
                <span className="stat-label-mobile">Poll</span>
                <div className="stat-content-compact">
                  <span className="stat-label-compact">NO ACTIVE POLLS</span>
                </div>
              </div>
            )}
          />
        </div>
      </div>

      {/* PII Requests Section - Dedicated section for incoming/outgoing requests */}
      <div className="activity-group">
        <div 
          className={`activity-group-header activity-group-header-pii clickable ${expandedGroups.piiRequests ? 'expanded' : ''}`}
          onClick={() => toggleGroup('piiRequests')}
        >
          <div className="activity-group-title">
            <span className="activity-group-icon">🔐</span>
            <h2>Data Requests</h2>
            <span className="activity-group-count">
              {dashboardData.incomingContactRequests.length + dashboardData.myRequests.length}
            </span>
            <button 
              className={`section-refresh-btn ${refreshing.piiGroup ? 'spinning' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                refreshPiiGroup();
              }}
              title="Refresh all data requests"
              disabled={refreshing.piiGroup}
            >
              ⟳
            </button>
          </div>
          <span className="activity-group-toggle">{expandedGroups.piiRequests ? '▼' : '▶'}</span>
        </div>
        
        {expandedGroups.piiRequests && (
          <>
            {/* Horizontal Category Pills */}
            <div className="category-pills">
              <button 
                className={`category-pill pill-inbox ${piiActiveCategory === 'piiInbox' ? 'active' : ''}`}
                onClick={() => setPiiActiveCategory('piiInbox')}
              >
                <span className="pill-icon">📬</span>
                <span className="pill-label">Requests Inbox</span>
                <span className="pill-count">{dashboardData.incomingContactRequests.length}</span>
              </button>
              <button 
                className={`category-pill pill-sent ${piiActiveCategory === 'piiSent' ? 'active' : ''}`}
                onClick={() => setPiiActiveCategory('piiSent')}
              >
                <span className="pill-icon">📤</span>
                <span className="pill-label">Requests Sent</span>
                <span className="pill-count">{dashboardData.myRequests.length}</span>
              </button>
              <button 
                className={`category-pill pill-history ${piiActiveCategory === 'piiHistory' ? 'active' : ''}`}
                onClick={() => setPiiActiveCategory('piiHistory')}
              >
                <span className="pill-icon">🔓</span>
                <span className="pill-label">Access Received</span>
                <span className="pill-count">{dashboardData.receivedAccess.length}</span>
              </button>
            </div>

            {/* Content Panel for Selected Category */}
            <div className="category-content">
              {piiActiveCategory === 'piiInbox' && (
                <PIIRequestsTable
                  requests={dashboardData.incomingContactRequests}
                  type="inbox"
                  onApprove={async (request, profile) => {
                    try {
                      await api.put(`/pii-requests/${request.id}/approve?username=${currentUser}`, {});
                      logger.info(`Approved request from ${profile?.username}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to approve request:', err);
                    }
                  }}
                  onReject={async (requestId) => {
                    try {
                      await api.put(`/pii-requests/${requestId}/reject?username=${currentUser}`);
                      logger.info(`Rejected request ${requestId}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to reject request:', err);
                    }
                  }}
                  onApproveAll={async (username, requests) => {
                    try {
                      // Only approve pending requests
                      const pendingRequests = requests.filter(r => r.status === 'pending');
                      if (pendingRequests.length === 0) {
                        toast.info('No pending requests to approve');
                        return;
                      }
                      for (const req of pendingRequests) {
                        await api.put(`/pii-requests/${req.id}/approve?username=${currentUser}`, {});
                      }
                      toast.success(`Approved ${pendingRequests.length} request(s) from ${username}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to approve all requests:', err);
                      toast.error('Failed to approve requests');
                    }
                  }}
                  onRejectAll={async (username, requests) => {
                    try {
                      // Only reject pending requests
                      const pendingRequests = requests.filter(r => r.status === 'pending');
                      if (pendingRequests.length === 0) {
                        toast.info('No pending requests to reject');
                        return;
                      }
                      for (const req of pendingRequests) {
                        await api.put(`/pii-requests/${req.id}/reject?username=${currentUser}`);
                      }
                      toast.success(`Rejected ${pendingRequests.length} request(s) from ${username}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to reject all requests:', err);
                      toast.error('Failed to reject requests');
                    }
                  }}
                  onRevokeAll={async (username, requests) => {
                    try {
                      logger.info(`🚫 Revoking access for ${username}, requests:`, requests);
                      
                      // Revoke approved requests - update their status back to pending
                      const approvedRequests = requests.filter(r => r.status === 'approved');
                      logger.info(`📋 Approved requests to revoke: ${approvedRequests.length}`);
                      
                      if (approvedRequests.length === 0) {
                        toast.info('No approved access to revoke');
                        return;
                      }
                      
                      // Use the revoke-by-user endpoint which handles both pii_access and pii_requests
                      await api.delete(`/pii-access/revoke-user/${username}?granter=${currentUser}`);
                      
                      toast.success(`Revoked all access for ${username}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to revoke access:', err);
                      toast.error('Failed to revoke access');
                    }
                  }}
                  onProfileClick={(username) => navigate(`/profile/${username}`)}
                  showMutualExchange={true}
                  compact={true}
                />
              )}
              {piiActiveCategory === 'piiSent' && (
                <PIIRequestsTable
                  requests={dashboardData.myRequests}
                  type="sent"
                  onCancel={async (requestId) => {
                    try {
                      await api.delete(`/pii-requests/${requestId}?username=${currentUser}`);
                      logger.info(`Cancelled request ${requestId}`);
                      loadDashboardData(currentUser);
                    } catch (err) {
                      logger.error('Failed to cancel request:', err);
                    }
                  }}
                  onProfileClick={(username) => navigate(`/profile/${username}`)}
                  compact={true}
                />
              )}
              {piiActiveCategory === 'piiHistory' && (
                <PIIRequestsTable
                  requests={dashboardData.receivedAccess}
                  type="history"
                  onProfileClick={(username) => navigate(`/profile/${username}`)}
                  compact={true}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* My Activities Section - Collapsible with Horizontal Pills */}
      <div className="activity-group">
        <div 
          className={`activity-group-header activity-group-header-my clickable ${expandedGroups.myActivities ? 'expanded' : ''}`}
          onClick={() => toggleGroup('myActivities')}
        >
          <div className="activity-group-title">
            <span className="activity-group-icon">📊</span>
            <h2>My Activities</h2>
            <span className="activity-group-count">{getGroupCount('myActivities')}</span>
            <button 
              className={`section-refresh-btn ${refreshing.myActivitiesGroup ? 'spinning' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                refreshMyActivitiesGroup();
              }}
              title="Refresh all activities"
              disabled={refreshing.myActivitiesGroup}
            >
              ⟳
            </button>
          </div>
          <span className="activity-group-toggle">{expandedGroups.myActivities ? '▼' : '▶'}</span>
        </div>
        
        {expandedGroups.myActivities && (
          <>
        {/* Horizontal Category Pills */}
        <div className="category-pills">
          <button 
            className={`category-pill pill-messages ${myActiveCategory === 'myMessages' ? 'active' : ''}`}
            onClick={() => setMyActiveCategory('myMessages')}
          >
            <span className="pill-icon">{SECTION_ICONS.MESSAGES}</span>
            <span className="pill-label">Messages</span>
            <span className="pill-count">{dashboardData.myMessages.length}</span>
          </button>
          <button 
            className={`category-pill pill-notes ${myActiveCategory === 'myNotes' ? 'active' : ''}`}
            onClick={() => setMyActiveCategory('myNotes')}
          >
            <span className="pill-icon">📝</span>
            <span className="pill-label">Notes</span>
            <span className="pill-count">{dashboardData.myNotes.length}</span>
          </button>
          <button 
            className={`category-pill pill-favorites ${myActiveCategory === 'myFavorites' ? 'active' : ''}`}
            onClick={() => setMyActiveCategory('myFavorites')}
          >
            <span className="pill-icon">{SECTION_ICONS.MY_FAVORITES}</span>
            <span className="pill-label">Favorites</span>
            <span className="pill-count">{dashboardData.myFavorites.length}</span>
          </button>
          <button 
            className={`category-pill pill-shortlists ${myActiveCategory === 'myShortlists' ? 'active' : ''}`}
            onClick={() => setMyActiveCategory('myShortlists')}
          >
            <span className="pill-icon">{SECTION_ICONS.MY_SHORTLISTS}</span>
            <span className="pill-label">Shortlists</span>
            <span className="pill-count">{dashboardData.myShortlists.length}</span>
          </button>
          <button 
            className={`category-pill pill-exclusions ${myActiveCategory === 'myExclusions' ? 'active' : ''}`}
            onClick={() => setMyActiveCategory('myExclusions')}
          >
            <span className="pill-icon">{SECTION_ICONS.NOT_INTERESTED}</span>
            <span className="pill-label">Search Exclude</span>
            <span className="pill-count">{dashboardData.myExclusions.length}</span>
          </button>
        </div>

        {/* Content Panel for Selected Category */}
        <div className="category-content">
          {myActiveCategory === 'myMessages' && renderTabContent('Messages', dashboardData.myMessages, 'myMessages', SECTION_ICONS.MESSAGES, '#5a6fd6', handleDeleteMessage)}
          {myActiveCategory === 'myNotes' && <ProfileNotes />}
          {myActiveCategory === 'myFavorites' && renderTabContent('Favorites', dashboardData.myFavorites, 'myFavorites', SECTION_ICONS.MY_FAVORITES, '#d4a574', handleRemoveFromFavorites)}
          {myActiveCategory === 'myShortlists' && renderTabContent('Shortlists', dashboardData.myShortlists, 'myShortlists', SECTION_ICONS.MY_SHORTLISTS, '#6ba8a0', handleRemoveFromShortlist)}
          {myActiveCategory === 'myExclusions' && renderTabContent('Search Exclude', dashboardData.myExclusions, 'myExclusions', SECTION_ICONS.NOT_INTERESTED, '#dc6b6b', handleRemoveFromExclusions)}
        </div>
          </>
        )}
      </div>

      {/* Others' Activities Section - Collapsible with Horizontal Pills */}
      <div className="activity-group">
        <div 
          className={`activity-group-header activity-group-header-light activity-group-header-others clickable ${expandedGroups.othersActivities ? 'expanded' : ''}`}
          onClick={() => toggleGroup('othersActivities')}
        >
          <div className="activity-group-title">
            <span className="activity-group-icon">💕</span>
            <h2>Admirers</h2>
            <span className="activity-group-count">{getGroupCount('othersActivities')}</span>
            <button 
              className={`section-refresh-btn ${refreshing.admirersGroup ? 'spinning' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                refreshAdmirersGroup();
              }}
              title="Refresh all admirers"
              disabled={refreshing.admirersGroup}
            >
              ⟳
            </button>
          </div>
          <span className="activity-group-toggle">{expandedGroups.othersActivities ? '▼' : '▶'}</span>
        </div>
        
        {expandedGroups.othersActivities && (
          <>
        {/* Horizontal Category Pills */}
        <div className="category-pills">
          <button 
            className={`category-pill pill-views ${othersActiveCategory === 'theirViews' ? 'active' : ''}`}
            onClick={() => setOthersActiveCategory('theirViews')}
          >
            <span className="pill-icon">{SECTION_ICONS.PROFILE_VIEWS}</span>
            <span className="pill-label">Profile Views</span>
            <span className="pill-count">{dashboardData.myViews.length}</span>
          </button>
          <button 
            className={`category-pill pill-their-favorites ${othersActiveCategory === 'theirFavorites' ? 'active' : ''}`}
            onClick={() => setOthersActiveCategory('theirFavorites')}
          >
            <span className="pill-icon">{SECTION_ICONS.THEIR_FAVORITES}</span>
            <span className="pill-label">Favorited Me</span>
            <span className="pill-count">{dashboardData.theirFavorites.length}</span>
          </button>
          <button 
            className={`category-pill pill-their-shortlists ${othersActiveCategory === 'theirShortlists' ? 'active' : ''}`}
            onClick={() => setOthersActiveCategory('theirShortlists')}
          >
            <span className="pill-icon">{SECTION_ICONS.THEIR_SHORTLISTS}</span>
            <span className="pill-label">Shortlisted Me</span>
            <span className="pill-count">{dashboardData.theirShortlists.length}</span>
          </button>
        </div>

        {/* Content Panel for Selected Category */}
        <div className="category-content">
          {othersActiveCategory === 'theirViews' && renderTabContent('Profile Views', dashboardData.myViews, 'myViews', SECTION_ICONS.PROFILE_VIEWS, '#c9944a', handleClearViewHistory)}
          {othersActiveCategory === 'theirFavorites' && renderTabContent('Favorited Me', dashboardData.theirFavorites, 'theirFavorites', SECTION_ICONS.THEIR_FAVORITES, '#c4687a', null)}
          {othersActiveCategory === 'theirShortlists' && renderTabContent('Shortlisted Me', dashboardData.theirShortlists, 'theirShortlists', SECTION_ICONS.THEIR_SHORTLISTS, '#5a9eb5', null)}
        </div>
          </>
        )}
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

      {/* Chat First Prompt - shown before PII request */}
      <ChatFirstPrompt
        isOpen={showChatFirstPrompt}
        onClose={() => {
          setShowChatFirstPrompt(false);
          setPendingPIIRequestUser(null);
        }}
        onContinue={() => {
          if (pendingPIIRequestUser) {
            openPIIRequestModal(pendingPIIRequestUser);
          }
          setPendingPIIRequestUser(null);
        }}
        onOpenChat={() => {
          if (pendingPIIRequestUser) {
            handleMessageUser(pendingPIIRequestUser.username, pendingPIIRequestUser);
          }
          setPendingPIIRequestUser(null);
        }}
        targetUser={pendingPIIRequestUser}
      />

      {/* PII Request Modal */}
      <PIIRequestModal
        isOpen={showPIIRequestModal}
        profileUsername={selectedUserForPII?.username}
        profileName={selectedUserForPII?.firstName || selectedUserForPII?.username}
        currentAccess={selectedUserPIIAccess}
        requestStatus={selectedUserPIIRequestStatus}
        visibilitySettings={{
          contactNumberVisible: selectedUserForPII?.contactNumberVisible,
          contactEmailVisible: selectedUserForPII?.contactEmailVisible,
          linkedinUrlVisible: selectedUserForPII?.linkedinUrlVisible
        }}
        targetProfile={selectedUserForPII}
        requesterProfile={userProfile}
        onClose={() => {
          setShowPIIRequestModal(false);
          setSelectedUserForPII(null);
          setSelectedUserPIIAccess({});
          setSelectedUserPIIRequestStatus({});
        }}
        onSuccess={() => {
          loadDashboardData(currentUser);
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

      {/* Photo Requests Modal */}
      <PhotoRequestsModal
        isOpen={showPhotoRequestsModal}
        onClose={() => setShowPhotoRequestsModal(false)}
        username={currentUser}
        onRequestHandled={() => loadDashboardData(currentUser)}
      />

      {/* Conversations Modal */}
      <ConversationsModal
        isOpen={showConversationsModal}
        onClose={() => setShowConversationsModal(false)}
        username={currentUser}
      />

      {/* Contact Requests Modal (Incoming) */}
      <ContactRequestsModal
        isOpen={showContactRequestsModal}
        onClose={() => setShowContactRequestsModal(false)}
        username={currentUser}
        onRequestHandled={() => loadDashboardData(currentUser)}
      />

      {/* Pause Settings Modal */}
      <PauseSettings
        isOpen={showPauseSettings}
        onClose={() => setShowPauseSettings(false)}
        onPause={handlePauseSuccess}
        currentStatus={pauseStatus}
      />

      {/* Mobile PII Modal - for stat card clicks on mobile */}
      {showMobilePIIModal && (
        <div className="mobile-pii-modal-overlay" onClick={() => setShowMobilePIIModal(false)}>
          <div className="mobile-pii-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-pii-modal-header">
              <h2>
                {mobilePIICategory === 'piiInbox' && '📬 Requests Inbox'}
                {mobilePIICategory === 'piiHistory' && '🔓 Access Received'}
              </h2>
              <button className="mobile-pii-modal-close" onClick={() => setShowMobilePIIModal(false)}>✕</button>
            </div>
            <div className="mobile-pii-modal-body">
              {mobilePIICategory === 'piiInbox' && (
                <PIIRequestsTable
                  requests={dashboardData.incomingContactRequests}
                  type="inbox"
                  onApprove={async (request, profile) => {
                    try {
                      await api.post(`/pii-requests/${request._id}/approve`);
                      loadDashboardData(currentUser);
                    } catch (error) {
                      console.error('Error approving request:', error);
                    }
                  }}
                  onReject={async (requestId) => {
                    try {
                      await api.post(`/pii-requests/${requestId}/reject`);
                      loadDashboardData(currentUser);
                    } catch (error) {
                      console.error('Error rejecting request:', error);
                    }
                  }}
                  onProfileClick={(username) => {
                    setShowMobilePIIModal(false);
                    navigate(`/profile/${username}`);
                  }}
                  compact={true}
                />
              )}
              {mobilePIICategory === 'piiHistory' && (
                <PIIRequestsTable
                  requests={dashboardData.receivedAccess}
                  type="history"
                  onProfileClick={(username) => {
                    setShowMobilePIIModal(false);
                    navigate(`/profile/${username}`);
                  }}
                  compact={true}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Activity Modal - for Favorites/Shortlists stat card clicks on mobile */}
      {showMobileActivityModal && (
        <div className="mobile-pii-modal-overlay" onClick={() => setShowMobileActivityModal(false)}>
          <div className="mobile-pii-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-pii-modal-header mobile-activity-header">
              <h2>
                {mobileActivityCategory === 'myFavorites' && '⭐ My Favorites'}
                {mobileActivityCategory === 'myShortlists' && '📋 My Shortlists'}
                {mobileActivityCategory === 'theirFavorites' && '💕 Favorited Me'}
                {mobileActivityCategory === 'theirShortlists' && '🔖 Shortlisted Me'}
              </h2>
              <button className="mobile-pii-modal-close" onClick={() => setShowMobileActivityModal(false)}>✕</button>
            </div>
            <div className="mobile-pii-modal-body">
              {mobileActivityCategory === 'myFavorites' && (
                <div className="mobile-activity-list">
                  {dashboardData.myFavorites.length === 0 ? (
                    <div className="no-data-message">No favorites yet</div>
                  ) : (
                    dashboardData.myFavorites.map((user, index) => (
                      <div 
                        key={index} 
                        className="mobile-activity-item"
                        onClick={() => {
                          setShowMobileActivityModal(false);
                          navigate(`/profile/${typeof user === 'string' ? user : user.username}`);
                        }}
                      >
                        <span className="mobile-activity-icon">⭐</span>
                        <span className="mobile-activity-name">{typeof user === 'string' ? user : user.username}</span>
                        <span className="mobile-activity-arrow">→</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {mobileActivityCategory === 'myShortlists' && (
                <div className="mobile-activity-list">
                  {dashboardData.myShortlists.length === 0 ? (
                    <div className="no-data-message">No shortlists yet</div>
                  ) : (
                    dashboardData.myShortlists.map((user, index) => (
                      <div 
                        key={index} 
                        className="mobile-activity-item"
                        onClick={() => {
                          setShowMobileActivityModal(false);
                          navigate(`/profile/${typeof user === 'string' ? user : user.username}`);
                        }}
                      >
                        <span className="mobile-activity-icon">📋</span>
                        <span className="mobile-activity-name">{typeof user === 'string' ? user : user.username}</span>
                        <span className="mobile-activity-arrow">→</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {mobileActivityCategory === 'theirFavorites' && (
                <div className="mobile-activity-list">
                  {dashboardData.theirFavorites.length === 0 ? (
                    <div className="no-data-message">No one has favorited you yet</div>
                  ) : (
                    dashboardData.theirFavorites.map((user, index) => (
                      <div 
                        key={index} 
                        className="mobile-activity-item"
                        onClick={() => {
                          setShowMobileActivityModal(false);
                          navigate(`/profile/${typeof user === 'string' ? user : user.username}`);
                        }}
                      >
                        <span className="mobile-activity-icon">💕</span>
                        <span className="mobile-activity-name">{typeof user === 'string' ? user : user.username}</span>
                        <span className="mobile-activity-arrow">→</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {mobileActivityCategory === 'theirShortlists' && (
                <div className="mobile-activity-list">
                  {dashboardData.theirShortlists.length === 0 ? (
                    <div className="no-data-message">No one has shortlisted you yet</div>
                  ) : (
                    dashboardData.theirShortlists.map((user, index) => (
                      <div 
                        key={index} 
                        className="mobile-activity-item"
                        onClick={() => {
                          setShowMobileActivityModal(false);
                          navigate(`/profile/${typeof user === 'string' ? user : user.username}`);
                        }}
                      >
                        <span className="mobile-activity-icon">🔖</span>
                        <span className="mobile-activity-name">{typeof user === 'string' ? user : user.username}</span>
                        <span className="mobile-activity-arrow">→</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exclusion Preview Modal */}
      {showExclusionPreview && exclusionPreviewData && (
        <div className="modal-overlay" onClick={() => setShowExclusionPreview(false)}>
          <div className="exclusion-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', padding: '20px', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                ⚠️ Confirm Exclusion
              </h2>
              <button 
                className="modal-close" 
                onClick={() => setShowExclusionPreview(false)}
                style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: 'white', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px', background: 'var(--card-background)' }}>
              <p style={{ marginBottom: '16px', fontSize: '15px' }}>
                Marking <strong>{selectedUserForExclusion?.firstName || exclusionPreviewData.target_username}</strong> as "Not Interested" will permanently remove:
              </p>
              
              <div style={{ background: 'var(--surface-color)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                {exclusionPreviewData.messages_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>💬 Messages</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.messages_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.favorites_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>❤️ Favorites</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.favorites_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.shortlists_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>📋 Shortlists</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.shortlists_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.pii_requests_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>📝 PII Requests</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.pii_requests_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.pii_access_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <span>🔓 PII Access</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.pii_access_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.notifications_count > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span>🔔 Pending Notifications</span>
                    <strong style={{ color: 'var(--danger-color)' }}>{exclusionPreviewData.notifications_count}</strong>
                  </div>
                )}
                {exclusionPreviewData.total_items === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '8px 0' }}>
                    No existing data to remove
                  </div>
                )}
              </div>
              
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '0' }}>
                This action will also notify the user that a profile they were interested in is no longer available.
              </p>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--card-background)', borderRadius: '0 0 16px 16px' }}>
              <button 
                onClick={() => setShowExclusionPreview(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-color)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmExclusion}
                disabled={exclusionLoading}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: 'white', cursor: 'pointer', fontWeight: '600' }}
              >
                {exclusionLoading ? '⏳ Processing...' : '🚫 Confirm Exclusion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Fixed Action Buttons */}
      <div className="dashboard-bottom-actions">
        {/* View Mode Toggle */}
        <button
          className={`btn-view-toggle ${viewMode}`}
          onClick={() => setViewMode(viewMode === 'cards' ? 'rows' : 'cards')}
          title={viewMode === 'cards' ? 'Switch to Row View' : 'Switch to Card View'}
        >
          {viewMode === 'cards' ? '⊞' : '☰'}
        </button>
        
        {/* Refresh Button */}
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
    </div>
  );
};

export default Dashboard2;
